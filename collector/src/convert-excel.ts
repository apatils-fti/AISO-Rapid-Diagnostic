import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// JCrew client and competitors (preserved from existing library)
const CLIENT = {
  name: "J.Crew",
  domains: ["jcrew.com", "jcrewfactory.com"],
  industry: "fashion-apparel"
};

const COMPETITORS = [
  { name: "Banana Republic", domains: ["bananarepublic.com", "bananarepublicfactory.com"] },
  { name: "Everlane", domains: ["everlane.com"] },
  { name: "Abercrombie & Fitch", domains: ["abercrombie.com"] },
  { name: "Gap", domains: ["gap.com", "gapfactory.com"] },
  { name: "Club Monaco", domains: ["clubmonaco.com"] }
];

interface ExcelRow {
  topic: string;
  prompt: string;
  isotype: string;
  funnel_stage: string;
}

interface Prompt {
  id: string;
  isotope: string;
  text: string;
}

interface Topic {
  id: string;
  name: string;
  category: string;
  prompts: Prompt[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function parseArgs(): { excel: string; output: string } {
  const args = process.argv.slice(2);
  let excel = 'prompts/inputs.xlsx';
  let output = 'prompts/jcrew-prompt-library.json';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--excel' && args[i + 1]) {
      excel = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[i + 1];
      i++;
    }
  }

  return { excel, output };
}

function main() {
  const { excel, output } = parseArgs();

  console.log(`Reading Excel file: ${excel}`);

  if (!fs.existsSync(excel)) {
    console.error(`Error: File not found: ${excel}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(excel);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${rows.length} rows in sheet "${sheetName}"`);

  // Group by topic
  const topicMap = new Map<string, Topic>();

  for (const row of rows) {
    if (!row.topic || !row.prompt) {
      continue; // Skip empty rows
    }

    const topicName = row.topic.trim();
    const topicId = slugify(topicName);
    const isotope = (row.isotype || 'informational').trim().toLowerCase();
    const category = (row.funnel_stage || 'General').trim();

    if (!topicMap.has(topicId)) {
      topicMap.set(topicId, {
        id: topicId,
        name: topicName,
        category: category,
        prompts: []
      });
    }

    const topic = topicMap.get(topicId)!;
    topic.prompts.push({
      id: `${topicId}-${isotope}`,
      isotope: isotope,
      text: row.prompt.trim()
    });
  }

  const topics = Array.from(topicMap.values());
  const totalPrompts = topics.reduce((sum, t) => sum + t.prompts.length, 0);

  const library = {
    client: CLIENT,
    competitors: COMPETITORS,
    topics: topics,
    metadata: {
      version: "1.0",
      created: new Date().toISOString().split('T')[0],
      totalPrompts: totalPrompts,
      totalTopics: topics.length,
      runsPerPrompt: 3,
      estimatedApiCalls: totalPrompts * 3,
      estimatedCost: `$${(totalPrompts * 3 * 0.005).toFixed(2)}`
    }
  };

  fs.writeFileSync(output, JSON.stringify(library, null, 2));

  console.log(`\nConverted successfully!`);
  console.log(`  Topics: ${topics.length}`);
  console.log(`  Prompts: ${totalPrompts}`);
  console.log(`  Output: ${output}`);
}

main();
