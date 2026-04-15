/**
 * Smoke test: Run first 20 prompts from generated library through Claude
 * and verify output matches claude-batch-results.json format exactly.
 *
 * Usage: node scripts/smoke-test.js
 */

const fs = require('fs');
const path = require('path');

// Load API key from dashboard/.env.local
const envPath = path.resolve(__dirname, '../../dashboard/.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not found');
  process.exit(1);
}

const MODEL = 'claude-sonnet-4-6';
const DELAY_MS = 3500;
const PROMPT_COUNT = 20;

// Load first 20 prompts from generated library
const allPrompts = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../output/jcrew-top-250.json'), 'utf-8')
);
const prompts = allPrompts.slice(0, PROMPT_COUNT);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractCitations(text) {
  const citations = [];
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    if (match[2] && match[2].startsWith('http')) citations.push(match[2]);
  }
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const plainUrls = text.match(urlRegex) || [];
  for (const url of plainUrls) {
    if (!citations.includes(url)) citations.push(url);
  }
  return [...new Set(citations)];
}

function checkClientMention(responseText, citations) {
  const lower = responseText.toLowerCase();
  if (lower.includes('j.crew') || lower.includes('j crew') || lower.includes('jcrew')) return true;
  for (const url of citations) {
    if (url.toLowerCase().includes('jcrew.com') || url.toLowerCase().includes('j-crew')) return true;
  }
  return false;
}

async function callClaude(prompt) {
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  let responseText = '';
  for (const block of data.content) {
    if (block.type === 'text') responseText += block.text;
  }
  return { responseText, citations: extractCitations(responseText) };
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Smoke Test: 20 prompts → Claude');
  console.log('═══════════════════════════════════════════════');
  console.log(`Prompts: ${prompts.length}`);
  console.log(`Estimated time: ~${Math.round((prompts.length * DELAY_MS) / 1000)}s\n`);

  const results = [];
  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < prompts.length; i++) {
    const { promptId, topicId, promptText, topicName } = prompts[i];
    process.stdout.write(`[${i + 1}/${prompts.length}] ${promptText.substring(0, 55)}...`);

    try {
      const { responseText, citations } = await callClaude(promptText);
      const clientMentioned = checkClientMention(responseText, citations);

      results.push({
        promptId,
        topicId,
        responseText: responseText.substring(0, 1000),
        citations,
        clientMentioned,
        timestamp: new Date().toISOString(),
      });

      successCount++;
      console.log(` ✓ ${responseText.length}ch, ${citations.length}cit, mention=${clientMentioned}`);
    } catch (error) {
      errorCount++;
      console.log(` ✗ ${error.message}`);

      results.push({
        promptId,
        topicId,
        responseText: '',
        citations: [],
        clientMentioned: false,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }

    if (i < prompts.length - 1) await sleep(DELAY_MS);
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Build output in exact claude-batch-results.json format
  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      promptCount: prompts.length,
      requestsUsed: prompts.length,
      successCount,
      errorCount,
      duration,
    },
    results,
  };

  const outputPath = path.resolve(__dirname, '../output/smoke-test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  // Validate format against existing claude-batch-results.json
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Results');
  console.log('═══════════════════════════════════════════════');
  console.log(`Success: ${successCount}/${prompts.length}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Duration: ${duration}s`);

  const mentions = results.filter((r) => r.clientMentioned).length;
  console.log(`Client mentions: ${mentions}/${results.length} (${((mentions / results.length) * 100).toFixed(0)}%)`);

  // Schema validation
  const existingPath = path.resolve(__dirname, '../../dashboard/public/scripts/claude-batch-results.json');
  if (fs.existsSync(existingPath)) {
    const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));

    console.log('\n--- Format comparison ---');
    const existingMeta = Object.keys(existing.metadata).sort();
    const newMeta = Object.keys(output.metadata).sort();
    console.log(`Metadata keys match: ${JSON.stringify(existingMeta) === JSON.stringify(newMeta) ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  Existing: ${existingMeta.join(', ')}`);
    console.log(`  New:      ${newMeta.join(', ')}`);

    const existingFields = Object.keys(existing.results[0]).sort();
    const newFields = Object.keys(output.results[0]).sort();
    console.log(`Result fields match: ${JSON.stringify(existingFields) === JSON.stringify(newFields) ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  Existing: ${existingFields.join(', ')}`);
    console.log(`  New:      ${newFields.join(', ')}`);

    // Type checks on values
    const r = output.results[0];
    const checks = [
      ['promptId is string', typeof r.promptId === 'string'],
      ['topicId is string', typeof r.topicId === 'string'],
      ['responseText is string', typeof r.responseText === 'string'],
      ['citations is array', Array.isArray(r.citations)],
      ['clientMentioned is boolean', typeof r.clientMentioned === 'boolean'],
      ['timestamp is string', typeof r.timestamp === 'string'],
    ];
    console.log('\nField type checks:');
    checks.forEach(([label, ok]) => console.log(`  ${ok ? '✓' : '✗'} ${label}`));
  }

  console.log(`\nOutput: ${outputPath}`);
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
