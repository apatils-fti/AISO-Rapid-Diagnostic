#!/usr/bin/env node

/**
 * Competitor Mentions Enrichment
 *
 * Scans response_text for competitor brand name mentions and writes
 * a JSONB object to the competitor_mentions column.
 *
 * Idempotent: only processes rows where competitor_mentions IS NULL or '{}'.
 *
 * Usage:
 *   node scripts/enrich-competitor-mentions.js
 *   node scripts/enrich-competitor-mentions.js --limit 100
 *   node scripts/enrich-competitor-mentions.js --platform gemini
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

// ─── Config ──────────────────────────────────────────────────
const BATCH_SIZE = 50;

// Default (J.Crew) competitor patterns. Used only in backfill mode (no
// --client-id). When --client-id is set, competitors are fetched from
// clients.config.competitors and patterns are auto-generated.
const DEFAULT_COMPETITORS = [
  { name: 'Banana Republic', patterns: [/banana\s*republic/gi] },
  { name: 'Everlane', patterns: [/everlane/gi] },
  { name: 'Gap', patterns: [/\bgap\b(?!\s+(?:between|in|analysis|from|of|to))/gi] },
  { name: 'Abercrombie & Fitch', patterns: [/abercrombie\s*(?:&|and)?\s*fitch/gi, /abercrombie/gi] },
  { name: 'Club Monaco', patterns: [/club\s*monaco/gi] },
];

// Auto-generate a case-insensitive, word-boundary-anchored pattern from a
// competitor name. Hand-tune the regex (like the J.Crew Gap exclusion above)
// for competitors with common-word names ('Gap', 'Apex', 'Pulse') to avoid
// false positives. Distinctive proper nouns (Atlassian, ServiceNow) are
// fine with the auto-generated form.
function competitorFromName(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { name, patterns: [new RegExp(`\\b${escaped}\\b`, 'gi')] };
}

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

// ─── Detection ───────────────────────────────────────────────
function detectCompetitors(text, competitors) {
  const mentions = {};
  for (const comp of competitors) {
    let count = 0;
    for (const pattern of comp.patterns) {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    }
    if (count > 0) mentions[comp.name] = count;
  }
  return mentions;
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Competitor Mentions Enrichment');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Scope: ${clientId ? `client ${clientId}` : 'ALL clients (backfill mode)'}`);

  // Resolve the competitor list. With --client-id, read from clients.config
  // and hard-fail if it's empty (silently writing {} for every result is worse
  // than a loud error). Without --client-id (backfill), use the J.Crew defaults.
  let competitors;
  if (clientId) {
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients').select('config').eq('id', clientId).maybeSingle();
    if (clientErr) {
      console.error(`  ✗ Client lookup failed: ${clientErr.message}`);
      process.exit(1);
    }
    const cfgList = clientRow?.config?.competitors ?? [];
    const names = cfgList
      .map(c => (typeof c === 'string' ? c : c?.name))
      .filter(Boolean);
    if (names.length === 0) {
      console.error(
        `  ✗ Client ${clientId} has no config.competitors. Refusing to run — would silently produce empty competitor_mentions for every result. Populate clients.config.competitors first.`
      );
      process.exit(1);
    }
    competitors = names.map(competitorFromName);
    console.log(`  Competitors (from clients.config): ${names.join(', ')}`);
  } else {
    competitors = DEFAULT_COMPETITORS;
    console.log(`  Competitors (J.Crew defaults): ${competitors.map(c => c.name).join(', ')}`);
  }

  let query = supabase
    .from('results')
    .select('id, response_text, platform')
    .or('competitor_mentions.is.null,competitor_mentions.eq.{}')
    .order('created_at', { ascending: true });

  if (clientId) {
    const { data: runs, error: runsErr } = await supabase
      .from('runs').select('id').eq('client_id', clientId);
    if (runsErr) { console.error('  Runs query failed:', runsErr.message); process.exit(1); }
    if (!runs?.length) { console.log('  No runs found for this client. Nothing to process.'); return; }
    console.log(`  Found ${runs.length} runs`);
    query = query.in('run_id', runs.map(r => r.id));
  }

  if (platformFilter) query = query.eq('platform', platformFilter);
  if (limit) query = query.limit(limit);

  const { data: rows, error } = await query;
  if (error) { console.error('  Fetch error:', error.message); process.exit(1); }

  console.log(`  Found ${rows.length} un-enriched results`);
  if (rows.length === 0) { console.log('  Nothing to process.'); return; }

  let processed = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const updates = batch.map(row => ({
      id: row.id,
      competitor_mentions: detectCompetitors(row.response_text || '', competitors),
    }));

    for (const update of updates) {
      const { error: upErr } = await supabase
        .from('results')
        .update({ competitor_mentions: update.competitor_mentions })
        .eq('id', update.id);
      if (upErr) { failed++; } else { processed++; }
    }

    if ((processed + failed) % 100 === 0 || i + BATCH_SIZE >= rows.length) {
      console.log(`  Progress: ${processed + failed}/${rows.length} (${processed} ok, ${failed} err)`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  Done in ${duration}s. Processed: ${processed}, Failed: ${failed}`);

  writeFileSync(
    resolve(__dirname, 'competitor-enrichment-summary.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), processed, failed, duration }, null, 2)
  );
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
