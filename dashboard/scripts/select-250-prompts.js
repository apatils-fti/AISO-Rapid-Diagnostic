const promptLibrary = require('../src/fixtures/promptLibrary.json');
const fs = require('fs');

// Build all prompts with metadata
const allPrompts = promptLibrary.topics.flatMap(topic =>
  topic.prompts.map(prompt => ({
    promptId: prompt.id,
    topicId: topic.id,
    topicName: topic.name,
    category: topic.category,
    promptText: prompt.text,
    isotope: prompt.isotope,
  }))
);

console.log(`Total prompts available: ${allPrompts.length}`);

// Strategy: Stratified random sampling by topic
// Ensure we sample evenly across all topics

const promptsByTopic = new Map();
allPrompts.forEach(p => {
  if (!promptsByTopic.has(p.topicId)) {
    promptsByTopic.set(p.topicId, []);
  }
  promptsByTopic.get(p.topicId).push(p);
});

console.log(`Total topics: ${promptsByTopic.size}`);

// Calculate prompts per topic (aim for 250 total)
const promptsPerTopic = Math.ceil(250 / promptsByTopic.size);
console.log(`Target prompts per topic: ${promptsPerTopic}`);

// Sample from each topic
const selected = [];
promptsByTopic.forEach((prompts, topicId) => {
  // Shuffle prompts for this topic
  const shuffled = prompts.sort(() => Math.random() - 0.5);

  // Take up to promptsPerTopic
  const toTake = Math.min(promptsPerTopic, shuffled.length);
  selected.push(...shuffled.slice(0, toTake));
});

// If we need more to reach 250, sample randomly from remaining
if (selected.length < 250) {
  const remaining = allPrompts.filter(p => !selected.find(s => s.promptId === p.promptId));
  const shuffled = remaining.sort(() => Math.random() - 0.5);
  selected.push(...shuffled.slice(0, 250 - selected.length));
}

// Trim to exactly 250
const final250 = selected.slice(0, 250);

// Show summary
console.log(`\nSelected ${final250.length} prompts:`);

// Count by topic
const topicCounts = new Map();
final250.forEach(p => {
  topicCounts.set(p.topicId, (topicCounts.get(p.topicId) || 0) + 1);
});

console.log('\nPrompts per topic:');
Array.from(topicCounts.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([topicId, count]) => {
    const topic = promptLibrary.topics.find(t => t.id === topicId);
    console.log(`  ${topic?.name || topicId}: ${count}`);
  });

// Count by isotope
const isotopeCounts = new Map();
final250.forEach(p => {
  isotopeCounts.set(p.isotope, (isotopeCounts.get(p.isotope) || 0) + 1);
});

console.log('\nPrompts per isotope:');
Array.from(isotopeCounts.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([isotope, count]) => {
    console.log(`  ${isotope}: ${count}`);
  });

// Export
fs.writeFileSync('./top-250-prompts.json', JSON.stringify(final250, null, 2));
console.log(`\n✓ Exported ${final250.length} prompts to scripts/top-250-prompts.json`);
