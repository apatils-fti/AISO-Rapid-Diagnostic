const fs = require('fs');
const path = require('path');

// Load API key
const envPath = path.resolve(__dirname, '../../dashboard/.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error('ANTHROPIC_API_KEY not found'); process.exit(1); }

const MODEL = 'claude-sonnet-4-6';
const DELAY_MS = 3500;

const prompts = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../output/jcrew-top-250.json'), 'utf-8')
);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractCitations(text) {
  const cits = [];
  let m;
  const mdRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((m = mdRe.exec(text)) !== null) {
    if (m[2] && m[2].startsWith('http')) cits.push(m[2]);
  }
  const urlRe = /https?:\/\/[^\s<>"{}|\^`[\]]+/g;
  for (const u of (text.match(urlRe) || [])) {
    if (!cits.includes(u)) cits.push(u);
  }
  return [...new Set(cits)];
}

function checkClientMention(text, citations) {
  const l = text.toLowerCase();
  if (l.includes('j.crew') || l.includes('j crew') || l.includes('jcrew')) return true;
  for (const u of citations) {
    const lu = u.toLowerCase();
    if (lu.includes('jcrew.com') || lu.includes('j-crew')) return true;
  }
  return false;
}

async function callClaude(prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.status === 429) {
        const wait = parseInt(res.headers.get('retry-after') || '10', 10);
        console.log(`  429 rate limited, waiting ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`);
      const data = await res.json();
      let text = '';
      for (const b of data.content) { if (b.type === 'text') text += b.text; }
      return { responseText: text, citations: extractCitations(text) };
    } catch (err) {
      if (attempt < retries) {
        const wait = 2000 * Math.pow(2, attempt);
        console.log(`  Error, retrying in ${wait}ms: ${err.message}`);
        await sleep(wait);
      } else throw err;
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Full Batch: 250 prompts → Claude Sonnet 4.6');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Prompts: ${prompts.length}`);
  console.log(`Delay: ${DELAY_MS}ms | Est: ~${Math.round(prompts.length * DELAY_MS / 60000)}min\n`);

  const results = [];
  let successCount = 0, errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < prompts.length; i++) {
    const { promptId, topicId, promptText, topicName } = prompts[i];
    const tag = `[${String(i+1).padStart(3)}/${prompts.length}]`;

    try {
      const { responseText, citations } = await callClaude(promptText);
      const clientMentioned = checkClientMention(responseText, citations);
      results.push({
        promptId, topicId,
        responseText: responseText.substring(0, 1000),
        citations, clientMentioned,
        timestamp: new Date().toISOString(),
      });
      successCount++;
      const mentionFlag = clientMentioned ? '★' : ' ';
      console.log(`${tag} ${mentionFlag} ${responseText.length}ch ${promptText.substring(0, 55)}...`);
    } catch (err) {
      errorCount++;
      results.push({
        promptId, topicId,
        responseText: '', citations: [],
        clientMentioned: false,
        timestamp: new Date().toISOString(),
        error: err.message,
      });
      console.log(`${tag} ✗ ${err.message.substring(0, 80)}`);
    }

    if (i < prompts.length - 1) await sleep(DELAY_MS);

    if ((i + 1) % 50 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const remaining = Math.round((prompts.length - i - 1) * DELAY_MS / 1000);
      const mentions = results.filter(r => r.clientMentioned).length;
      console.log(`\n--- ${i+1}/${prompts.length} done | ${elapsed}s elapsed | ~${remaining}s left | mentions: ${mentions} ---\n`);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  const output = {
    metadata: { generatedAt: new Date().toISOString(), promptCount: prompts.length, requestsUsed: prompts.length, successCount, errorCount, duration },
    results,
  };

  const outPath = path.resolve(__dirname, '../../dashboard/scripts/jcrew-generated-batch-results.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const mentions = results.filter(r => r.clientMentioned).length;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Batch Complete');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Duration: ${Math.floor(duration/60)}m ${duration%60}s`);
  console.log(`  Success: ${successCount} | Errors: ${errorCount}`);
  console.log(`  Client mentions: ${mentions}/${results.length} (${(mentions/results.length*100).toFixed(1)}%)`);
  console.log(`  Output: ${outPath}`);
}

main().catch(err => { console.error('Batch failed:', err); process.exit(1); });
