/**
 * Batch Claude Sonnet 4.6 Check Script
 *
 * Processes 250 prompts through Claude API
 * Results stored in format compatible with ClaudeService
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    prompts: './top-250-prompts.json',
    output: './claude-batch-results.json',
    clientId: null,
    libraryId: null,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompts' && args[i + 1]) parsed.prompts = args[++i];
    if (args[i] === '--output' && args[i + 1]) parsed.output = args[++i];
    if (args[i] === '--client-id' && args[i + 1]) parsed.clientId = args[++i];
    if (args[i] === '--library-id' && args[i + 1]) parsed.libraryId = args[++i];
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Supabase helpers (optional — only when --client-id and --library-id given)
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
    if (!url || !key || key.startsWith('<')) { console.log('  ⚠ Supabase not configured — skipping DB writes'); return; }
    supabase = createClient(url, key);
    const { data, error } = await supabase.from('runs').insert({
      client_id: cliArgs.clientId,
      library_id: cliArgs.libraryId,
      platform: 'claude',
      prompt_count: 0,
      mention_count: 0,
      mention_rate: 0,
      metadata: { script: 'batch-claude-check.js', startedAt: new Date().toISOString() },
    }).select('id').single();
    if (error) { console.warn('  ⚠ Supabase createRun:', error.message); supabase = null; return; }
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
      platform: 'claude',
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
        script: 'batch-claude-check.js',
        completedAt: new Date().toISOString(),
        successCount,
        errorCount,
      },
    }).eq('id', supabaseRunId);
    console.log(`\n✓ Supabase run finalized: ${supabaseRunId}`);
  } catch (e) { console.warn('  ⚠ Supabase finalize failed:', e.message); }
}

const cliArgs = parseArgs();

// Configuration
const CLAUDE_ENDPOINT = 'http://localhost:3000/api/claude'; // Use API route for rate limiting
const DELAY_MS = 3500; // 3.5 seconds between requests (3s rate limit + 0.5s safety buffer)

// Load 250 prompts (same sample as Google AI Overviews and Gemini)
const top250Prompts = JSON.parse(fs.readFileSync(cliArgs.prompts, 'utf8'));

// Results storage
const results = [];
let requestCount = 0;
let successCount = 0;
let errorCount = 0;

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make HTTP POST request
 */
function makeRequest(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = (urlObj.protocol === 'https:' ? https : require('http')).request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Check single prompt with Claude
 */
async function checkPrompt(promptData, index, total) {
  const { promptId, topicId, promptText, topicName } = promptData;

  console.log(`\n[${index + 1}/${total}] Checking: "${promptText.substring(0, 60)}..."`);
  console.log(`    Topic: ${topicName} (${topicId})`);

  try {
    // Call API route
    requestCount++;
    const data = await makeRequest(CLAUDE_ENDPOINT, {
      prompt: promptText,
      promptId,
      topicId,
    });

    // Check for client mention
    const clientMentioned = checkClientMention(data.responseText, data.citations);

    // Build result
    const result = {
      promptId,
      topicId,
      responseText: data.responseText.substring(0, 1000), // Limit size
      citations: data.citations || [],
      clientMentioned,
      timestamp: new Date().toISOString(),
    };

    results.push(result);
    successCount++;

    // Write to Supabase (non-blocking)
    await saveResultToSupabase(result, promptData);

    console.log(`    ✓ Response length: ${data.responseText.length} chars`);
    console.log(`    ✓ Citations: ${data.citations.length}`);
    console.log(`    ✓ Client Mentioned: ${clientMentioned ? 'YES' : 'NO'}`);

    return result;

  } catch (error) {
    errorCount++;
    console.error(`    ✗ Error: ${error.message}`);

    // Store error result
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

/**
 * Check if client is mentioned in response or citations
 */
function checkClientMention(responseText, citations) {
  const lowerText = responseText.toLowerCase();

  // Check for J.Crew mention in text
  if (lowerText.includes('j.crew') || lowerText.includes('j crew') || lowerText.includes('jcrew')) {
    return true;
  }

  // Check citations for client domains
  for (const url of citations) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('jcrew.com') || lowerUrl.includes('j-crew')) {
      return true;
    }
  }

  return false;
}

/**
 * Main batch processing
 */
async function main() {
  console.log('='.repeat(70));
  console.log('Claude Sonnet 4.6 Batch Check');
  console.log('='.repeat(70));
  console.log(`Processing: ${top250Prompts.length} prompts`);
  console.log(`API Endpoint: ${CLAUDE_ENDPOINT}`);
  console.log(`Delay: ${DELAY_MS}ms between requests`);
  console.log(`Estimated Duration: ~${Math.round((top250Prompts.length * DELAY_MS) / 1000 / 60)} minutes`);
  console.log('='.repeat(70));

  // Initialize Supabase (if --client-id and --library-id provided)
  await initSupabase();

  const startTime = Date.now();

  // Process each prompt
  for (let i = 0; i < top250Prompts.length; i++) {
    await checkPrompt(top250Prompts[i], i, top250Prompts.length);

    // Rate limiting delay (except for last request)
    if (i < top250Prompts.length - 1) {
      await sleep(DELAY_MS);
    }

    // Progress update every 25 prompts
    if ((i + 1) % 25 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.round((top250Prompts.length - i - 1) * DELAY_MS / 1000);
      console.log(`\n--- Progress: ${i + 1}/${top250Prompts.length} (${Math.round((i + 1) / top250Prompts.length * 100)}%) | Elapsed: ${elapsed}s | Remaining: ~${remaining}s ---\n`);
    }
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('BATCH COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total Prompts: ${top250Prompts.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Requests Made: ${requestCount}`);
  console.log(`Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
  console.log('='.repeat(70));

  // Calculate stats
  const responsesWithCitations = results.filter(r => r.citations.length > 0).length;
  const clientMentions = results.filter(r => r.clientMentioned).length;
  const totalCitations = results.reduce((sum, r) => sum + r.citations.length, 0);

  console.log('\nSTATS:');
  console.log(`  Responses with Citations: ${responsesWithCitations} (${((responsesWithCitations/results.length)*100).toFixed(1)}%)`);
  console.log(`  Client Mentions: ${clientMentions} (${((clientMentions/results.length)*100).toFixed(1)}%)`);
  console.log(`  Total Citations: ${totalCitations}`);
  console.log(`  Avg Citations/Response: ${(totalCitations/results.length).toFixed(1)}`);

  // Save results
  const outputFile = cliArgs.output;
  fs.writeFileSync(outputFile, JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      promptCount: top250Prompts.length,
      requestsUsed: requestCount,
      successCount,
      errorCount,
      duration,
    },
    results,
  }, null, 2));

  console.log(`\n✓ Results saved to: ${outputFile}`);

  // Finalize Supabase run
  await finalizeSupabaseRun();

  console.log('\nNext steps:');
  console.log('  1. Copy results to public: cp claude-batch-results.json ../public/scripts/');
  console.log('  2. Import via HTML page or localStorage');
  console.log('  3. View data at: http://localhost:3000/compare');
}

// Run
main().catch(console.error);
