#!/usr/bin/env node
/**
 * Backfill client_mentioned for every result row of a single client.
 *
 * Before 2026-04-24 the batch runners' checkClientMention function was
 * hardcoded to J.Crew strings (see c1dbcc5). Every non-J.Crew client's
 * results were written with client_mentioned: false, tanking dashboard
 * mention-rate metrics. After the fix, going-forward data is correct,
 * but existing rows need a one-shot re-scan.
 *
 * What this does:
 *   1. Reads clients.config for the given --client-id (name + aliases
 *      + clientDomains — same fields the batch runners now read).
 *   2. Paginates every result row for that client's runs.
 *   3. Re-runs the same detection logic the batch runners use.
 *   4. UPDATEs rows where client_mentioned differs from what was stored.
 *
 * Idempotent: re-running reports 0 changes once everything is current.
 *
 * Usage:
 *   node scripts/backfill-client-mentioned.js --client-id <uuid>
 *   node scripts/backfill-client-mentioned.js --client-id <uuid> --dry-run
 *
 * Note: requires clients.config.aliases and clients.config.clientDomains
 * to be populated for the client. The seed scripts need to be re-run
 * after the generator config JSON files are updated — otherwise this
 * script finds empty patterns and refuses to update anything.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { clientId: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--client-id' && args[i + 1]) parsed.clientId = args[++i];
    if (args[i] === '--dry-run') parsed.dryRun = true;
  }
  return parsed;
}

const cliArgs = parseArgs();

if (!cliArgs.clientId) {
  console.error('Usage: node scripts/backfill-client-mentioned.js --client-id <uuid> [--dry-run]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
try {
  const dotenv = require('dotenv');
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
} catch { /* optional */ }

const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || key.startsWith('<')) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('  Set them in dashboard/.env.local before running this script.');
  process.exit(1);
}
const supabase = createClient(url, key);

// ---------------------------------------------------------------------------
// Detection (must match batch runners exactly)
// ---------------------------------------------------------------------------
function matchesBrand(text, patterns) {
  for (const p of patterns) {
    if (!p) continue;
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) return true;
  }
  return false;
}

function detectClientMention(responseText, citations, patterns, domains) {
  if (responseText && matchesBrand(responseText, patterns)) return true;
  for (const u of citations ?? []) {
    const lowerUrl = String(u).toLowerCase();
    if (domains.some((d) => d && lowerUrl.includes(d.toLowerCase()))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Paginate results (Supabase caps at 1000 rows/query — ScaledAgile has ~6k)
// ---------------------------------------------------------------------------
async function paginateResults(runIds, pageSize = 1000) {
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('results')
      .select('id, response_text, citations, client_mentioned')
      .in('run_id', runIds)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Backfill client_mentioned');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Client ID: ${cliArgs.clientId}`);
  console.log(`  Mode:      ${cliArgs.dryRun ? 'DRY RUN (no writes)' : 'WRITE'}`);

  // 1. Load client config.
  const { data: client, error: clientErr } = await supabase
    .from('clients').select('name, config').eq('id', cliArgs.clientId).maybeSingle();
  if (clientErr || !client) {
    console.error(`\n  ✗ Client not found: ${clientErr?.message ?? 'no such client_id'}`);
    process.exit(1);
  }

  const cfg = client.config ?? {};
  const brand = (client.name || cfg.brand || '').toString();
  const aliases = Array.isArray(cfg.aliases) ? cfg.aliases : [];
  const patterns = [brand, ...aliases]
    .filter((p) => typeof p === 'string' && p.length > 0);
  const domains = Array.isArray(cfg.clientDomains)
    ? cfg.clientDomains
    : (cfg.client?.domains ?? []);

  console.log(`\n  Brand patterns: ${patterns.join(', ') || '(none)'}`);
  console.log(`  Client domains: ${domains.join(', ') || '(none)'}`);

  if (patterns.length === 0 && domains.length === 0) {
    console.error(`\n  ✗ No brand patterns and no client domains on clients.config.`);
    console.error(`    Update the config first (aliases + clientDomains fields), then re-run.`);
    process.exit(1);
  }

  // 2. Load runs for this client.
  const { data: runs, error: runsErr } = await supabase
    .from('runs').select('id').eq('client_id', cliArgs.clientId);
  if (runsErr) { console.error('\n  ✗ Runs query failed:', runsErr.message); process.exit(1); }
  if (!runs || runs.length === 0) {
    console.log('\n  No runs for this client. Nothing to backfill.');
    return;
  }
  const runIds = runs.map((r) => r.id);
  console.log(`\n  Found ${runIds.length} runs`);

  // 3. Page through results and compute the new value for each.
  console.log('  Loading results...');
  const results = await paginateResults(runIds);
  console.log(`  Found ${results.length} result rows to check`);

  let toUpdateTrue = 0;
  let toUpdateFalse = 0;
  let unchanged = 0;
  const updates = [];

  for (const row of results) {
    const newValue = detectClientMention(
      row.response_text || '',
      row.citations || [],
      patterns,
      domains
    );
    if (newValue !== (row.client_mentioned ?? false)) {
      if (newValue) toUpdateTrue++;
      else toUpdateFalse++;
      updates.push({ id: row.id, client_mentioned: newValue });
    } else {
      unchanged++;
    }
  }

  console.log(`\n  Changes to apply:`);
  console.log(`    false → true:  ${toUpdateTrue}`);
  console.log(`    true → false:  ${toUpdateFalse}`);
  console.log(`    unchanged:     ${unchanged}`);

  if (updates.length === 0) {
    console.log('\n  ✓ Nothing to update. Backfill already current.');
    return;
  }

  if (cliArgs.dryRun) {
    console.log(`\n  DRY RUN — would update ${updates.length} rows. Re-run without --dry-run to apply.`);
    return;
  }

  // 4. Apply updates. Supabase JS doesn't bulk-update different values in one
  //    call without upsert machinery, so we loop. Logs progress every 100 rows.
  console.log(`\n  Applying ${updates.length} updates...`);
  let applied = 0;
  let failed = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('results')
      .update({ client_mentioned: u.client_mentioned })
      .eq('id', u.id);
    if (error) {
      failed++;
      console.warn(`    ✗ Failed row ${u.id}: ${error.message}`);
    } else {
      applied++;
    }
    if ((applied + failed) % 100 === 0) {
      console.log(`    Progress: ${applied + failed}/${updates.length} (${applied} ok, ${failed} err)`);
    }
  }

  console.log(`\n  ✓ Backfill complete. ${applied} rows updated, ${failed} failed.`);
}

main().catch((err) => {
  console.error('\nFatal:', err);
  process.exit(1);
});
