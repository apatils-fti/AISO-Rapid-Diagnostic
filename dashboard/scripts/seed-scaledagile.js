#!/usr/bin/env node

/**
 * Seed ScaledAgile client + prompt library to Supabase.
 *
 * Reads the generated library JSON from generator/output/scaledagile-prompt-library.json,
 * creates (or upserts) the client row, creates a prompt_libraries row, and inserts
 * all prompts in 50-row chunks.
 *
 * Usage:
 *   cd dashboard && node scripts/seed-scaledagile.js
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
const LIBRARY_PATH = path.resolve(__dirname, '..', '..', 'generator', 'output', 'scaledagile-prompt-library.json');
const CONFIG_PATH = path.resolve(__dirname, '..', '..', 'generator', 'configs', 'scaledagile.json');

async function main() {
  console.log('=== Seed ScaledAgile to Supabase ===\n');

  // 1. Read the generated library
  if (!fs.existsSync(LIBRARY_PATH)) {
    console.error(`Library file not found: ${LIBRARY_PATH}`);
    console.error('Run: cd generator && npm run generate -- --config configs/scaledagile.json --out output/scaledagile-prompt-library.json');
    process.exit(1);
  }
  const library = JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  console.log(`Loaded ${library.totalPrompts} prompts from ${LIBRARY_PATH}`);

  // 2. Upsert client row
  const clientName = config.brand || 'ScaledAgile';
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('name', clientName)
    .limit(1)
    .single();

  let clientId;
  if (existing?.id) {
    clientId = existing.id;
    await supabase.from('clients').update({
      archetype: config.archetype,
      config: config,
    }).eq('id', clientId);
    console.log(`✓ Client "${clientName}" already exists: ${clientId} (config updated)`);
  } else {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: clientName,
        archetype: config.archetype || 'b2b',
        config: config,
      })
      .select('id')
      .single();
    if (error) {
      console.error('✗ Failed to create client:', error.message);
      process.exit(1);
    }
    clientId = data.id;
    console.log(`✓ Client "${clientName}" created: ${clientId}`);
  }

  // 3. Create prompt_libraries row
  const { data: libRow, error: libErr } = await supabase
    .from('prompt_libraries')
    .insert({
      client_id: clientId,
      name: `${clientName} Prompt Library`,
      archetype: config.archetype || 'b2b',
      total_count: library.totalPrompts,
      metadata: {
        generatedBy: 'generator/bin/generate.ts',
        archetype: config.archetype,
        tier: library.tier,
        warnings: library.warnings,
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

  // 5. Summary
  console.log('\n=== Done ===');
  console.log(`  Client ID:    ${clientId}`);
  console.log(`  Library ID:   ${libraryId}`);
  console.log(`  Prompts:      ${saved}`);
  console.log(`  Dashboard:    /dashboard?client=${clientId}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
