#!/usr/bin/env node

/**
 * AISO Intent Stage Backfill
 *
 * Classifies existing prompts into the new 5-value intent_stage taxonomy
 * using Claude, then writes the label back to prompts.intent_stage and
 * results.intent_stage. Best-effort: only writes labels the model is
 * "high" confident about. Uncertain classifications stay NULL.
 *
 * Idempotent: WHERE intent_stage IS NULL on both read and write, so
 * re-runs never overwrite existing labels (including manual corrections).
 *
 * Usage:
 *   node scripts/backfill-intent.js --dry-run
 *   node scripts/backfill-intent.js --limit 50
 *   node scripts/backfill-intent.js
 *
 * Estimated cost: ~$0.003 per unique prompt (~$4 for 1,286 J.Crew prompts).
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

// ─── Config ──────────────────────────────────────────────────
const BATCH_SIZE = 5;           // max concurrent classifier calls
const BATCH_DELAY_MS = 1000;
const MAX_RETRIES = 3;
const LOG_INTERVAL = 25;
const DRY_RUN_SAMPLE_SIZE = 20;
const MODEL = 'claude-sonnet-4-6';

const VALID_STAGES = ['learning', 'discovery', 'evaluation', 'validation', 'acquisition'];
const VALID_CONFIDENCE = ['high', 'medium', 'low'];

// ─── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const DRY_RUN = args.includes('--dry-run');
const LIMIT = getArg('--limit') ? parseInt(getArg('--limit'), 10) : null;

// ─── Clients ─────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in dashboard/.env.local');
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY must be set in dashboard/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ─── Classifier ──────────────────────────────────────────────
const SYSTEM_PROMPT = `Classify this search query into exactly one intent stage. Return JSON only with no prose before or after.

Intent stages:
- learning: building understanding of a topic or category (how does X work, what is Y)
- discovery: exploring what options exist (best X, who offers Y, popular Z)
- evaluation: comparing specific options against criteria (X vs Y, is X worth it, rate X)
- validation: seeking reassurance about a near-decision (will I regret X, is X safe, convince me not to buy X)
- acquisition: ready to act, seeking path to purchase or engage (where to buy X, how to book Y, order X today)

Return a JSON object with two fields:
{"intent_stage": "<one of learning|discovery|evaluation|validation|acquisition>", "confidence": "<high|medium|low>"}

Confidence rubric:
- high: the query clearly and unambiguously belongs to one stage
- medium: the query fits one stage better than others but has some ambiguity
- low: the query could reasonably belong to multiple stages

Return only the JSON object. No explanation.`;

async function classifyPrompt(promptText, attempt = 1) {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 100,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: promptText }],
    });
    const text = response.content?.[0]?.text?.trim() ?? '';
    // Extract JSON object (tolerate any code fencing)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`no JSON in response: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(jsonMatch[0]);
    if (!VALID_STAGES.includes(parsed.intent_stage)) {
      throw new Error(`invalid intent_stage: ${parsed.intent_stage}`);
    }
    if (!VALID_CONFIDENCE.includes(parsed.confidence)) {
      throw new Error(`invalid confidence: ${parsed.confidence}`);
    }
    return parsed;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return classifyPrompt(promptText, attempt + 1);
    }
    return { intent_stage: null, confidence: null, error: err.message };
  }
}

// ─── Supabase I/O ────────────────────────────────────────────
async function fetchUnclassifiedPrompts(limit) {
  let query = supabase
    .from('prompts')
    .select('id, text')
    .is('intent_stage', null);
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(`fetch prompts failed: ${error.message}`);
  return data ?? [];
}

async function writeIntentStage(promptId, intentStage) {
  const { error: pErr } = await supabase
    .from('prompts')
    .update({ intent_stage: intentStage })
    .eq('id', promptId)
    .is('intent_stage', null);
  if (pErr) throw new Error(`update prompts failed for ${promptId}: ${pErr.message}`);

  const { error: rErr } = await supabase
    .from('results')
    .update({ intent_stage: intentStage })
    .eq('prompt_id', promptId)
    .is('intent_stage', null);
  if (rErr) throw new Error(`update results failed for ${promptId}: ${rErr.message}`);
}

// ─── Concurrency helper ──────────────────────────────────────
async function runInBatches(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
  return results;
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('=== Intent Stage Backfill ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  console.log('');

  const prompts = await fetchUnclassifiedPrompts(LIMIT);
  console.log(`Found ${prompts.length} unclassified prompt(s).`);

  if (prompts.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (DRY_RUN) {
    const sample = prompts.slice(0, DRY_RUN_SAMPLE_SIZE);
    console.log(`\nDry run: classifying first ${sample.length} prompts, no writes.\n`);
    const classified = await runInBatches(sample, BATCH_SIZE, async (p) => {
      const result = await classifyPrompt(p.text);
      return { id: p.id, text: p.text, ...result };
    });
    for (const c of classified) {
      const label = c.error
        ? `ERROR: ${c.error}`
        : `${c.intent_stage} (${c.confidence})${c.confidence !== 'high' ? ' → would write NULL' : ''}`;
      console.log(`  [${c.id.slice(0, 8)}] ${label}`);
      console.log(`    ${c.text.slice(0, 100)}${c.text.length > 100 ? '…' : ''}`);
    }
    const highCount = classified.filter((c) => c.confidence === 'high').length;
    console.log(`\nSummary: ${highCount}/${classified.length} would be written (high confidence only).`);
    return;
  }

  let written = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  await runInBatches(prompts, BATCH_SIZE, async (p) => {
    const result = await classifyPrompt(p.text);
    processed += 1;

    if (result.error) {
      errors += 1;
    } else if (result.confidence !== 'high') {
      skipped += 1;
    } else {
      try {
        await writeIntentStage(p.id, result.intent_stage);
        written += 1;
      } catch (err) {
        console.error(`  write failed for ${p.id}: ${err.message}`);
        errors += 1;
      }
    }

    if (processed % LOG_INTERVAL === 0) {
      console.log(`  ${processed}/${prompts.length} — written=${written} skipped=${skipped} errors=${errors}`);
    }
  });

  console.log('\n=== Summary ===');
  console.log(`Processed:  ${processed}`);
  console.log(`Written:    ${written}  (high confidence)`);
  console.log(`Skipped:    ${skipped}  (low/medium confidence → left NULL)`);
  console.log(`Errors:     ${errors}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
