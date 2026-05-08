#!/usr/bin/env node

/**
 * Seed the ScaledAgile AI Training prompt library to Supabase.
 *
 * Reads the generated library JSON from
 * generator/output/scaledagile-ai-training-prompts.json, attaches it to the
 * existing ScaledAgile client (client_id: 1aa39aab-4a3b-4af8-b7cc-484cc6ee578c),
 * creates a NEW prompt_libraries row (separate from the existing SAFe library),
 * and inserts all prompts in 50-row chunks.
 *
 * Also writes a flat array of prompts to
 * dashboard/top-scaledagile-ai-training-prompts.json for downstream tooling.
 *
 * Usage:
 *   cd dashboard && node scripts/seed-scaledagile-ai-training.js
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_KEY.startsWith('<')) {
  console.error('Missing Supabase credentials in dashboard/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CHUNK_SIZE = 50;
const CLIENT_ID = '1aa39aab-4a3b-4af8-b7cc-484cc6ee578c';
const LIBRARY_NAME = 'ScaledAgile AI Training Prompt Library';
const LIBRARY_PATH = path.resolve(__dirname, '..', '..', 'generator', 'output', 'scaledagile-ai-training-prompts.json');
const CONFIG_PATH = path.resolve(__dirname, '..', '..', 'generator', 'configs', 'scaledagile-ai-training.json');
const FLAT_OUTPUT_PATH = path.resolve(__dirname, '..', 'top-scaledagile-ai-training-prompts.json');

async function main() {
  console.log('=== Seed ScaledAgile AI Training to Supabase ===\n');

  // 1. Read the generated library
  if (!fs.existsSync(LIBRARY_PATH)) {
    console.error(`Library file not found: ${LIBRARY_PATH}`);
    console.error('Run: cd generator && npm run generate -- --config configs/scaledagile-ai-training.json --out output/scaledagile-ai-training-prompts.json');
    process.exit(1);
  }
  const library = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  console.log(`Loaded ${library.totalPrompts} prompts from ${LIBRARY_PATH}`);

  // 2. Verify the client exists (do not create — the SAFe library already attached this client)
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', CLIENT_ID)
    .limit(1)
    .single();

  if (clientErr || !client?.id) {
    console.error(`✗ Client ${CLIENT_ID} not found in Supabase:`, clientErr?.message);
    process.exit(1);
  }
  console.log(`✓ Reusing existing client "${client.name}": ${client.id}`);

  // 3. Create a NEW prompt_libraries row alongside the SAFe library
  const { data: libRow, error: libErr } = await supabase
    .from('prompt_libraries')
    .insert({
      client_id: CLIENT_ID,
      name: LIBRARY_NAME,
      archetype: config.archetype || 'b2b',
      total_count: library.totalPrompts,
      metadata: {
        generatedBy: 'generator/bin/generate.ts',
        archetype: config.archetype,
        tier: library.tier,
        warnings: library.warnings,
        configFile: 'configs/scaledagile-ai-training.json',
      },
    })
    .select('id')
    .single();

  if (libErr) {
    console.error('✗ Failed to create prompt_libraries row:', libErr.message);
    process.exit(1);
  }
  const libraryId = libRow.id;
  console.log(`✓ Prompt library created: ${libraryId}`);

  // 4. Insert prompts in chunks
  const rows = library.prompts.map((p) => ({
    library_id: libraryId,
    prompt_id: p.promptId,
    topic_id: p.topicId,
    topic_name: p.topicName,
    isotope: p.isotope,
    intent_stage: p.intent_stage || null,
    category: p.category,
    prompt_text: p.promptText,
  }));

  let saved = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('prompts').insert(chunk);
    if (error) {
      console.error(`✗ Chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed:`, error.message);
    } else {
      saved += chunk.length;
    }
  }

  console.log(`✓ Inserted ${saved}/${rows.length} prompts`);

  // 5. Write flat JSON for downstream tooling
  fs.writeFileSync(FLAT_OUTPUT_PATH, JSON.stringify(library.prompts, null, 2));
  console.log(`✓ Wrote flat prompts JSON: ${FLAT_OUTPUT_PATH}`);

  // 6. Summary
  console.log('\n=== Done ===');
  console.log(`  Client ID:    ${CLIENT_ID}`);
  console.log(`  Library ID:   ${libraryId}`);
  console.log(`  Library Name: ${LIBRARY_NAME}`);
  console.log(`  Prompts:      ${saved}`);
  console.log(`  Dashboard:    /dashboard?client=${CLIENT_ID}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
