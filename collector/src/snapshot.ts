import * as fs from 'fs';
import * as path from 'path';

interface Snapshot {
  id: string;
  timestamp: string;
  label: string;
  metrics: any;
}

interface SnapshotIndex {
  snapshots: Snapshot[];
}

const SNAPSHOTS_DIR = 'snapshots';
const INDEX_FILE = path.join(SNAPSHOTS_DIR, 'index.json');

function loadIndex(): SnapshotIndex {
  if (fs.existsSync(INDEX_FILE)) {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  }
  return { snapshots: [] };
}

function saveIndex(index: SnapshotIndex): void {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function generateId(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function saveSnapshot(metricsPath: string, label?: string): void {
  if (!fs.existsSync(metricsPath)) {
    console.error(`Metrics file not found: ${metricsPath}`);
    process.exit(1);
  }

  const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
  const id = generateId();
  const timestamp = new Date().toISOString();
  const snapshotLabel = label || `Run ${timestamp.split('T')[0]}`;

  const snapshot: Snapshot = {
    id,
    timestamp,
    label: snapshotLabel,
    metrics
  };

  // Save individual snapshot file
  const snapshotFile = path.join(SNAPSHOTS_DIR, `${id}.json`);
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));

  // Update index
  const index = loadIndex();
  index.snapshots.push({
    id,
    timestamp,
    label: snapshotLabel,
    metrics: {
      overallScore: metrics.summary?.overallScore,
      citationShare: metrics.summary?.citationShare,
      totalPrompts: metrics.summary?.totalPrompts,
      totalTopics: metrics.topicResults?.length
    }
  });
  saveIndex(index);

  console.log(`Snapshot saved: ${snapshotFile}`);
  console.log(`  ID: ${id}`);
  console.log(`  Label: ${snapshotLabel}`);
  console.log(`  Score: ${metrics.summary?.overallScore}`);
  console.log(`  Citation Share: ${(metrics.summary?.citationShare * 100).toFixed(1)}%`);
}

function listSnapshots(): void {
  const index = loadIndex();
  if (index.snapshots.length === 0) {
    console.log('No snapshots found.');
    return;
  }

  console.log('\nSaved Snapshots:');
  console.log('─'.repeat(70));
  for (const s of index.snapshots) {
    const date = new Date(s.timestamp).toLocaleDateString();
    const score = s.metrics.overallScore ?? 'N/A';
    const share = s.metrics.citationShare ? (s.metrics.citationShare * 100).toFixed(1) + '%' : 'N/A';
    console.log(`  ${s.id}  |  ${date}  |  Score: ${score}  |  Share: ${share}  |  ${s.label}`);
  }
  console.log('─'.repeat(70));
}

function compareSnapshots(id1: string, id2: string): void {
  const file1 = path.join(SNAPSHOTS_DIR, `${id1}.json`);
  const file2 = path.join(SNAPSHOTS_DIR, `${id2}.json`);

  if (!fs.existsSync(file1)) {
    console.error(`Snapshot not found: ${id1}`);
    return;
  }
  if (!fs.existsSync(file2)) {
    console.error(`Snapshot not found: ${id2}`);
    return;
  }

  const s1: Snapshot = JSON.parse(fs.readFileSync(file1, 'utf-8'));
  const s2: Snapshot = JSON.parse(fs.readFileSync(file2, 'utf-8'));

  const m1 = s1.metrics.summary;
  const m2 = s2.metrics.summary;

  console.log('\n📊 Snapshot Comparison');
  console.log('═'.repeat(60));
  console.log(`  ${s1.label} (${s1.timestamp.split('T')[0]})`);
  console.log(`  vs`);
  console.log(`  ${s2.label} (${s2.timestamp.split('T')[0]})`);
  console.log('═'.repeat(60));

  const delta = (a: number, b: number) => {
    const diff = b - a;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}`;
  };

  const pctDelta = (a: number, b: number) => {
    const diff = (b - a) * 100;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(1)}%`;
  };

  console.log(`\nOverall Score:     ${m1.overallScore} → ${m2.overallScore}  (${delta(m1.overallScore, m2.overallScore)})`);
  console.log(`Citation Share:    ${(m1.citationShare * 100).toFixed(1)}% → ${(m2.citationShare * 100).toFixed(1)}%  (${pctDelta(m1.citationShare, m2.citationShare)})`);
  console.log(`Brand Mention:     ${(m1.brandMentionRate * 100).toFixed(1)}% → ${(m2.brandMentionRate * 100).toFixed(1)}%  (${pctDelta(m1.brandMentionRate, m2.brandMentionRate)})`);
  console.log(`First Mention:     ${(m1.firstMentionRate * 100).toFixed(1)}% → ${(m2.firstMentionRate * 100).toFixed(1)}%  (${pctDelta(m1.firstMentionRate, m2.firstMentionRate)})`);

  // Topic changes
  const topics1 = new Map(s1.metrics.topicResults?.map((t: any) => [t.topicId, t]) || []);
  const topics2 = new Map(s2.metrics.topicResults?.map((t: any) => [t.topicId, t]) || []);

  const improved: string[] = [];
  const declined: string[] = [];

  for (const [id, t2] of topics2) {
    const t1 = topics1.get(id);
    if (t1) {
      const diff = (t2 as any).overallScore - (t1 as any).overallScore;
      if (diff >= 5) improved.push(`${(t2 as any).topicName} (+${diff})`);
      if (diff <= -5) declined.push(`${(t2 as any).topicName} (${diff})`);
    }
  }

  if (improved.length > 0) {
    console.log(`\n✅ Improved Topics:`);
    improved.forEach(t => console.log(`   ${t}`));
  }

  if (declined.length > 0) {
    console.log(`\n⚠️  Declined Topics:`);
    declined.forEach(t => console.log(`   ${t}`));
  }

  console.log('');
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === 'save') {
  const metricsPath = args[1] || 'output/analyzed-metrics.json';
  const label = args[2];
  saveSnapshot(metricsPath, label);
} else if (command === 'list') {
  listSnapshots();
} else if (command === 'compare') {
  if (args.length < 3) {
    console.log('Usage: npx tsx src/snapshot.ts compare <id1> <id2>');
    process.exit(1);
  }
  compareSnapshots(args[1], args[2]);
} else {
  console.log(`
AISO Snapshot Manager

Commands:
  save [metrics-file] [label]   Save current metrics as a snapshot
  list                          List all saved snapshots
  compare <id1> <id2>           Compare two snapshots

Examples:
  npx tsx src/snapshot.ts save output/analyzed-metrics.json "Baseline Run"
  npx tsx src/snapshot.ts list
  npx tsx src/snapshot.ts compare 2026-03-10T14-30-00 2026-03-15T10-00-00
`);
}
