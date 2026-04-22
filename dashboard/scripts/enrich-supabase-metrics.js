#!/usr/bin/env node

/**
 * AISO Supabase Response Enrichment Pipeline
 *
 * Reads un-enriched results from Supabase (WHERE sentiment IS NULL),
 * classifies sentiment via Claude API, applies regex for other fields,
 * and writes enriched columns back to the results table.
 *
 * Idempotent: safe to re-run. Only processes rows not yet enriched.
 *
 * Usage:
 *   node scripts/enrich-supabase-metrics.js
 *   node scripts/enrich-supabase-metrics.js --limit 50
 *   node scripts/enrich-supabase-metrics.js --platform gemini
 *   node scripts/enrich-supabase-metrics.js --platform claude --limit 100
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'fs';

// Load .env.local from dashboard root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

// ─── Config ──────────────────────────────────────────────────
// BRAND_NAME is still hardcoded to J.Crew because it's interpolated into the
// Claude sentiment prompt below. Make this client-aware before running this
// script for any non-J.Crew client (the VADER enricher in the nightly pipeline
// is brand-agnostic and doesn't have this issue).
const BRAND_NAME = 'J.Crew';
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;
const MAX_RETRIES = 3;
const LOG_INTERVAL = 25;

// ─── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
const limit = getArg('--limit') ? parseInt(getArg('--limit'), 10) : undefined;
const platformFilter = getArg('--platform');
// Optional. When set, only this client's runs are processed. When omitted,
// every un-enriched result across all clients is processed (backfill mode).
const clientId = getArg('--client-id');

// ─── Validate env ────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
if (!anthropicKey) {
  console.error('Missing ANTHROPIC_API_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: anthropicKey });

// ─── Regex Classifiers ───────────────────────────────────────
//
//   recommendation_strength  → 'strong' | 'qualified' | 'absent'
//   cta_present              → boolean
//   decision_criteria_winner → boolean (comparative isotope only)
//   conversion_intent        → 'high' | 'medium' | 'low'
//

const STRONG_REC = /(?<!not |don't |wouldn't |never |not the )(I highly recommend|best option|top choice|top pick|stands out as the best|first choice)/i;
const QUALIFIED_REC = /(?<!not |don't |wouldn't |never |not a |not the )(I recommend|good option|worth considering|solid choice|a great option|worth trying|ideal for)/i;
const CTA_PATTERN = /visit jcrew\.com|shop at j\.?crew|buy from j\.?crew|find at j\.?crew|check out j\.?crew|jcrew\.com\/|shop\.jcrew/i;

function classifyRecommendation(text) {
  if (STRONG_REC.test(text)) return 'strong';
  if (QUALIFIED_REC.test(text)) return 'qualified';
  return 'absent';
}

function detectCta(text) {
  return CTA_PATTERN.test(text);
}

function detectWinner(text, isotope) {
  if (isotope !== 'comparative') return false;
  const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return false;
  const lastTwo = sentences.slice(-2);
  return lastTwo.some(s => /j\.?crew/i.test(s));
}

function mapIntent(isotope) {
  if (isotope === 'commercial' || isotope === 'specific') return 'high';
  if (isotope === 'comparative' || isotope === 'persona') return 'medium';
  return 'low';
}

// ─── Sentiment via Claude API ────────────────────────────────
async function classifySentiment(responseText, retries = 0) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 64,
      system: 'You are an AI search response analyzer. Return only raw JSON with no markdown, no code fences, no explanation. Start your response with { and end with }.',
      messages: [{
        role: 'user',
        content: `Classify the sentiment toward the brand '${BRAND_NAME}' in this AI response.
Return: { "sentiment": "positive" | "neutral" | "hedged" | "negative" | "not_mentioned" }

Rules:
- positive: praised, recommended, described with positive language
- neutral: mentioned factually without judgment
- hedged: mentioned with qualifications, caveats, or mixed signals
- negative: criticized or described negatively
- not_mentioned: brand does not appear in the response

Response: ${responseText.slice(0, 2000)}`
      }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Non-text response from Claude');

    const raw = content.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(raw);
    const valid = ['positive', 'neutral', 'hedged', 'negative', 'not_mentioned'];
    if (!valid.includes(parsed.sentiment)) {
      throw new Error(`Invalid sentiment value: ${parsed.sentiment}`);
    }
    return parsed.sentiment;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries + 1) * 1000; // 2s, 4s, 8s
      console.warn(`    Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms: ${err.message}`);
      await sleep(delay);
      return classifySentiment(responseText, retries + 1);
    }
    throw err;
  }
}

// ─── Helpers ─────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  AISO Supabase Enrichment Pipeline');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Brand:      ${BRAND_NAME}`);
  console.log(`  Scope:      ${clientId ? `client ${clientId}` : 'ALL clients (backfill mode)'}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Log every:  ${LOG_INTERVAL} results`);
  if (limit) console.log(`  Limit:      ${limit}`);
  if (platformFilter) console.log(`  Platform:   ${platformFilter}`);
  console.log('');

  // ── Step 1: Build the un-enriched-results query ──
  let query = supabase
    .from('results')
    .select('id, response_text, client_mentioned, isotope, topic_name, platform, run_id')
    .is('sentiment', null)
    .order('created_at', { ascending: true });

  // ── Step 2: Optionally narrow to one client's runs ──
  //    results.run_id → runs.id → runs.client_id
  if (clientId) {
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('id')
      .eq('client_id', clientId);

    if (runsError) {
      console.error('  ✗ Failed to fetch runs:', runsError.message);
      process.exit(1);
    }
    if (!runs?.length) {
      console.log('  No runs found for this client. Nothing to enrich.');
      return;
    }
    console.log(`  Found ${runs.length} runs for client`);
    query = query.in('run_id', runs.map(r => r.id));
  }

  if (platformFilter) query = query.eq('platform', platformFilter);
  if (limit) query = query.limit(limit);

  const { data: rows, error } = await query;

  if (error) {
    console.error('  ✗ Failed to fetch results:', error.message);
    process.exit(1);
  }

  console.log(`  Found ${rows.length} un-enriched results`);
  if (rows.length === 0) {
    console.log('  Nothing to process. All results already enriched.');
    return;
  }
  console.log('');

  // ── Process in batches ──
  const stats = { processed: 0, failed: 0, apiCalls: 0 };
  const errors = [];
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      try {
        const text = row.response_text || '';
        const isotope = row.isotope || 'informational';

        // Regex classifications
        const recommendation_strength = classifyRecommendation(text);
        const cta_present = detectCta(text);
        const decision_criteria_winner = detectWinner(text, isotope);
        const conversion_intent = mapIntent(isotope);

        // Sentiment: skip API call if brand not mentioned
        let sentiment;
        if (!row.client_mentioned) {
          sentiment = 'not_mentioned';
        } else {
          sentiment = await classifySentiment(text);
          stats.apiCalls++;
        }

        // Write back to Supabase
        const { error: updateError } = await supabase
          .from('results')
          .update({
            sentiment,
            recommendation_strength,
            cta_present,
            decision_criteria_winner,
            conversion_intent,
          })
          .eq('id', row.id);

        if (updateError) {
          throw new Error(`Supabase update failed: ${updateError.message}`);
        }

        stats.processed++;
      } catch (err) {
        stats.failed++;
        errors.push({ id: row.id, platform: row.platform, error: err.message });
        console.error(`  ✗ Row ${row.id}: ${err.message}`);
      }
    }

    // Progress logging every LOG_INTERVAL results
    const total = stats.processed + stats.failed;
    if (total % LOG_INTERVAL === 0 || total === rows.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `  Progress: ${total}/${rows.length} ` +
        `(${stats.processed} ok, ${stats.failed} err, ` +
        `${stats.apiCalls} API calls, ${elapsed}s)`
      );
    }

    // Delay between batches (skip after last batch)
    if (i + BATCH_SIZE < rows.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // ── Summary ──
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const costInput = stats.apiCalls * 220 * 0.000003;
  const costOutput = stats.apiCalls * 30 * 0.000015;
  const estimatedCost = (costInput + costOutput).toFixed(4);

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Enrichment Complete');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Duration:       ${duration}s`);
  console.log(`  Processed:      ${stats.processed}`);
  console.log(`  Failed:         ${stats.failed}`);
  console.log(`  API calls:      ${stats.apiCalls}`);
  console.log(`  Estimated cost: $${estimatedCost}`);

  const summary = {
    timestamp: new Date().toISOString(),
    clientId: clientId ?? null,
    brand: BRAND_NAME,
    platform: platformFilter || 'all',
    totalRows: rows.length,
    processed: stats.processed,
    failed: stats.failed,
    apiCalls: stats.apiCalls,
    estimatedCost: `$${estimatedCost}`,
    durationSeconds: parseFloat(duration),
    errors: errors.slice(0, 50),
  };

  // Save summary
  const summaryPath = resolve(__dirname, 'enrichment-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`  Summary: ${summaryPath}`);

  // Save errors
  if (errors.length > 0) {
    const errPath = resolve(__dirname, 'enrichment-errors.json');
    writeFileSync(errPath, JSON.stringify(errors, null, 2));
    console.log(`  Errors:  ${errPath} (${errors.length} failures)`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
