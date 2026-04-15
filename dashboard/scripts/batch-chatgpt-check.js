/**
 * Batch ChatGPT (OpenAI GPT-4o-mini) Check Script
 *
 * Processes prompts through the OpenAI /v1/chat/completions API directly
 * (no localhost route). Uses gpt-4o-mini for cost efficiency — at 250
 * prompts/night this costs ~$0.30/month vs ~$9/month with gpt-4o. Swap
 * MODEL to 'gpt-4o' if higher-quality responses are needed.
 *
 * TODO: the platform tag is 'chatgpt_search' to match the existing
 * PLATFORM_META registry, but this runner calls the plain chat/completions
 * endpoint — it is NOT ChatGPT Search (which uses OpenAI's Responses API
 * with web search grounding). The GPT-4o-mini path has no web access and
 * therefore no citations. When the real ChatGPT Search integration lands,
 * split this into `chatgpt` (plain) and `chatgpt_search` (grounded).
 *
 * Results are written to Supabase when --client-id and --library-id are
 * passed; otherwise they're saved locally as JSON only.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    prompts: './top-250-prompts.json',
    output: './chatgpt-batch-results.json',
    clientId: null,
    libraryId: null,
    limit: null,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompts' && args[i + 1]) parsed.prompts = args[++i];
    if (args[i] === '--output' && args[i + 1]) parsed.output = args[++i];
    if (args[i] === '--client-id' && args[i + 1]) parsed.clientId = args[++i];
    if (args[i] === '--library-id' && args[i + 1]) parsed.libraryId = args[++i];
    if (args[i] === '--limit' && args[i + 1]) parsed.limit = parseInt(args[++i], 10);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Supabase helpers (only active when --client-id and --library-id given)
// ---------------------------------------------------------------------------
let supabase = null;
let supabaseRunId = null;

async function initSupabase() {
  if (!cliArgs.clientId || !cliArgs.libraryId) return;
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
    const { createClient } = require('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || key.startsWith('<')) {
      console.log('  ⚠ Supabase not configured — skipping DB writes');
      return;
    }
    supabase = createClient(url, key);
    const { data, error } = await supabase.from('runs').insert({
      client_id: cliArgs.clientId,
      library_id: cliArgs.libraryId,
      platform: 'chatgpt_search',
      run_date: new Date().toISOString().split('T')[0],
      prompt_count: 0,
      mention_count: 0,
      mention_rate: 0,
      metadata: { script: 'batch-chatgpt-check.js', startedAt: new Date().toISOString() },
    }).select('id').single();
    if (error) {
      console.warn('  ⚠ Supabase createRun:', error.message);
      supabase = null;
      return;
    }
    supabaseRunId = data.id;
    console.log(`  ✓ Supabase run created: ${supabaseRunId}`);
  } catch (e) {
    console.warn('  ⚠ Supabase init failed:', e.message);
    supabase = null;
  }
}

async function saveResultToSupabase(result, promptData) {
  if (!supabase || !supabaseRunId) return;
  try {
    await supabase.from('results').insert({
      run_id: supabaseRunId,
      prompt_id: result.promptId,
      topic_id: result.topicId,
      topic_name: promptData.topicName || '',
      isotope: promptData.isotope || null,
      intent_stage: promptData.intent_stage || null,
      platform: 'chatgpt_search',
      response_text: result.responseText || '',
      client_mentioned: result.clientMentioned || false,
      mention_count: 0,
      first_mention: false,
      citations: result.citations || [],
      citation_count: (result.citations || []).length,
    });
  } catch (e) { /* non-fatal */ }
}

async function finalizeSupabaseRun() {
  if (!supabase || !supabaseRunId) return;
  try {
    const mentionCount = results.filter(r => r.clientMentioned).length;
    const total = results.filter(r => !r.error).length;
    await supabase.from('runs').update({
      prompt_count: total,
      mention_count: mentionCount,
      mention_rate: total > 0 ? mentionCount / total : 0,
      metadata: {
        script: 'batch-chatgpt-check.js',
        completedAt: new Date().toISOString(),
        successCount,
        errorCount,
      },
    }).eq('id', supabaseRunId);
    console.log(`\n✓ Supabase run finalized: ${supabaseRunId}`);
  } catch (e) {
    console.warn('  ⚠ Supabase finalize failed:', e.message);
  }
}

const cliArgs = parseArgs();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// Load env before reading OPENAI_API_KEY. dotenv no-ops in CI where secrets
// arrive via process.env directly.
try {
  const dotenv = require('dotenv');
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
} catch { /* optional */ }

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
// Swap to 'gpt-4o' if higher quality is needed. gpt-4o-mini is ~30× cheaper
// for this workload (~$0.30/month nightly vs ~$9/month with gpt-4o).
const MODEL = 'gpt-4o-mini';
// 1200ms delay targets 50 rpm. OpenAI tier 1 allows 500 rpm for gpt-4o-mini,
// so this is very conservative — safe for any tier. Drop to 150ms if you
// want the ~8× speedup and you're on tier 1 or higher.
const DELAY_MS = 1200;

// Load prompts
const allPrompts = JSON.parse(fs.readFileSync(cliArgs.prompts, 'utf8'));
const topPrompts = cliArgs.limit && cliArgs.limit > 0
  ? allPrompts.slice(0, cliArgs.limit)
  : allPrompts;
if (cliArgs.limit) {
  console.log(`  Limit applied: ${topPrompts.length}/${allPrompts.length} prompts`);
}

// Results storage
const results = [];
let requestCount = 0;
let successCount = 0;
let errorCount = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// OpenAI API call (direct — no localhost route)
// ---------------------------------------------------------------------------
async function callOpenAI(promptText) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: promptText }],
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const responseText = data.choices?.[0]?.message?.content ?? '';
  // OpenAI's chat/completions endpoint does not return citations — gpt-4o-mini
  // has no web search grounding. Always empty. See TODO at top of file.
  const citations = [];
  return { responseText, citations };
}

// ---------------------------------------------------------------------------
// Client mention detection
// ---------------------------------------------------------------------------
function checkClientMention(responseText, citations) {
  const lowerText = responseText.toLowerCase();
  if (lowerText.includes('j.crew') || lowerText.includes('j crew') || lowerText.includes('jcrew')) {
    return true;
  }
  for (const url of citations) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('jcrew.com') || lowerUrl.includes('j-crew')) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
async function checkPrompt(promptData, index, total) {
  const { promptId, topicId, promptText, topicName } = promptData;

  console.log(`\n[${index + 1}/${total}] Checking: "${promptText.substring(0, 60)}..."`);
  console.log(`    Topic: ${topicName} (${topicId})`);

  try {
    requestCount++;
    const data = await callOpenAI(promptText);
    const clientMentioned = checkClientMention(data.responseText, data.citations);

    const result = {
      promptId,
      topicId,
      responseText: data.responseText.substring(0, 1000),
      citations: data.citations,
      clientMentioned,
      timestamp: new Date().toISOString(),
    };
    results.push(result);
    successCount++;

    await saveResultToSupabase(result, promptData);

    console.log(`    ✓ Response length: ${data.responseText.length} chars`);
    console.log(`    ✓ Client Mentioned: ${clientMentioned ? 'YES' : 'NO'}`);
    return result;
  } catch (error) {
    errorCount++;
    console.error(`    ✗ Error: ${error.message}`);
    const errorResult = {
      promptId,
      topicId,
      responseText: '',
      citations: [],
      clientMentioned: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    };
    results.push(errorResult);
    return errorResult;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('OpenAI ChatGPT (gpt-4o-mini) Batch Check');
  console.log('='.repeat(70));
  console.log(`Processing: ${topPrompts.length} prompts`);
  console.log(`Model: ${MODEL}`);
  console.log(`API Endpoint: ${OPENAI_ENDPOINT}`);
  console.log(`Delay: ${DELAY_MS}ms between requests`);
  console.log(`Estimated Duration: ~${Math.round((topPrompts.length * DELAY_MS) / 1000 / 60)} minutes`);
  console.log('='.repeat(70));

  if (!OPENAI_API_KEY) {
    console.error('\n✗ OPENAI_API_KEY is not set in the environment.');
    console.error('  Set it in dashboard/.env.local locally, or as a GitHub Actions secret in CI.');
    process.exit(1);
  }

  await initSupabase();

  const startTime = Date.now();

  for (let i = 0; i < topPrompts.length; i++) {
    await checkPrompt(topPrompts[i], i, topPrompts.length);

    if (i < topPrompts.length - 1) {
      await sleep(DELAY_MS);
    }

    if ((i + 1) % 10 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.round((topPrompts.length - i - 1) * DELAY_MS / 1000);
      console.log(`\n--- Progress: ${i + 1}/${topPrompts.length} (${Math.round((i + 1) / topPrompts.length * 100)}%) | Elapsed: ${elapsed}s | Remaining: ~${remaining}s ---\n`);
    }
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  console.log('\n' + '='.repeat(70));
  console.log('BATCH COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total Prompts: ${topPrompts.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Requests Made: ${requestCount}`);
  console.log(`Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
  console.log('='.repeat(70));

  const clientMentions = results.filter(r => r.clientMentioned).length;

  console.log('\nSTATS:');
  console.log(`  Client Mentions: ${clientMentions} (${((clientMentions/results.length)*100).toFixed(1)}%)`);
  console.log(`  Note: gpt-4o-mini has no web grounding — citation count is always 0.`);

  const outputFile = cliArgs.output;
  fs.writeFileSync(outputFile, JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      promptCount: topPrompts.length,
      requestsUsed: requestCount,
      successCount,
      errorCount,
      duration,
    },
    results,
  }, null, 2));

  console.log(`\n✓ Results saved to: ${outputFile}`);

  await finalizeSupabaseRun();

  if (supabase && supabaseRunId) {
    console.log(`\n✓ Wrote ${successCount} ChatGPT results to Supabase run ${supabaseRunId}`);
  } else {
    console.log('\nNote: Supabase writes skipped (no --client-id/--library-id or env missing).');
    console.log(`Local results at: ${outputFile}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
