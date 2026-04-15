#!/usr/bin/env node
/**
 * Enrich analyzedMetrics.json with per-platform textMetrics.
 *
 * Reads existing fixtures + Gemini/Claude batch results,
 * computes per-platform text mention metrics using the same
 * analysis logic as the collector, and writes back an enriched
 * analyzedMetrics.json with textMetrics.byPlatform and
 * textMetrics.byTopicByPlatform.
 *
 * Usage: node scripts/enrich-metrics.js
 */

const fs = require('fs');
const path = require('path');

// ── Config ──

const CLIENT_NAME = 'J.Crew';
const COMPETITORS = ['Banana Republic', 'Everlane', 'Abercrombie & Fitch', 'Gap', 'Club Monaco'];
const ALL_BRANDS = [CLIENT_NAME, ...COMPETITORS];

const FIXTURES_DIR = path.resolve(__dirname, '../src/fixtures');
const BATCH_DIR = path.resolve(__dirname, '../public/scripts');
const COLLECTOR_DATA = path.resolve(__dirname, '../../collector/data/raw-results/combined');

// ── Text analysis (mirrors collector/src/text-analysis.ts) ──

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countBrandMentions(text, brandName) {
  if (!text || !brandName) return 0;
  const regex = new RegExp(`\\b${escapeRegex(brandName)}\\b`, 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function findFirstMentionPosition(text, brandName) {
  if (!text || !brandName) return -1;
  return text.toLowerCase().indexOf(brandName.toLowerCase());
}

function analyzeTextMentions(text, clientName, competitorNames) {
  const allBrands = [clientName, ...competitorNames];
  const analyses = allBrands.map(brand => {
    const mentionCount = countBrandMentions(text, brand);
    const firstPos = findFirstMentionPosition(text, brand);
    return {
      brand,
      mentioned: mentionCount > 0,
      mentionCount,
      firstMentionPosition: mentionCount > 0 ? firstPos : null,
    };
  });

  const mentionedBrands = analyses
    .filter(a => a.mentioned)
    .sort((a, b) => (a.firstMentionPosition ?? Infinity) - (b.firstMentionPosition ?? Infinity));

  const brandResults = {};
  let totalMentions = 0;
  let clientMentions = 0;

  for (const analysis of analyses) {
    const rank = mentionedBrands.findIndex(m => m.brand === analysis.brand);
    brandResults[analysis.brand] = {
      ...analysis,
      mentionRank: rank >= 0 ? rank + 1 : null,
    };
    totalMentions += analysis.mentionCount;
    if (analysis.brand === clientName) {
      clientMentions = analysis.mentionCount;
    }
  }

  const clientResult = brandResults[clientName];
  return {
    brands: brandResults,
    totalMentions,
    firstMentionedBrand: mentionedBrands.length > 0 ? mentionedBrands[0].brand : null,
    clientShareOfVoice: totalMentions > 0 ? clientMentions / totalMentions : 0,
    clientMentioned: clientResult?.mentioned ?? false,
    clientMentionRank: clientResult?.mentionRank ?? null,
  };
}

function aggregateTextMetrics(results, clientName) {
  if (results.length === 0) {
    return {
      brandMentionRate: 0, firstMentionRate: 0, avgMentionPosition: 0,
      shareOfVoice: 0, totalResponses: 0, responsesWithMention: 0,
      responsesWithFirstMention: 0, brandMetrics: {},
    };
  }

  let responsesWithMention = 0, responsesWithFirstMention = 0;
  let positionSum = 0, positionCount = 0;
  let totalClientMentions = 0, totalAllMentions = 0;
  const brandTotals = {};

  for (const result of results) {
    if (result.clientMentioned) {
      responsesWithMention++;
      if (result.clientMentionRank === 1) responsesWithFirstMention++;
      if (result.clientMentionRank !== null) {
        positionSum += result.clientMentionRank;
        positionCount++;
      }
    }
    totalClientMentions += result.brands[clientName]?.mentionCount ?? 0;
    totalAllMentions += result.totalMentions;

    for (const [brand, data] of Object.entries(result.brands)) {
      if (!brandTotals[brand]) {
        brandTotals[brand] = { responseCount: 0, firstMentionCount: 0, totalMentionCount: 0 };
      }
      if (data.mentioned) {
        brandTotals[brand].responseCount++;
        brandTotals[brand].totalMentionCount += data.mentionCount;
        if (data.mentionRank === 1) brandTotals[brand].firstMentionCount++;
      }
    }
  }

  const totalResponses = results.length;
  const brandMetrics = {};
  for (const [brand, totals] of Object.entries(brandTotals)) {
    brandMetrics[brand] = {
      mentionRate: totalResponses > 0 ? totals.responseCount / totalResponses : 0,
      avgMentionCount: totals.responseCount > 0 ? totals.totalMentionCount / totals.responseCount : 0,
      firstMentionRate: totalResponses > 0 ? totals.firstMentionCount / totalResponses : 0,
      totalMentions: totals.totalMentionCount,
    };
  }

  return {
    brandMentionRate: totalResponses > 0 ? responsesWithMention / totalResponses : 0,
    firstMentionRate: totalResponses > 0 ? responsesWithFirstMention / totalResponses : 0,
    avgMentionPosition: positionCount > 0 ? positionSum / positionCount : 0,
    shareOfVoice: totalAllMentions > 0 ? totalClientMentions / totalAllMentions : 0,
    totalResponses, responsesWithMention, responsesWithFirstMention, brandMetrics,
  };
}

// ── Data loading ──

function getResponseText(response) {
  if (typeof response.content === 'string' && response.content.length > 0) return response.content;
  const pplx = response.choices?.[0]?.message?.content;
  if (pplx) return pplx;
  if (response.rawResponse?.output) {
    const parts = [];
    for (const block of response.rawResponse.output) {
      if (block.type === 'message' && Array.isArray(block.content)) {
        for (const item of block.content) {
          if (item.type === 'output_text' && item.text) parts.push(item.text);
        }
      }
    }
    if (parts.length > 0) return parts.join('\n');
  }
  return '';
}

function inferPlatform(model) {
  const m = (model || '').toLowerCase();
  if (m.includes('sonar') || m.includes('pplx') || m.includes('perplexity')) return 'perplexity';
  return 'chatgpt_search';
}

function loadCollectorResults() {
  const perPlatform = { perplexity: [], chatgpt_search: [] };
  const perPlatformByTopic = { perplexity: {}, chatgpt_search: {} };

  if (!fs.existsSync(COLLECTOR_DATA)) {
    console.log('  No collector data found at', COLLECTOR_DATA);
    return { perPlatform, perPlatformByTopic };
  }

  const files = fs.readdirSync(COLLECTOR_DATA).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  console.log(`  Loading ${files.length} collector result files...`);

  for (const file of files) {
    const result = JSON.parse(fs.readFileSync(path.join(COLLECTOR_DATA, file), 'utf-8'));
    const platform = inferPlatform(result.model);

    for (const run of result.runs) {
      const text = getResponseText(run.response);
      if (!text) continue;

      const analysis = analyzeTextMentions(text, CLIENT_NAME, COMPETITORS);
      perPlatform[platform].push(analysis);

      if (!perPlatformByTopic[platform][result.topicId]) {
        perPlatformByTopic[platform][result.topicId] = [];
      }
      perPlatformByTopic[platform][result.topicId].push(analysis);
    }
  }

  return { perPlatform, perPlatformByTopic };
}

function loadBatchResults(platform, filename) {
  const filepath = path.join(BATCH_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`  No batch file: ${filename}`);
    return { analyses: [], byTopic: {} };
  }

  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  const validResults = data.results.filter(r => r.responseText && r.responseText.length > 0);
  console.log(`  ${platform}: ${validResults.length} valid responses`);

  const analyses = [];
  const byTopic = {};

  for (const result of validResults) {
    const analysis = analyzeTextMentions(result.responseText, CLIENT_NAME, COMPETITORS);
    analyses.push(analysis);

    if (!byTopic[result.topicId]) byTopic[result.topicId] = [];
    byTopic[result.topicId].push(analysis);
  }

  return { analyses, byTopic };
}

// ── Main ──

function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Enrich Metrics — Per-Platform Text Analysis ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // Load existing analyzedMetrics
  const metricsPath = path.join(FIXTURES_DIR, 'analyzedMetrics.json');
  const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
  console.log('  Loaded existing analyzedMetrics.json');

  // Load collector data (Perplexity + ChatGPT)
  const { perPlatform, perPlatformByTopic } = loadCollectorResults();
  console.log(`  Perplexity: ${perPlatform.perplexity.length} responses`);
  console.log(`  ChatGPT:    ${perPlatform.chatgpt_search.length} responses`);

  // Load batch results (Gemini + Claude)
  const gemini = loadBatchResults('Gemini', 'gemini-batch-results.json');
  const claude = loadBatchResults('Claude', 'claude-batch-results.json');

  // Compute per-platform aggregated metrics
  const byPlatform = {
    perplexity: aggregateTextMetrics(perPlatform.perplexity, CLIENT_NAME),
    chatgpt_search: aggregateTextMetrics(perPlatform.chatgpt_search, CLIENT_NAME),
    gemini: aggregateTextMetrics(gemini.analyses, CLIENT_NAME),
    claude: aggregateTextMetrics(claude.analyses, CLIENT_NAME),
  };

  // Compute per-topic-per-platform metrics
  const allTopicIds = new Set([
    ...Object.keys(perPlatformByTopic.perplexity || {}),
    ...Object.keys(perPlatformByTopic.chatgpt_search || {}),
    ...Object.keys(gemini.byTopic),
    ...Object.keys(claude.byTopic),
  ]);

  const byTopicByPlatform = {};
  for (const topicId of allTopicIds) {
    byTopicByPlatform[topicId] = {
      perplexity: aggregateTextMetrics(perPlatformByTopic.perplexity?.[topicId] || [], CLIENT_NAME),
      chatgpt_search: aggregateTextMetrics(perPlatformByTopic.chatgpt_search?.[topicId] || [], CLIENT_NAME),
      gemini: aggregateTextMetrics(gemini.byTopic[topicId] || [], CLIENT_NAME),
      claude: aggregateTextMetrics(claude.byTopic[topicId] || [], CLIENT_NAME),
    };
  }

  // Enrich the existing metrics
  metrics.textMetrics.byPlatform = byPlatform;
  metrics.textMetrics.byTopicByPlatform = byTopicByPlatform;

  // Also update platformBreakdown with Gemini + Claude
  metrics.summary.platformBreakdown.gemini = {
    available: true,
    citationShare: 0,
    promptsCited: 0,
    totalPrompts: gemini.analyses.length,
    brandMentionRate: byPlatform.gemini.brandMentionRate,
  };
  metrics.summary.platformBreakdown.claude = {
    available: true,
    citationShare: 0,
    promptsCited: 0,
    totalPrompts: claude.analyses.length,
    brandMentionRate: byPlatform.claude.brandMentionRate,
  };

  // Write back
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

  // Print summary
  console.log('');
  console.log('  ── Per-Platform Brand Mention Rates ──');
  for (const [platform, stats] of Object.entries(byPlatform)) {
    console.log(`  ${platform.padEnd(18)} ${(stats.brandMentionRate * 100).toFixed(1)}% mention | ${(stats.firstMentionRate * 100).toFixed(1)}% first | ${stats.totalResponses} responses`);
  }

  console.log('');
  console.log(`  Topics with per-platform data: ${allTopicIds.size}`);
  console.log(`  Written to: ${metricsPath}`);
  console.log('');
  console.log('  ✓ analyzedMetrics.json enriched with per-platform textMetrics');
  console.log('');
}

main();
