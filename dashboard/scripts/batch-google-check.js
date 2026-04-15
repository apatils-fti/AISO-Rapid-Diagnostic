/**
 * Batch Google AI Overview Check Script
 *
 * Processes top 50 high-performing prompts through SerpApi
 * Results stored in format compatible with SerpApiService
 */

const https = require('https');
const fs = require('fs');

// Configuration
const API_KEY = '31845f2f806eef910b233436cba78a7ba3b7d84c5bdbc5a43101405598130312';
const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';
const DELAY_MS = 2000; // 2 seconds between requests
const RETRY_DELAY_MS = 5000; // 5 seconds for retries

// Load top 250 prompts
const top250Prompts = JSON.parse(fs.readFileSync('./top-250-prompts.json', 'utf8'));

// Results storage
const results = [];
let searchCount = 0;
let successCount = 0;
let errorCount = 0;

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make HTTPS request to SerpApi
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Check single prompt with SerpApi
 */
async function checkPrompt(promptData, index, total) {
  const { promptId, topicId, promptText } = promptData;

  console.log(`\n[${index + 1}/${total}] Checking: "${promptText.substring(0, 60)}..."`);
  console.log(`    Topic: ${promptData.topicName} (${topicId})`);

  try {
    // Build SerpApi URL
    const params = new URLSearchParams({
      api_key: API_KEY,
      q: promptText,
      engine: 'google',
      gl: 'us',
      hl: 'en',
    });

    const url = `${SERPAPI_ENDPOINT}?${params.toString()}`;

    // Make request
    searchCount++;
    const data = await makeRequest(url);

    // Parse AI Overview
    const answerBox = data.answer_box;
    const hasOverview = !!(answerBox && (answerBox.answer || answerBox.snippet));

    let overviewText = '';
    let citedSources = [];

    if (hasOverview) {
      overviewText = answerBox.answer || answerBox.snippet || '';

      // Extract cited sources
      if (answerBox.sources) {
        citedSources = answerBox.sources.map(s => s.link || s.url).filter(Boolean);
      } else if (answerBox.links) {
        citedSources = answerBox.links.map(l => l.link || l.url).filter(Boolean);
      }
    }

    // Check for client mentions
    const clientMentioned = citedSources.some(url =>
      url.toLowerCase().includes('jcrew.com') ||
      url.toLowerCase().includes('j.crew') ||
      url.toLowerCase().includes('j-crew')
    );

    // Build result
    const result = {
      promptId,
      topicId,
      hasOverview,
      overviewText: overviewText.substring(0, 500), // Limit size
      citedSources: citedSources.slice(0, 10), // Max 10 sources
      clientMentioned,
      timestamp: new Date().toISOString(),
    };

    results.push(result);
    successCount++;

    console.log(`    ✓ Overview: ${hasOverview ? 'YES' : 'NO'}`);
    console.log(`    ✓ Client Mentioned: ${clientMentioned ? 'YES' : 'NO'}`);
    console.log(`    ✓ Sources: ${citedSources.length}`);

    return result;

  } catch (error) {
    errorCount++;
    console.error(`    ✗ Error: ${error.message}`);

    // Store error result
    const errorResult = {
      promptId,
      topicId,
      hasOverview: false,
      overviewText: '',
      citedSources: [],
      clientMentioned: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    };

    results.push(errorResult);
    return errorResult;
  }
}

/**
 * Main batch processing
 */
async function main() {
  console.log('='.repeat(70));
  console.log('Google AI Overview Batch Check');
  console.log('='.repeat(70));
  console.log(`Processing: ${top250Prompts.length} prompts`);
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`Delay: ${DELAY_MS}ms between requests`);
  console.log(`Estimated Duration: ~${Math.round((top250Prompts.length * DELAY_MS) / 1000 / 60)} minutes`);
  console.log('='.repeat(70));

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
  console.log(`Searches Used: ${searchCount}`);
  console.log(`Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`);
  console.log('='.repeat(70));

  // Calculate stats
  const overviewsFound = results.filter(r => r.hasOverview).length;
  const clientMentions = results.filter(r => r.clientMentioned).length;
  const totalCitations = results.reduce((sum, r) => sum + r.citedSources.length, 0);

  console.log('\nSTATS:');
  console.log(`  AI Overviews Found: ${overviewsFound} (${((overviewsFound/results.length)*100).toFixed(1)}%)`);
  console.log(`  Client Mentions: ${clientMentions} (${((clientMentions/results.length)*100).toFixed(1)}%)`);
  console.log(`  Total Citations: ${totalCitations}`);
  console.log(`  Avg Citations/Overview: ${overviewsFound > 0 ? (totalCitations/overviewsFound).toFixed(1) : 0}`);

  // Save results
  const outputFile = './google-batch-results.json';
  fs.writeFileSync(outputFile, JSON.stringify({
    metadata: {
      generatedAt: new Date().toISOString(),
      promptCount: top250Prompts.length,
      searchesUsed: searchCount,
      successCount,
      errorCount,
      duration,
    },
    results,
  }, null, 2));

  console.log(`\n✓ Results saved to: ${outputFile}`);
  console.log('\nNext steps:');
  console.log('  1. Start dev server: npm run dev');
  console.log('  2. Navigate to: http://localhost:3000/import-google-results');
  console.log('  3. Click "Import Results" button');
  console.log('  4. View data at: http://localhost:3000/compare');
}

// Run
main().catch(console.error);
