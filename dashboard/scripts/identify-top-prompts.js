const rawResults = require('../src/fixtures/rawResults.json');
const promptLibrary = require('../src/fixtures/promptLibrary.json');
const fs = require('fs');

// Build prompt lookup
const promptMap = new Map();
promptLibrary.topics.forEach(topic => {
  topic.prompts.forEach(prompt => {
    promptMap.set(prompt.id, { ...prompt, topicId: topic.id, topicName: topic.name });
  });
});

// Score each prompt by citation performance
const promptScores = new Map();

rawResults.results.forEach(result => {
  const key = result.promptId;
  if (!promptScores.has(key)) {
    promptScores.set(key, { citations: 0, runs: 0, positions: [], platforms: new Set() });
  }
  const score = promptScores.get(key);
  score.runs++;
  score.platforms.add(result.platform);

  // Check if client was cited in this result
  if (result.analysis?.clientCited) {
    score.citations++;
    // Extract position from citations array if available
    const clientCitation = result.response?.citations?.find(c =>
      c.url?.toLowerCase().includes('jcrew.com') ||
      c.url?.toLowerCase().includes('j.crew')
    );
    if (clientCitation?.position) {
      score.positions.push(clientCitation.position);
    }
  }
});

// Calculate final scores and sort
const rankedPrompts = Array.from(promptScores.entries())
  .map(([promptId, stats]) => {
    const prompt = promptMap.get(promptId);
    if (!prompt) return null;

    const avgPosition = stats.positions.length > 0
      ? stats.positions.reduce((a,b) => a+b, 0) / stats.positions.length
      : 999;
    const citationRate = stats.citations / stats.runs;
    // Score: prioritize cited prompts heavily, then by position
    const score = (stats.citations > 0 ? 1000 : 0) + (citationRate * 100) - (avgPosition * 0.5);

    return {
      promptId,
      topicId: prompt.topicId,
      topicName: prompt.topicName,
      promptText: prompt.text,
      citations: stats.citations,
      runs: stats.runs,
      citationRate: citationRate.toFixed(2),
      avgPosition: avgPosition === 999 ? 'N/A' : avgPosition.toFixed(1),
      score: score.toFixed(1)
    };
  })
  .filter(p => p !== null)
  .sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

// Show top 250
console.log('Top 250 High-Performing Prompts (prioritizing cited):\n');
const top250 = rankedPrompts.slice(0, 250);

// Show first 20 as preview
top250.slice(0, 20).forEach((p, i) => {
  const displayText = p.promptText?.substring(0, 50) || 'N/A';
  console.log(`${(i+1).toString().padStart(3)}. [${p.citations}/${p.runs} cites, pos ${p.avgPosition}] ${displayText}...`);
});

if (top250.length > 20) {
  console.log(`\n... and ${top250.length - 20} more prompts`);
}

// Export for script
fs.writeFileSync('./top-250-prompts.json', JSON.stringify(top250, null, 2));
console.log('\n✓ Exported top 250 to scripts/top-250-prompts.json');
console.log('  - Total prompts: ' + top250.length);
console.log('  - Prompts with citations: ' + top250.filter(p => p.citations > 0).length);
console.log('  - Total citation count: ' + top250.reduce((sum, p) => sum + p.citations, 0));
