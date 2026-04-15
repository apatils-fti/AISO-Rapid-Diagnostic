/**
 * One-time script: seeds all 5 archetype templates into Supabase.
 *
 * Usage:
 *   cd dashboard/scripts
 *   node seed-archetypes.js
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key || key.startsWith('<')) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);
const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', 'generator', 'templates');

async function main() {
  console.log('='.repeat(50));
  console.log('  Seed Archetype Templates');
  console.log('='.repeat(50));

  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
  console.log(`\nFound ${files.length} templates in ${TEMPLATES_DIR}\n`);

  for (const file of files) {
    const template = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8'));
    const arch = template.archetype;

    // Check if already exists
    const { data: existing } = await supabase
      .from('archetype_templates')
      .select('id, version')
      .eq('archetype_id', arch.id)
      .limit(1)
      .single();

    if (existing?.id) {
      // Update
      const { error } = await supabase
        .from('archetype_templates')
        .update({
          name: arch.name,
          description: arch.description,
          sectors: arch.sectors,
          primary_focus: arch.primaryFocus,
          prompt_emphasis: arch.promptEmphasis,
          seeds: template.seeds,
          version: (existing.version ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) console.error(`  ✗ ${arch.id}: ${error.message}`);
      else console.log(`  ✓ ${arch.id} — updated (v${(existing.version ?? 0) + 1})`);
    } else {
      // Insert
      const { error } = await supabase
        .from('archetype_templates')
        .insert({
          archetype_id: arch.id,
          name: arch.name,
          description: arch.description,
          sectors: arch.sectors,
          primary_focus: arch.primaryFocus,
          prompt_emphasis: arch.promptEmphasis,
          seeds: template.seeds,
        });

      if (error) console.error(`  ✗ ${arch.id}: ${error.message}`);
      else console.log(`  ✓ ${arch.id} — inserted`);
    }
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
