#!/usr/bin/env node

/**
 * VADER Sentiment Enrichment
 *
 * Replaces Claude API sentiment classification with VADER
 * (Valence Aware Dictionary and sEntiment Reasoner).
 * Deterministic, runs locally, no API cost.
 *
 * Classification:
 *   compound >= 0.05  → positive
 *   compound <= -0.05 → negative
 *   -0.05 < compound < 0.05 → neutral (or hedged if hedging words present)
 *
 * Idempotent: only processes rows where sentiment IS NULL.
 *
 * Usage:
 *   node scripts/enrich-sentiment-vader.js
 *   node scripts/enrich-sentiment-vader.js --limit 100
 *   node scripts/enrich-sentiment-vader.js --platform gemini
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import vader from 'vader-sentiment';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

// ─── Config ──────────────────────────────────────────────────
const BATCH_SIZE = 50;

const HEDGING_WORDS = [
  'however', 'but', 'although', 'despite', 'inconsistent',
  'can be', 'may', 'sometimes', 'depending', 'varies',
  'mixed', 'while', 'on the other hand', 'that said',
  'not always', 'some find', 'could be', 'arguably',
];

// ─── CLI args ────────────────────────────────────────────────
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

// ─── Supabase ────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Sentiment Classification ────────────────────────────────
function classifySentiment(text, clientMentioned) {
  if (!clientMentioned) return 'not_mentioned';
  if (!text || text.trim().length === 0) return 'neutral';

  const scores = vader.SentimentIntensityAnalyzer.polarity_scores(text);
  const compound = scores.compound;

  if (compound >= 0.05) return 'positive';
  if (compound <= -0.05) return 'negative';

  // Neutral compound but check for hedging language
  const lower = text.toLowerCase();
  const hasHedging = HEDGING_WORDS.some(word => lower.includes(word));
  if (hasHedging) return 'hedged';

  return 'neutral';
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  VADER Sentiment Enrichment');
  console.log('═══════════════════════════════════════════════');
  console.log('  Model: VADER (rule-based, deterministic)');
  console.log('  Cost: $0.00');
  console.log(`  Scope: ${clientId ? `client ${clientId}` : 'ALL clients (backfill mode)'}`);

  let query = supabase
    .from('results')
    .select('id, response_text, client_mentioned, platform')
    .is('sentiment', null)
    .order('created_at', { ascending: true });

  if (clientId) {
    const { data: runs, error: runsErr } = await supabase
      .from('runs').select('id').eq('client_id', clientId);
    if (runsErr) { console.error('  Runs query failed:', runsErr.message); process.exit(1); }
    if (!runs?.length) { console.log('  No runs found for this client. Nothing to process.'); return; }
    query = query.in('run_id', runs.map(r => r.id));
  }

  if (platformFilter) query = query.eq('platform', platformFilter);
  if (limit) query = query.limit(limit);

  const { data: rows, error } = await query;
  if (error) { console.error('Fetch error:', error.message); process.exit(1); }

  console.log(`  Found ${rows.length} un-enriched results`);
  if (rows.length === 0) { console.log('  Nothing to process.'); return; }

  let processed = 0, failed = 0;
  const sentimentCounts = { positive: 0, neutral: 0, hedged: 0, negative: 0, not_mentioned: 0 };
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      try {
        const sentiment = classifySentiment(row.response_text || '', row.client_mentioned);
        sentimentCounts[sentiment]++;

        const { error: upErr } = await supabase
          .from('results')
          .update({ sentiment })
          .eq('id', row.id);

        if (upErr) { failed++; } else { processed++; }
      } catch { failed++; }
    }

    if ((processed + failed) % 100 === 0 || i + BATCH_SIZE >= rows.length) {
      console.log(`  Progress: ${processed + failed}/${rows.length} (${processed} ok, ${failed} err)`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  Done in ${duration}s. Processed: ${processed}, Failed: ${failed}`);
  console.log('  Sentiment distribution:');
  for (const [type, count] of Object.entries(sentimentCounts)) {
    if (count > 0) console.log(`    ${type}: ${count}`);
  }

  writeFileSync(
    resolve(__dirname, 'vader-sentiment-summary.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), processed, failed, sentimentCounts, duration }, null, 2)
  );
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
