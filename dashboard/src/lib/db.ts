/**
 * Supabase database helpers.
 *
 * Every function is fail-safe: returns empty/undefined if Supabase is
 * unavailable. Callers should always fall back to local JSON data.
 */

import { supabaseAnon, supabaseService } from './supabase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 50;

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Pick the best available client (service for writes, anon for reads). */
function writer() {
  return supabaseService ?? supabaseAnon;
}
function reader() {
  return supabaseAnon ?? supabaseService;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export interface DbClient {
  id: string;
  name: string;
  archetype: string;
  config: Record<string, unknown>;
  created_at: string;
}

/**
 * Upsert a client record. If a client with the same name exists, returns its id.
 * Otherwise inserts a new row.
 */
export async function upsertClient(config: Record<string, unknown>): Promise<string | undefined> {
  const sb = writer();
  if (!sb) return undefined;

  try {
    const name = (config as any).client?.name ?? (config as any).clientName;

    // Check for existing
    const { data: existing } = await sb
      .from('clients')
      .select('id')
      .eq('name', name)
      .limit(1)
      .single();

    if (existing?.id) {
      // Update config
      await sb.from('clients').update({ config }).eq('id', existing.id);
      return existing.id;
    }

    const archetype = (config as any).archetype ?? 'unknown';
    const { data, error } = await sb
      .from('clients')
      .insert({ name, archetype, config })
      .select('id')
      .single();

    if (error) { console.warn('[db] upsertClient error:', error.message); return undefined; }
    return data?.id;
  } catch (e: any) {
    console.warn('[db] upsertClient failed:', e.message);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Archetype Templates
// ---------------------------------------------------------------------------

export async function upsertArchetypeTemplate(template: Record<string, unknown>): Promise<string | undefined> {
  const sb = writer();
  if (!sb) return undefined;

  try {
    const archetype = template.archetype as any;
    const archetypeId = archetype?.id ?? 'unknown';

    const { data: existing } = await sb
      .from('archetype_templates')
      .select('id, version')
      .eq('archetype_id', archetypeId)
      .limit(1)
      .single();

    if (existing?.id) {
      await sb.from('archetype_templates').update({
        name: archetype.name,
        description: archetype.description,
        sectors: archetype.sectors,
        primary_focus: archetype.primaryFocus,
        prompt_emphasis: archetype.promptEmphasis,
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
        name: archetype.name,
        description: archetype.description,
        sectors: archetype.sectors,
        primary_focus: archetype.primaryFocus,
        prompt_emphasis: archetype.promptEmphasis,
        seeds: template.seeds,
      })
      .select('id')
      .single();

    if (error) { console.warn('[db] upsertArchetypeTemplate error:', error.message); return undefined; }
    return data?.id;
  } catch (e: any) {
    console.warn('[db] upsertArchetypeTemplate failed:', e.message);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Prompt Libraries
// ---------------------------------------------------------------------------

export async function createPromptLibrary(
  clientId: string,
  metadata: {
    name: string;
    archetype: string;
    totalCount: number;
    cost?: number;
    durationSeconds?: number;
    extra?: Record<string, unknown>;
  }
): Promise<string | undefined> {
  const sb = writer();
  if (!sb) return undefined;

  try {
    const { data, error } = await sb
      .from('prompt_libraries')
      .insert({
        client_id: clientId,
        name: metadata.name,
        archetype: metadata.archetype,
        total_count: metadata.totalCount,
        generation_cost: metadata.cost,
        generation_duration_seconds: metadata.durationSeconds,
        metadata: metadata.extra ?? {},
      })
      .select('id')
      .single();

    if (error) { console.warn('[db] createPromptLibrary error:', error.message); return undefined; }
    return data?.id;
  } catch (e: any) {
    console.warn('[db] createPromptLibrary failed:', e.message);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export async function savePrompts(
  libraryId: string,
  prompts: Array<{
    promptId: string;
    topicId: string;
    topicName: string;
    isotope: string;
    category?: string;
    promptText: string;
  }>
): Promise<void> {
  const sb = writer();
  if (!sb) return;

  try {
    const rows = prompts.map((p) => ({
      library_id: libraryId,
      prompt_id: p.promptId,
      topic_id: p.topicId,
      topic_name: p.topicName,
      isotope: p.isotope,
      category: p.category ?? null,
      prompt_text: p.promptText,
    }));

    for (const chunk of chunks(rows, CHUNK_SIZE)) {
      const { error } = await sb.from('prompts').insert(chunk);
      if (error) console.warn('[db] savePrompts chunk error:', error.message);
    }
  } catch (e: any) {
    console.warn('[db] savePrompts failed:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export async function createRun(
  clientId: string,
  libraryId: string,
  platform: string,
  metadata?: Record<string, unknown>
): Promise<string | undefined> {
  const sb = writer();
  if (!sb) return undefined;

  try {
    const { data, error } = await sb
      .from('runs')
      .insert({
        client_id: clientId,
        library_id: libraryId,
        platform,
        prompt_count: 0,
        mention_count: 0,
        mention_rate: 0,
        metadata: metadata ?? {},
      })
      .select('id')
      .single();

    if (error) { console.warn('[db] createRun error:', error.message); return undefined; }
    return data?.id;
  } catch (e: any) {
    console.warn('[db] createRun failed:', e.message);
    return undefined;
  }
}

export async function updateRunStats(
  runId: string,
  stats: { promptCount: number; mentionCount: number; mentionRate: number; metadata?: Record<string, unknown> }
): Promise<void> {
  const sb = writer();
  if (!sb) return;

  try {
    await sb.from('runs').update({
      prompt_count: stats.promptCount,
      mention_count: stats.mentionCount,
      mention_rate: stats.mentionRate,
      metadata: stats.metadata,
    }).eq('id', runId);
  } catch (e: any) {
    console.warn('[db] updateRunStats failed:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export async function saveResults(
  runId: string,
  results: Array<{
    promptId: string;
    topicId: string;
    topicName?: string;
    isotope?: string;
    platform: string;
    responseText?: string;
    clientMentioned?: boolean;
    mentionCount?: number;
    firstMention?: boolean;
    citations?: string[];
    citationCount?: number;
    sentiment?: string;
    recommendationFlag?: boolean;
  }>
): Promise<void> {
  const sb = writer();
  if (!sb) return;

  try {
    const rows = results.map((r) => ({
      run_id: runId,
      prompt_id: r.promptId,
      topic_id: r.topicId,
      topic_name: r.topicName ?? '',
      isotope: r.isotope ?? null,
      platform: r.platform,
      response_text: r.responseText ?? '',
      client_mentioned: r.clientMentioned ?? false,
      mention_count: r.mentionCount ?? 0,
      first_mention: r.firstMention ?? false,
      citations: r.citations ?? [],
      citation_count: r.citationCount ?? (r.citations?.length ?? 0),
      sentiment: r.sentiment ?? null,
      recommendation_flag: r.recommendationFlag ?? false,
    }));

    for (const chunk of chunks(rows, CHUNK_SIZE)) {
      const { error } = await sb.from('results').insert(chunk);
      if (error) console.warn('[db] saveResults chunk error:', error.message);
    }
  } catch (e: any) {
    console.warn('[db] saveResults failed:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getClients(): Promise<DbClient[]> {
  const sb = reader();
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.warn('[db] getClients error:', error.message); return []; }
    return data ?? [];
  } catch { return []; }
}

export async function getRuns(clientId: string): Promise<any[]> {
  const sb = reader();
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from('runs')
      .select('*')
      .eq('client_id', clientId)
      .order('run_date', { ascending: false });
    if (error) { console.warn('[db] getRuns error:', error.message); return []; }
    return data ?? [];
  } catch { return []; }
}

export async function getResults(runId: string): Promise<any[]> {
  const sb = reader();
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from('results')
      .select('*')
      .eq('run_id', runId);
    if (error) { console.warn('[db] getResults error:', error.message); return []; }
    return data ?? [];
  } catch { return []; }
}

export async function getTimeSeriesData(
  clientId: string,
  platform?: string
): Promise<Array<{ run_date: string; mention_rate: number; platform: string }>> {
  const sb = reader();
  if (!sb) return [];

  try {
    let query = sb
      .from('runs')
      .select('run_date, mention_rate, platform')
      .eq('client_id', clientId)
      .order('run_date', { ascending: true });

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;
    if (error) { console.warn('[db] getTimeSeriesData error:', error.message); return []; }
    return data ?? [];
  } catch { return []; }
}

export async function getLatestRun(
  clientId: string,
  platform: string
): Promise<{ run: any; results: any[] } | null> {
  const sb = reader();
  if (!sb) return null;

  try {
    const { data: run, error } = await sb
      .from('runs')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', platform)
      .order('run_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !run) return null;

    const { data: results } = await sb
      .from('results')
      .select('*')
      .eq('run_id', run.id);

    return { run, results: results ?? [] };
  } catch { return null; }
}

export async function getPromptLibrary(
  libraryId: string
): Promise<{ library: any; prompts: any[] } | null> {
  const sb = reader();
  if (!sb) return null;

  try {
    const { data: library, error } = await sb
      .from('prompt_libraries')
      .select('*')
      .eq('id', libraryId)
      .single();

    if (error || !library) return null;

    const { data: prompts } = await sb
      .from('prompts')
      .select('*')
      .eq('library_id', libraryId);

    return { library, prompts: prompts ?? [] };
  } catch { return null; }
}

/**
 * Compare two runs: returns per-topic mention rate deltas.
 */
export async function compareRuns(
  runIdA: string,
  runIdB: string
): Promise<Array<{ topicId: string; topicName: string; rateA: number; rateB: number; delta: number }>> {
  const sb = reader();
  if (!sb) return [];

  try {
    const [resA, resB] = await Promise.all([
      sb.from('results').select('topic_id, topic_name, client_mentioned').eq('run_id', runIdA),
      sb.from('results').select('topic_id, topic_name, client_mentioned').eq('run_id', runIdB),
    ]);

    if (resA.error || resB.error) return [];

    const aggregate = (rows: any[]) => {
      const map: Record<string, { name: string; total: number; mentioned: number }> = {};
      for (const r of rows) {
        if (!map[r.topic_id]) map[r.topic_id] = { name: r.topic_name, total: 0, mentioned: 0 };
        map[r.topic_id].total++;
        if (r.client_mentioned) map[r.topic_id].mentioned++;
      }
      return map;
    };

    const mapA = aggregate(resA.data ?? []);
    const mapB = aggregate(resB.data ?? []);
    const allTopics = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);

    const out: Array<{ topicId: string; topicName: string; rateA: number; rateB: number; delta: number }> = [];
    for (const tid of allTopics) {
      const a = mapA[tid];
      const b = mapB[tid];
      const rateA = a ? a.mentioned / a.total : 0;
      const rateB = b ? b.mentioned / b.total : 0;
      out.push({
        topicId: tid,
        topicName: a?.name ?? b?.name ?? tid,
        rateA,
        rateB,
        delta: rateB - rateA,
      });
    }

    return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Phase 1 Migration: Supabase-backed aggregation queries
// ---------------------------------------------------------------------------

/** Raw result row from Supabase */
export interface DbResult {
  id: string;
  run_id: string;
  prompt_id: string;
  topic_id: string;
  topic_name: string;
  isotope: string | null;
  platform: string;
  response_text: string;
  client_mentioned: boolean;
  mention_count: number;
  first_mention: boolean;
  citations: string[];
  citation_count: number;
  sentiment: string | null;
  recommendation_flag: boolean;
  recommendation_strength: string | null;
  cta_present: boolean;
  decision_criteria_winner: boolean;
  conversion_intent: string | null;
  competitor_mentions: Record<string, number> | null;
  created_at: string;
}

/**
 * Fetch all results for a client across all platforms (joined through runs table).
 * Optionally filter by platform.
 */
export async function getAllResultsForClient(
  clientId: string,
  platform?: string
): Promise<DbResult[]> {
  const sb = reader();
  if (!sb) return [];

  try {
    // Get run IDs for this client
    const { data: runs, error: runsErr } = await sb
      .from('runs')
      .select('id')
      .eq('client_id', clientId);

    if (runsErr || !runs || runs.length === 0) return [];
    const runIds = runs.map((r: any) => r.id);

    let query = sb
      .from('results')
      .select('*')
      .in('run_id', runIds);

    if (platform && platform !== 'all') {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;
    if (error) { console.warn('[db] getAllResultsForClient error:', error.message); return []; }
    return (data ?? []) as DbResult[];
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Platform Comparison
// ---------------------------------------------------------------------------

export interface PlatformComparisonStats {
  platform: string;
  displayName: string;
  color: string;
  brandMentionRate: number;
  firstMentionRate: number;
  citationRate: number;
  totalPrompts: number;
  promptsWithMention: number;
  promptsWithCitation: number;
  citationsAvailable: boolean;
  available: boolean;
}

const PLATFORM_DISPLAY: Record<string, { name: string; color: string }> = {
  perplexity: { name: 'Perplexity', color: '#20B2AA' },
  chatgpt_search: { name: 'ChatGPT Search', color: '#10A37F' },
  gemini: { name: 'Gemini', color: '#4285F4' },
  claude: { name: 'Claude', color: '#D4A574' },
  google: { name: 'Google AI', color: '#EA4335' },
};

export async function getPlatformComparison(
  clientId: string
): Promise<PlatformComparisonStats[]> {
  const results = await getAllResultsForClient(clientId);
  if (results.length === 0) return [];

  // Group by platform
  const byPlatform = new Map<string, DbResult[]>();
  for (const r of results) {
    if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, []);
    byPlatform.get(r.platform)!.push(r);
  }

  const stats: PlatformComparisonStats[] = [];
  for (const [platform, rows] of byPlatform) {
    const total = rows.length;
    const mentioned = rows.filter(r => r.client_mentioned).length;
    const firstMention = rows.filter(r => r.first_mention).length;
    const withCitations = rows.filter(r => r.citation_count > 0).length;
    const hasCitations = rows.some(r => r.citations && r.citations.length > 0);

    const meta = PLATFORM_DISPLAY[platform] ?? { name: platform, color: '#6B7280' };

    stats.push({
      platform,
      displayName: meta.name,
      color: meta.color,
      brandMentionRate: total > 0 ? mentioned / total : 0,
      firstMentionRate: total > 0 ? firstMention / total : 0,
      citationRate: total > 0 ? withCitations / total : 0,
      totalPrompts: total,
      promptsWithMention: mentioned,
      promptsWithCitation: withCitations,
      citationsAvailable: hasCitations,
      available: true,
    });
  }

  return stats.sort((a, b) => b.brandMentionRate - a.brandMentionRate);
}

// ---------------------------------------------------------------------------
// Overview Stats
// ---------------------------------------------------------------------------

export interface CompetitorStat {
  name: string;
  mentionRate: number;
  firstMentionRate: number;
}

export interface OverviewStats {
  mentionRate: number;
  firstMentionRate: number;
  shareOfVoice: number;
  citationRate: number;
  totalResults: number;
  promptsWithMention: number;
  promptsWithCitation: number;
  visibilityScore: number;
  competitorStats: CompetitorStat[];
  topCompetitor: string;
  topCompetitorRate: number;
  platformCount: number;
  biggestGapTopic: string;
  biggestGapDelta: number;
  rank: number;
}

export async function getOverviewStats(
  clientId: string,
  platform?: string
): Promise<OverviewStats | null> {
  const results = await getAllResultsForClient(clientId, platform);
  if (results.length === 0) return null;

  const total = results.length;
  const mentioned = results.filter(r => r.client_mentioned);
  const firstMention = results.filter(r => r.first_mention);
  const withCitations = results.filter(r => r.citation_count > 0);

  const mentionRate = mentioned.length / total;
  const firstMentionRate = firstMention.length / total;
  const citationRate = withCitations.length / total;

  // Competitor stats from competitor_mentions JSONB
  const competitorTotals = new Map<string, { mentions: number; first: number; total: number }>();
  for (const r of results) {
    const cm = r.competitor_mentions ?? {};
    for (const [name, count] of Object.entries(cm)) {
      if (!competitorTotals.has(name)) competitorTotals.set(name, { mentions: 0, first: 0, total: 0 });
      const entry = competitorTotals.get(name)!;
      entry.total++;
      if ((count as number) > 0) entry.mentions++;
    }
  }
  // Backfill total for competitors not mentioned in a result
  for (const entry of competitorTotals.values()) {
    entry.total = total;
  }

  const competitorStats: CompetitorStat[] = [...competitorTotals.entries()]
    .map(([name, stats]) => ({
      name,
      mentionRate: stats.mentions / stats.total,
      firstMentionRate: 0, // Not tracked per-competitor
    }))
    .sort((a, b) => b.mentionRate - a.mentionRate);

  // Share of voice: client mentions / (client + all competitor mentions)
  const totalCompMentions = competitorStats.reduce((sum, c) => sum + c.mentionRate * total, 0);
  const shareOfVoice = (mentioned.length + totalCompMentions) > 0
    ? mentioned.length / (mentioned.length + totalCompMentions)
    : 0;

  // Rank among competitors
  const allRates = [mentionRate, ...competitorStats.map(c => c.mentionRate)].sort((a, b) => b - a);
  const rank = allRates.indexOf(mentionRate) + 1;

  // Biggest gap topic
  const topicMentions = new Map<string, { name: string; mentioned: number; total: number; compBest: number }>();
  for (const r of results) {
    const tid = r.topic_id;
    if (!topicMentions.has(tid)) {
      topicMentions.set(tid, { name: r.topic_name, mentioned: 0, total: 0, compBest: 0 });
    }
    const entry = topicMentions.get(tid)!;
    entry.total++;
    if (r.client_mentioned) entry.mentioned++;
    const cm = r.competitor_mentions ?? {};
    for (const count of Object.values(cm)) {
      if ((count as number) > 0) entry.compBest = Math.max(entry.compBest, entry.compBest + 1);
    }
  }

  // Find topic with biggest gap (competitor rate - client rate)
  let biggestGapTopic = '';
  let biggestGapDelta = 0;
  for (const [, topic] of topicMentions) {
    const clientRate = topic.total > 0 ? topic.mentioned / topic.total : 0;
    // Approximate competitor rate from competitor_mentions
    const gap = (1 - clientRate); // simplified: gap = how much room to improve
    if (gap > biggestGapDelta && clientRate < 0.5) {
      biggestGapDelta = gap;
      biggestGapTopic = topic.name;
    }
  }

  const platformCount = new Set(results.map(r => r.platform)).size;

  // Visibility score (same formula as metrics.ts)
  const visibilityScore = Math.round(
    0.35 * (mentionRate * 100) +
    0.30 * (shareOfVoice * 100) +
    0.20 * (firstMentionRate * 100) +
    0.15 * (citationRate * 100)
  );

  return {
    mentionRate,
    firstMentionRate,
    shareOfVoice,
    citationRate,
    totalResults: total,
    promptsWithMention: mentioned.length,
    promptsWithCitation: withCitations.length,
    visibilityScore,
    competitorStats,
    topCompetitor: competitorStats[0]?.name ?? 'N/A',
    topCompetitorRate: competitorStats[0]?.mentionRate ?? 0,
    platformCount,
    biggestGapTopic,
    biggestGapDelta,
    rank,
  };
}

// ---------------------------------------------------------------------------
// Topic Stats (for Compare Platforms topic table)
// ---------------------------------------------------------------------------

export interface TopicPlatformStat {
  topicId: string;
  topicName: string;
  platforms: Record<string, number>; // platform → mentionRate
}

export async function getTopicPlatformStats(
  clientId: string
): Promise<TopicPlatformStat[]> {
  const results = await getAllResultsForClient(clientId);
  if (results.length === 0) return [];

  // Group by topic + platform
  const map = new Map<string, { name: string; platforms: Map<string, { mentioned: number; total: number }> }>();

  for (const r of results) {
    if (!map.has(r.topic_id)) {
      map.set(r.topic_id, { name: r.topic_name, platforms: new Map() });
    }
    const topic = map.get(r.topic_id)!;
    if (!topic.platforms.has(r.platform)) {
      topic.platforms.set(r.platform, { mentioned: 0, total: 0 });
    }
    const p = topic.platforms.get(r.platform)!;
    p.total++;
    if (r.client_mentioned) p.mentioned++;
  }

  return [...map.entries()].map(([topicId, topic]) => {
    const platforms: Record<string, number> = {};
    for (const [platform, stats] of topic.platforms) {
      platforms[platform] = stats.total > 0 ? stats.mentioned / stats.total : 0;
    }
    return { topicId, topicName: topic.name, platforms };
  });
}
