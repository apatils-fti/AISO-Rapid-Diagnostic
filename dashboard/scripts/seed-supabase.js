/**
 * One-time seed script: imports existing J.Crew data into Supabase.
 *
 * Usage:
 *   cd dashboard/scripts
 *   node seed-supabase.js
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in ../.env.local
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_KEY.startsWith('<')) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Existing IDs from prior seed run
const CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';
const LIBRARY_ID = '435d590e-07f7-4421-8b24-fbf8c3ea1bd1';

const CHUNK_SIZE = 50;

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function loadJson(filePath) {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Build prompt lookup from top-250
function buildPromptMap() {
  const prompts = loadJson(path.resolve(__dirname, 'top-250-prompts.json'));
  if (!prompts) return {};
  const map = {};
  for (const p of prompts) map[p.promptId] = p;
  return map;
}

/**
 * Import a batch run into Supabase.
 *
 * @param {object} opts
 * @param {string} opts.platform       - Platform key for the runs table
 * @param {string} opts.label          - Display label for logging
 * @param {string} opts.filePath       - Absolute path to the batch JSON file
 * @param {string} opts.textField      - Field name for response text (responseText | overviewText)
 * @param {string} opts.citationsField - Field name for citations array (citations | citedSources)
 * @param {object} promptMap           - promptId → {topicName, isotope, category}
 */
async function importBatchRun(opts, promptMap) {
  const { platform, label, filePath, textField, citationsField } = opts;

  console.log(`\nImporting ${label}...`);
  console.log(`  File: ${filePath}`);

  const batch = loadJson(filePath);
  if (!batch || !batch.results) {
    console.log(`  ⚠ File not found or empty — skipping`);
    return;
  }

  console.log(`  Raw results: ${batch.results.length}`);

  // Normalize and filter to results with actual text
  const validResults = [];
  for (const r of batch.results) {
    const text = r[textField] || '';
    if (text.length === 0) continue;
    validResults.push({
      promptId: r.promptId,
      topicId: r.topicId,
      responseText: text,
      citations: r[citationsField] || [],
      clientMentioned: r.clientMentioned || false,
      timestamp: r.timestamp || '',
    });
  }

  console.log(`  Valid (with text): ${validResults.length}`);

  if (validResults.length === 0) {
    console.log(`  ⚠ No valid results — skipping`);
    return;
  }

  const mentionCount = validResults.filter((r) => r.clientMentioned).length;
  const mentionRate = mentionCount / validResults.length;

  // Create run record
  const { data: run, error: runErr } = await supabase
    .from('runs')
    .insert({
      client_id: CLIENT_ID,
      library_id: LIBRARY_ID,
      platform,
      prompt_count: validResults.length,
      mention_count: mentionCount,
      mention_rate: mentionRate,
      run_date: batch.metadata?.generatedAt || new Date().toISOString(),
      metadata: {
        source: 'seed-script',
        originalFile: path.basename(filePath),
        originalMetadata: batch.metadata,
      },
    })
    .select('id')
    .single();

  if (runErr) {
    console.error(`  ✗ Failed to create run: ${runErr.message}`);
    return;
  }

  const runId = run.id;

  // Insert results in chunks
  const rows = validResults.map((r) => {
    const prompt = promptMap[r.promptId];
    return {
      run_id: runId,
      prompt_id: r.promptId,
      topic_id: r.topicId,
      topic_name: prompt?.topicName || '',
      isotope: prompt?.isotope || null,
      platform,
      response_text: r.responseText.substring(0, 2000),
      client_mentioned: r.clientMentioned,
      mention_count: 0,
      first_mention: false,
      citations: r.citations,
      citation_count: r.citations.length,
    };
  });

  let saved = 0;
  for (const chunk of chunks(rows, CHUNK_SIZE)) {
    const { error } = await supabase.from('results').insert(chunk);
    if (error) {
      console.warn(`  ⚠ Chunk error: ${error.message}`);
    } else {
      saved += chunk.length;
    }
  }

  console.log(`  ✓ Run created: ${runId}`);
  console.log(`    Results: ${saved}/${validResults.length}`);
  console.log(`    Mention rate: ${(mentionRate * 100).toFixed(1)}%`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('  Supabase Seed Script — J.Crew (5 platforms)');
  console.log('='.repeat(60));
  console.log(`  Client ID:  ${CLIENT_ID}`);
  console.log(`  Library ID: ${LIBRARY_ID}`);

  const promptMap = buildPromptMap();
  console.log(`  Prompt map: ${Object.keys(promptMap).length} entries`);

  const scriptDir = __dirname;
  const publicDir = path.resolve(scriptDir, '..', 'public', 'scripts');

  // -----------------------------------------------------------------------
  // 1. Claude — use public/scripts/ (has 244 successful results)
  //    NOT scripts/claude-batch-results.json (250 errors, 0 success)
  // -----------------------------------------------------------------------
  await importBatchRun({
    platform: 'claude',
    label: 'Claude Sonnet 4.6',
    filePath: path.join(publicDir, 'claude-batch-results.json'),
    textField: 'responseText',
    citationsField: 'citations',
  }, promptMap);

  // -----------------------------------------------------------------------
  // 2. Gemini — use scripts/ (has actual results)
  // -----------------------------------------------------------------------
  await importBatchRun({
    platform: 'gemini',
    label: 'Gemini 2.5 Flash',
    filePath: path.join(scriptDir, 'gemini-batch-results.json'),
    textField: 'responseText',
    citationsField: 'citations',
  }, promptMap);

  // -----------------------------------------------------------------------
  // 3. Perplexity — use public/scripts/ (1364 results with text)
  // -----------------------------------------------------------------------
  await importBatchRun({
    platform: 'perplexity',
    label: 'Perplexity',
    filePath: path.join(publicDir, 'perplexity-batch-results.json'),
    textField: 'responseText',
    citationsField: 'citations',
  }, promptMap);

  // -----------------------------------------------------------------------
  // 4. ChatGPT Search — use public/scripts/ (1364 results with text)
  // -----------------------------------------------------------------------
  await importBatchRun({
    platform: 'chatgpt_search',
    label: 'ChatGPT Search',
    filePath: path.join(publicDir, 'chatgpt-batch-results.json'),
    textField: 'responseText',
    citationsField: 'citations',
  }, promptMap);

  // -----------------------------------------------------------------------
  // 5. Google AI Overview — uses overviewText/citedSources fields
  // -----------------------------------------------------------------------
  await importBatchRun({
    platform: 'google_ai_overview',
    label: 'Google AI Overview',
    filePath: path.join(scriptDir, 'google-batch-results.json'),
    textField: 'overviewText',
    citationsField: 'citedSources',
  }, promptMap);

  // -----------------------------------------------------------------------
  // Done
  // -----------------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('  Seed complete!');
  console.log('='.repeat(60));
  console.log(`\n  Client ID:  ${CLIENT_ID}`);
  console.log(`  Library ID: ${LIBRARY_ID}`);
  console.log('\n  Use these IDs with future batch scripts:');
  console.log(`    node batch-claude-check.js --client-id ${CLIENT_ID} --library-id ${LIBRARY_ID}`);
  console.log(`    node batch-gemini-check.js --client-id ${CLIENT_ID} --library-id ${LIBRARY_ID}`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
