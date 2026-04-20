#!/usr/bin/env node

/**
 * Automated Client Onboarding Script
 *
 * Chains all onboarding steps into a single command:
 *   1. Generate prompt library
 *   2. Run Claude batch
 *   3. Run Gemini batch
 *   4. Enrich sentiment (VADER)
 *   5. Enrich competitor mentions
 *   6. Enrich citation sources
 *   7. Verify results
 *
 * Resumable: if interrupted, skip completed steps.
 *
 * Usage:
 *   node scripts/onboard-client.js --config configs/fti.json
 *   node scripts/onboard-client.js --config configs/fti.json --resume
 *   node scripts/onboard-client.js --config configs/fti.json --skip-generate
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env.local if present (local dev). In CI the file is absent and
// secrets arrive via process.env directly — dotenv is a no-op when the
// file is missing, but we guard explicitly so the intent is obvious.
const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  config({ path: envPath });
}

// ─── CLI args ────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
const configPath = getArg('--config');
const resume = args.includes('--resume');
const skipGenerate = args.includes('--skip-generate');
// --limit N caps how many prompts each batch runner processes. Used for
// smoke-test runs in CI (workflow_dispatch default is 10). Omit for a
// full run.
const limit = getArg('--limit');
const limitArg = limit ? ` --limit ${limit}` : '';
const promptsPath = getArg('--prompts');
const promptsArg = promptsPath ? ` --prompts ${promptsPath}` : '';

if (!configPath) {
  console.error('Usage: node scripts/onboard-client.js --config configs/fti.json');
  process.exit(1);
}

// ─── Supabase ────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── State tracking ─────────────────────────────────────────
const stateFile = resolve(__dirname, `.onboard-state-${configPath.replace(/[\/\\]/g, '-')}.json`);

function loadState() {
  if (resume && existsSync(stateFile)) {
    return JSON.parse(readFileSync(stateFile, 'utf-8'));
  }
  return { completedSteps: [], clientId: null, libraryId: null };
}

function saveState(state) {
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function isCompleted(state, step) {
  return state.completedSteps.includes(step);
}

function markCompleted(state, step) {
  state.completedSteps.push(step);
  saveState(state);
}

// ─── Step runner ─────────────────────────────────────────────
function runStep(name, command, state) {
  if (isCompleted(state, name)) {
    console.log(`  ⏭  ${name} (already completed, skipping)`);
    return;
  }

  console.log(`\n  ▶  ${name}`);
  console.log(`     ${command}\n`);

  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: resolve(__dirname, '..'),
      env: { ...process.env },
      timeout: 600000, // 10 min per step
    });
    markCompleted(state, name);
    console.log(`  ✓  ${name} completed`);
  } catch (err) {
    console.error(`\n  ✗  ${name} FAILED`);
    console.error(`     Exit code: ${err.status}`);
    console.error(`     Resume with: node scripts/onboard-client.js --config ${configPath} --resume`);
    saveState(state);
    process.exit(1);
  }
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  AISO Client Onboarding');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Config: ${configPath}`);
  if (resume) console.log('  Mode: RESUME');
  console.log('');

  const state = loadState();
  const generatorDir = resolve(__dirname, '..', '..', 'generator');
  const dashboardDir = resolve(__dirname, '..');

  // Step 1: Generate prompt library
  if (!skipGenerate) {
    runStep(
      'Generate prompt library',
      `cd "${generatorDir}" && npx tsx src/generate.ts --config ${configPath}`,
      state
    );
  } else {
    console.log('  ⏭  Generate prompt library (--skip-generate)');
  }

  // After generation, find client_id from Supabase
  if (!state.clientId) {
    const clientConfig = JSON.parse(readFileSync(resolve(generatorDir, configPath), 'utf-8'));
    const clientName = clientConfig.client?.name || clientConfig.brand;
    if (clientName) {
      const { data } = await supabase
        .from('clients')
        .select('id')
        .eq('name', clientName)
        .limit(1)
        .single();
      if (data?.id) {
        state.clientId = data.id;
        saveState(state);
        console.log(`  Found client_id: ${state.clientId}`);
      }
    }
  }

  if (!state.clientId) {
    console.error('  ✗  Could not find client_id in Supabase. Was the prompt library generated?');
    process.exit(1);
  }

  // Look up the most recent prompt_libraries row for this client.
  // Batch runners require both --client-id and --library-id to enable
  // their Supabase write path; without a libraryId they fall back to
  // local-JSON-only mode, which is useless in CI.
  if (!state.libraryId) {
    const { data: lib } = await supabase
      .from('prompt_libraries')
      .select('id')
      .eq('client_id', state.clientId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();
    if (lib?.id) {
      state.libraryId = lib.id;
      saveState(state);
      console.log(`  Found library_id: ${state.libraryId}`);
    }
  }

  if (!state.libraryId) {
    console.error('  ✗  No prompt_libraries row found for this client in Supabase.');
    console.error('     Generate a library first (drop --skip-generate), or create a');
    console.error('     placeholder row in the prompt_libraries table by hand.');
    process.exit(1);
  }

  // Build the Supabase-context args passed to each batch runner.
  // Without these, the runners short-circuit Supabase writes on line 39
  // of their initSupabase() and only write to a local JSON file.
  const supabaseArgs = ` --client-id ${state.clientId} --library-id ${state.libraryId}`;

  // Step 2: Run Claude batch
  runStep(
    'Claude batch collection',
    `cd "${dashboardDir}" && node scripts/batch-claude-check.js${promptsArg}${limitArg}${supabaseArgs}`,
    state
  );

  // Step 3: Run Gemini batch
  runStep(
    'Gemini batch collection',
    `cd "${dashboardDir}" && node scripts/batch-gemini-check.js${promptsArg}${limitArg}${supabaseArgs}`,
    state
  );

  // Step 4: Run Perplexity batch (direct API call, no localhost dependency)
  runStep(
    'Perplexity batch collection',
    `cd "${dashboardDir}" && node scripts/batch-perplexity-check.js${promptsArg}${limitArg}${supabaseArgs}`,
    state
  );

  // Step 5: Run ChatGPT batch (direct API call, no localhost dependency)
  runStep(
    'ChatGPT batch collection',
    `cd "${dashboardDir}" && node scripts/batch-chatgpt-check.js${promptsArg}${limitArg}${supabaseArgs}`,
    state
  );

  // Step 6: Enrich sentiment (VADER)
  runStep(
    'VADER sentiment enrichment',
    `cd "${dashboardDir}" && node scripts/enrich-sentiment-vader.js`,
    state
  );

  // Step 5: Enrich competitor mentions
  runStep(
    'Competitor mentions enrichment',
    `cd "${dashboardDir}" && node scripts/enrich-competitor-mentions.js`,
    state
  );

  // Step 6: Enrich citation sources
  runStep(
    'Citation source enrichment',
    `cd "${dashboardDir}" && node scripts/enrich-citation-sources.js`,
    state
  );

  // Step 7: Verify results
  console.log('\n  ▶  Verify results');
  const { data: runs } = await supabase
    .from('runs')
    .select('id, platform, mention_rate, prompt_count')
    .eq('client_id', state.clientId);

  const { count } = await supabase
    .from('results')
    .select('id', { count: 'exact', head: true })
    .in('run_id', (runs || []).map(r => r.id));

  const enrichedCount = await supabase
    .from('results')
    .select('id', { count: 'exact', head: true })
    .in('run_id', (runs || []).map(r => r.id))
    .not('sentiment', 'is', null);

  markCompleted(state, 'Verify results');

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Onboarding Complete!');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Client ID:    ${state.clientId}`);
  console.log(`  Platforms:    ${(runs || []).map(r => r.platform).join(', ')}`);
  console.log(`  Total runs:   ${(runs || []).length}`);
  console.log(`  Total results: ${count ?? 0}`);
  console.log(`  Enriched:     ${enrichedCount?.count ?? 0}`);
  if (runs && runs.length > 0) {
    const avgRate = runs.reduce((s, r) => s + (r.mention_rate || 0), 0) / runs.length;
    console.log(`  Avg mention:  ${(avgRate * 100).toFixed(1)}%`);
  }
  console.log(`\n  View dashboard: http://localhost:3000/dashboard?client=${state.clientId}`);

  // Clean up state file
  try { require('fs').unlinkSync(stateFile); } catch {}
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
