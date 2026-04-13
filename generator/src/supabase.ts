/**
 * Supabase write helpers for the prompt generator.
 *
 * All functions are fail-safe — if Supabase is unavailable the generator
 * continues to write local JSON files as before.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  // Try dashboard/.env.local for Supabase keys
  const envPath = path.resolve(__dirname, '..', '..', 'dashboard', '.env.local');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!url || !key || key.startsWith('<')) {
    return null;
  }

  _client = createClient(url, key);
  return _client;
}

const CHUNK_SIZE = 50;

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Upsert client record. Returns client id or undefined.
 */
export async function upsertClient(config: Record<string, unknown>): Promise<string | undefined> {
  const sb = getClient();
  if (!sb) return undefined;

  try {
    const clientObj = config.client as any;
    const name = clientObj?.name;
    if (!name) return undefined;

    const { data: existing } = await sb
      .from('clients')
      .select('id')
      .eq('name', name)
      .limit(1)
      .single();

    if (existing?.id) {
      await sb.from('clients').update({ config, archetype: (config as any).archetype }).eq('id', existing.id);
      return existing.id;
    }

    const { data, error } = await sb
      .from('clients')
      .insert({ name, archetype: (config as any).archetype ?? 'unknown', config })
      .select('id')
      .single();

    if (error) { console.warn('  ⚠ Supabase upsertClient:', error.message); return undefined; }
    return data?.id;
  } catch (e: any) {
    console.warn('  ⚠ Supabase upsertClient failed:', e.message);
    return undefined;
  }
}

/**
 * Upsert archetype template. Returns id or undefined.
 */
export async function saveArchetypeTemplate(template: Record<string, unknown>): Promise<string | undefined> {
  const sb = getClient();
  if (!sb) return undefined;

  try {
    const arch = template.archetype as any;
    const archetypeId = arch?.id ?? 'unknown';

    const { data: existing } = await sb
      .from('archetype_templates')
      .select('id, version')
      .eq('archetype_id', archetypeId)
      .limit(1)
      .single();

    if (existing?.id) {
      await sb.from('archetype_templates').update({
        name: arch.name,
        description: arch.description,
        sectors: arch.sectors,
        primary_focus: arch.primaryFocus,
        prompt_emphasis: arch.promptEmphasis,
        seeds: template.seeds,
        version: (existing.version ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      return existing.id;
    }

    const { data, error } = await sb
      .from('archetype_templates')
      .insert({
        archetype_id: archetypeId,
        name: arch.name,
        description: arch.description,
        sectors: arch.sectors,
        primary_focus: arch.primaryFocus,
        prompt_emphasis: arch.promptEmphasis,
        seeds: template.seeds,
      })
      .select('id')
      .single();

    if (error) { console.warn('  ⚠ Supabase saveArchetypeTemplate:', error.message); return undefined; }
    return data?.id;
  } catch (e: any) {
    console.warn('  ⚠ Supabase saveArchetypeTemplate failed:', e.message);
    return undefined;
  }
}

/**
 * Create a prompt library record and save all prompts.
 */
export async function savePromptLibrary(
  clientId: string,
  library: any,
  flatPrompts: Array<{
    promptId: string;
    topicId: string;
    topicName: string;
    isotope: string;
    category: string;
    promptText: string;
    intent_stage?: string | null;
  }>,
  meta: { cost?: number; durationSeconds?: number }
): Promise<string | undefined> {
  const sb = getClient();
  if (!sb) return undefined;

  try {
    // Create library record
    const { data: libRow, error: libErr } = await sb
      .from('prompt_libraries')
      .insert({
        client_id: clientId,
        name: `${library.client.name} Prompt Library`,
        archetype: library.metadata.archetype ?? 'unknown',
        total_count: flatPrompts.length,
        generation_cost: meta.cost,
        generation_duration_seconds: meta.durationSeconds,
        metadata: library.metadata,
      })
      .select('id')
      .single();

    if (libErr || !libRow?.id) {
      console.warn('  ⚠ Supabase createPromptLibrary:', libErr?.message);
      return undefined;
    }

    const libraryId = libRow.id;

    // Save prompts in chunks
    const rows = flatPrompts.map((p) => ({
      library_id: libraryId,
      prompt_id: p.promptId,
      topic_id: p.topicId,
      topic_name: p.topicName,
      isotope: p.isotope,
      intent_stage: p.intent_stage ?? null,
      category: p.category,
      prompt_text: p.promptText,
    }));

    let saved = 0;
    for (const chunk of chunks(rows, CHUNK_SIZE)) {
      const { error } = await sb.from('prompts').insert(chunk);
      if (error) {
        console.warn('  ⚠ Supabase savePrompts chunk error:', error.message);
      } else {
        saved += chunk.length;
      }
    }

    console.log(`  ✓ Supabase: saved ${saved} prompts to library ${libraryId}`);
    return libraryId;
  } catch (e: any) {
    console.warn('  ⚠ Supabase savePromptLibrary failed:', e.message);
    return undefined;
  }
}
