/**
 * Supabase database helpers.
 *
 * Every function is fail-safe: returns empty/undefined if Supabase is
 * unavailable. Callers should always fall back to local JSON data.
 */

import { supabaseAnon, supabaseService } from './supabase';
import { slugToTitle } from './utils';

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

/**
 * Supabase / PostgREST silently caps any `.select()` at 1000 rows by
 * default. For large clients (ScaledAgile ≈ 6,300 result rows per day)
 * that means everything past row 1000 silently vanishes, corrupting every
 * aggregation that depends on complete data. This helper loops
 * `.range(offset, offset + PAGE_SIZE - 1)` until the server returns a
 * short page, accumulating the full result set.
 *
 * Note: `.range()` mutates the builder, so we rebuild the query on every
 * iteration via the `buildQuery` thunk. Errors are logged and we return
 * whatever was fetched so far — matches the soft-fail style used by every
 * existing reader in this file.
 *
 * Use for any `sb.from('results').select(...)` call that isn't scoped to
 * a single run id (those stay well under 1000 rows per platform). Also
 * safe to use for other tables if they grow past the cap.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function paginateAll<T>(buildQuery: () => any, pageSize = 1000): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) {
      console.warn(`[db] paginateAll error at offset ${from}:`, error.message ?? error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
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
  // Buyer-journey stage from the new 5-stage taxonomy (learning, discovery,
  // evaluation, validation, acquisition). Populated by the batch runners
  // from prompt metadata. The Intent filter on the dashboard reads this
  // column; conversion_intent above is the deprecated three-level rating.
  intent_stage: string | null;
  competitor_mentions: Record<string, number> | null;
  created_at: string;
}

/** Filters that can be applied to any results query */
export interface QueryFilters {
  platform?: string;
  sentiment?: string;
  isotope?: string;
  conversionIntent?: string;
  date_from?: string;   // 'YYYY-MM-DD' inclusive lower bound on runs.run_date
  date_to?: string;     // 'YYYY-MM-DD' inclusive upper bound on runs.run_date
}

/**
 * Fetch all results for a client across all platforms (joined through runs table).
 * Supports platform, sentiment, isotope, conversion intent, and run_date range filters.
 */
export async function getAllResultsForClient(
  clientId: string,
  filters?: QueryFilters
): Promise<DbResult[]> {
  const sb = reader();
  if (!sb) return [];

  try {
    // Get run IDs for this client, scoped by date range if provided.
    let runsQuery = sb
      .from('runs')
      .select('id')
      .eq('client_id', clientId);
    if (filters?.date_from) runsQuery = runsQuery.gte('run_date', filters.date_from);
    if (filters?.date_to) runsQuery = runsQuery.lte('run_date', filters.date_to);
    const { data: runs, error: runsErr } = await runsQuery;

    if (runsErr || !runs || runs.length === 0) return [];
    const runIds = runs.map((r: any) => r.id);

    // Rebuild on every iteration — Supabase's `.range()` mutates the
    // builder, so reusing the same query object across pages is undefined.
    return await paginateAll<DbResult>(() => {
      let query = sb.from('results').select('*').in('run_id', runIds);
      if (filters?.platform && filters.platform !== 'all') query = query.eq('platform', filters.platform);
      if (filters?.sentiment && filters.sentiment !== 'all') query = query.eq('sentiment', filters.sentiment);
      if (filters?.isotope && filters.isotope !== 'all') query = query.eq('isotope', filters.isotope);
      // QueryFilters field is still named conversionIntent for now (URL param
      // is `intent`), but the column we filter is `intent_stage` — the
      // populated one. conversion_intent is null for any client that hasn't
      // had enrich-supabase-metrics.js run against it (i.e. all of them).
      if (filters?.conversionIntent && filters.conversionIntent !== 'all') {
        query = query.eq('intent_stage', filters.conversionIntent);
      }
      return query;
    });
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
  clientId: string,
  filters?: QueryFilters
): Promise<PlatformComparisonStats[]> {
  const results = await getAllResultsForClient(clientId, filters);
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
  filters?: QueryFilters
): Promise<OverviewStats | null> {
  const results = await getAllResultsForClient(clientId, filters);
  if (results.length === 0) return null;

  const total = results.length;
  const mentioned = results.filter(r => r.client_mentioned);
  const firstMention = results.filter(r => r.first_mention);
  const withCitations = results.filter(r => r.citation_count > 0);

  const mentionRate = mentioned.length / total;
  const firstMentionRate = firstMention.length / total;
  const citationRate = withCitations.length / total;

  // Competitor stats from competitor_mentions JSONB
  // competitor_mentions stores raw mention counts: {"Banana Republic": 1, "Everlane": 0, "Gap": 1}
  // count > 0 means the competitor was mentioned in that response
  const enrichedResults = results.filter(r => r.competitor_mentions && Object.keys(r.competitor_mentions).length > 0);
  const enrichedTotal = enrichedResults.length || 1; // avoid division by zero
  const competitorTotals = new Map<string, { mentions: number; total: number }>();
  for (const r of enrichedResults) {
    const cm = r.competitor_mentions!;
    for (const [name, count] of Object.entries(cm)) {
      if (!competitorTotals.has(name)) competitorTotals.set(name, { mentions: 0, total: 0 });
      const entry = competitorTotals.get(name)!;
      entry.total++;
      if ((count as number) > 0) entry.mentions++;
    }
  }
  // Use enriched result count as denominator (not all results, since un-enriched rows have no competitor data)
  for (const entry of competitorTotals.values()) {
    entry.total = enrichedTotal;
  }

  const competitorStats: CompetitorStat[] = [...competitorTotals.entries()]
    .map(([name, stats]) => ({
      name,
      mentionRate: stats.total > 0 ? stats.mentions / stats.total : 0,
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

  // Biggest gap topic: find where competitors beat client the most
  // Only use enriched results (those with competitor_mentions data) for competitor rates
  const topicData = new Map<string, {
    name: string;
    clientMentioned: number;
    total: number;
    competitorMentions: Map<string, number>; // competitor name → count of enriched results mentioning them
    enrichedTotal: number; // results with competitor_mentions data for this topic
  }>();
  for (const r of results) {
    const tid = r.topic_id;
    if (!topicData.has(tid)) {
      topicData.set(tid, { name: r.topic_name, clientMentioned: 0, total: 0, competitorMentions: new Map(), enrichedTotal: 0 });
    }
    const entry = topicData.get(tid)!;
    entry.total++;
    if (r.client_mentioned) entry.clientMentioned++;
    const cm = r.competitor_mentions;
    if (cm && Object.keys(cm).length > 0) {
      entry.enrichedTotal++;
      for (const [compName, count] of Object.entries(cm)) {
        if ((count as number) > 0) {
          entry.competitorMentions.set(compName, (entry.competitorMentions.get(compName) ?? 0) + 1);
        }
      }
    }
  }

  // Find topic with biggest gap (best competitor rate - client rate)
  // If no competitor beats client anywhere, find the topic with lowest client rate
  let biggestGapTopic = '';
  let biggestGapDelta = 0;
  let lowestClientTopic = '';
  let lowestClientRate = 1;

  for (const [, topic] of topicData) {
    if (topic.total === 0) continue;
    const clientRate = topic.clientMentioned / topic.total;

    // Track lowest client rate as fallback
    if (clientRate < lowestClientRate) {
      lowestClientRate = clientRate;
      lowestClientTopic = topic.name;
    }

    // Find best competitor rate for this topic (using enriched result count as denominator)
    let bestCompRate = 0;
    const compDenom = topic.enrichedTotal || topic.total; // fallback to total if no enriched data
    for (const [, count] of topic.competitorMentions) {
      const rate = count / compDenom;
      if (rate > bestCompRate) bestCompRate = rate;
    }

    const gap = bestCompRate - clientRate;
    if (gap > biggestGapDelta) {
      biggestGapDelta = gap;
      biggestGapTopic = topic.name;
    }
  }

  // Fallback: if no competitor leads anywhere, show lowest client topic as opportunity
  if (!biggestGapTopic && lowestClientTopic) {
    biggestGapTopic = lowestClientTopic;
    biggestGapDelta = 1 - lowestClientRate; // room to improve
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
  clientId: string,
  filters?: QueryFilters
): Promise<TopicPlatformStat[]> {
  const results = await getAllResultsForClient(clientId, filters);
  if (results.length === 0) return [];

  // Group by topic + platform
  const map = new Map<string, { name: string; platforms: Map<string, { mentioned: number; total: number }> }>();

  for (const r of results) {
    if (!r.topic_id) continue;
    if (!map.has(r.topic_id)) {
      map.set(r.topic_id, { name: r.topic_name || '', platforms: new Map() });
    }
    const topic = map.get(r.topic_id)!;
    // Prefer a non-empty topic_name from any result in this group
    if (!topic.name && r.topic_name) {
      topic.name = r.topic_name;
    }
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
    return { topicId, topicName: topic.name || slugToTitle(topicId), platforms };
  });
}

// ---------------------------------------------------------------------------
// Phase 2: Topic Isotope Stats (for Topics/Heatmap page)
// ---------------------------------------------------------------------------

export interface IsotopeStats {
  mentionRate: number;
  total: number;
  mentioned: number;
}

export interface TopicIsotopeRow {
  topicId: string;
  topicName: string;
  category: string;
  overallMentionRate: number;
  isotopes: Record<string, IsotopeStats>;
  competitorRates: Record<string, number>; // competitor name → mention rate
}

/**
 * Read the client's configured competitor list from `clients.config`. Accepts
 * both the flat `string[]` shape (used by the seed scripts) and the
 * `[{name, domains}]` shape (used by the generator). Returns [] when the
 * client row or competitors array is missing — callers decide whether that's
 * an empty state or a hard failure.
 */
async function fetchConfiguredCompetitors(clientId: string): Promise<string[]> {
  const sb = reader();
  if (!sb) return [];
  const { data } = await sb
    .from('clients').select('config').eq('id', clientId).maybeSingle();
  const cfg = (data?.config ?? {}) as {
    competitors?: Array<string | { name?: string }>;
  };
  return (cfg.competitors ?? [])
    .map((c) => (typeof c === 'string' ? c : c?.name))
    .filter((n): n is string => Boolean(n));
}

export async function getTopicIsotopeStats(
  clientId: string,
  filters?: QueryFilters
): Promise<TopicIsotopeRow[]> {
  const results = await getAllResultsForClient(clientId, filters);
  if (results.length === 0) return [];

  // Source of truth for which competitors should appear in every topic's
  // breakdown — not the observed mentions, which only contain brands that
  // actually showed up in at least one response. Without this seeding, a
  // competitor with zero mentions silently disappears from the topic table.
  const configuredCompetitors = await fetchConfiguredCompetitors(clientId);

  const map = new Map<string, {
    name: string;
    category: string;
    totalMentioned: number;
    totalCount: number;
    isotopes: Map<string, { mentioned: number; total: number }>;
    competitors: Map<string, number>;
  }>();

  for (const r of results) {
    const tid = r.topic_id;
    if (!map.has(tid)) {
      map.set(tid, {
        name: r.topic_name,
        category: '', // not stored in results, will be empty
        totalMentioned: 0,
        totalCount: 0,
        isotopes: new Map(),
        competitors: new Map(),
      });
    }
    const entry = map.get(tid)!;
    entry.totalCount++;
    if (r.client_mentioned) entry.totalMentioned++;

    // Isotope stats
    const iso = r.isotope ?? 'unknown';
    if (!entry.isotopes.has(iso)) entry.isotopes.set(iso, { mentioned: 0, total: 0 });
    const isoEntry = entry.isotopes.get(iso)!;
    isoEntry.total++;
    if (r.client_mentioned) isoEntry.mentioned++;

    // Competitor mentions
    const cm = r.competitor_mentions ?? {};
    for (const [name, count] of Object.entries(cm)) {
      if ((count as number) > 0) {
        entry.competitors.set(name, (entry.competitors.get(name) ?? 0) + 1);
      }
    }
  }

  return [...map.entries()].map(([topicId, entry]) => {
    const isotopes: Record<string, IsotopeStats> = {};
    for (const [iso, stats] of entry.isotopes) {
      isotopes[iso] = {
        mentionRate: stats.total > 0 ? stats.mentioned / stats.total : 0,
        total: stats.total,
        mentioned: stats.mentioned,
      };
    }
    const competitorRates: Record<string, number> = {};
    // Seed every configured competitor at 0 first, then overwrite with the
    // observed rate. Competitors with no mentions stay at 0 and still get a
    // column in the per-topic table.
    for (const name of configuredCompetitors) {
      competitorRates[name] = 0;
    }
    for (const [name, count] of entry.competitors) {
      competitorRates[name] = entry.totalCount > 0 ? count / entry.totalCount : 0;
    }
    return {
      topicId,
      topicName: entry.name,
      category: entry.category,
      overallMentionRate: entry.totalCount > 0 ? entry.totalMentioned / entry.totalCount : 0,
      isotopes,
      competitorRates,
    };
  });
}

// ---------------------------------------------------------------------------
// Phase 2: Competitor Overview (for Competitors page)
// ---------------------------------------------------------------------------

export interface CompetitorOverviewRow {
  name: string;
  isClient: boolean;
  mentionRate: number;
  totalMentions: number;
  totalResults: number;
  topTopics: string[];
  weakTopics: string[];
}

export async function getCompetitorOverview(
  clientId: string,
  filters?: QueryFilters
): Promise<CompetitorOverviewRow[]> {
  const results = await getAllResultsForClient(clientId, filters);
  if (results.length === 0) return [];

  const total = results.length;

  // Client stats
  const clientMentioned = results.filter(r => r.client_mentioned).length;

  // Fetch client name + configured competitor list. The competitor list is
  // the source of truth for which brands should appear in the rollup; the
  // observed mentions only contain brands that actually showed up in at
  // least one response, so without seeding, 0-mention competitors disappear.
  const sb = reader();
  let clientName = '';
  if (sb) {
    const { data: clientRow } = await sb
      .from('clients').select('name').eq('id', clientId).maybeSingle();
    clientName = clientRow?.name ?? '';
  }
  const configuredCompetitors = await fetchConfiguredCompetitors(clientId);

  // Seed compMap with every configured competitor at zero before accumulation.
  // The observed-mention loop below only adds to existing entries.
  const compMap = new Map<string, {
    mentions: number;
    topicMentions: Map<string, { mentioned: number; total: number }>;
  }>();
  for (const name of configuredCompetitors) {
    compMap.set(name, { mentions: 0, topicMentions: new Map() });
  }

  for (const r of results) {
    const cm = r.competitor_mentions ?? {};
    for (const [name, count] of Object.entries(cm)) {
      if (!compMap.has(name)) {
        compMap.set(name, { mentions: 0, topicMentions: new Map() });
      }
      const entry = compMap.get(name)!;
      if ((count as number) > 0) entry.mentions++;

      // Track per-topic for top/weak
      if (!entry.topicMentions.has(r.topic_id)) {
        entry.topicMentions.set(r.topic_id, { mentioned: 0, total: 0 });
      }
      const tm = entry.topicMentions.get(r.topic_id)!;
      tm.total++;
      if ((count as number) > 0) tm.mentioned++;
    }
  }

  const rows: CompetitorOverviewRow[] = [];

  // Add client as first entry
  rows.push({
    name: clientName,
    isClient: true,
    mentionRate: total > 0 ? clientMentioned / total : 0,
    totalMentions: clientMentioned,
    totalResults: total,
    topTopics: [],
    weakTopics: [],
  });

  // Add competitors
  for (const [name, stats] of compMap) {
    const topicRates: { topic: string; rate: number }[] = [];
    for (const [topicId, tm] of stats.topicMentions) {
      topicRates.push({ topic: topicId, rate: tm.total > 0 ? tm.mentioned / tm.total : 0 });
    }
    topicRates.sort((a, b) => b.rate - a.rate);

    rows.push({
      name,
      isClient: false,
      mentionRate: total > 0 ? stats.mentions / total : 0,
      totalMentions: stats.mentions,
      totalResults: total,
      topTopics: topicRates.slice(0, 3).map(t => t.topic),
      weakTopics: topicRates.slice(-3).map(t => t.topic),
    });
  }

  return rows.sort((a, b) => b.mentionRate - a.mentionRate);
}

// ---------------------------------------------------------------------------
// Phase 2: Gap Analysis (for Gap Analysis page)
// ---------------------------------------------------------------------------

export interface GapRow {
  topicId: string;
  topicName: string;
  clientRate: number;
  topCompetitor: string;
  competitorRate: number;
  gap: number; // competitorRate - clientRate (positive = competitor leads)
}

export async function getGapAnalysis(
  clientId: string,
  filters?: QueryFilters
): Promise<GapRow[]> {
  const results = await getAllResultsForClient(clientId, filters);
  if (results.length === 0) return [];

  // Group by topic
  const topicMap = new Map<string, {
    name: string;
    clientMentioned: number;
    total: number;
    competitors: Map<string, number>;
  }>();

  for (const r of results) {
    if (!topicMap.has(r.topic_id)) {
      topicMap.set(r.topic_id, { name: r.topic_name, clientMentioned: 0, total: 0, competitors: new Map() });
    }
    const entry = topicMap.get(r.topic_id)!;
    entry.total++;
    if (r.client_mentioned) entry.clientMentioned++;

    const cm = r.competitor_mentions ?? {};
    for (const [name, count] of Object.entries(cm)) {
      if ((count as number) > 0) {
        entry.competitors.set(name, (entry.competitors.get(name) ?? 0) + 1);
      }
    }
  }

  const rows: GapRow[] = [];
  for (const [topicId, entry] of topicMap) {
    const clientRate = entry.total > 0 ? entry.clientMentioned / entry.total : 0;

    // Find top competitor for this topic
    let topComp = '';
    let topCompRate = 0;
    for (const [name, count] of entry.competitors) {
      const rate = entry.total > 0 ? count / entry.total : 0;
      if (rate > topCompRate) {
        topCompRate = rate;
        topComp = name;
      }
    }

    rows.push({
      topicId,
      topicName: entry.name,
      clientRate,
      topCompetitor: topComp || 'N/A',
      competitorRate: topCompRate,
      gap: topCompRate - clientRate,
    });
  }

  return rows.sort((a, b) => b.gap - a.gap);
}

// ---------------------------------------------------------------------------
// Topic Detail (for /topics/[topicId] drill-down page)
// ---------------------------------------------------------------------------

export interface TopicDetailIsotope {
  isotope: string;
  totalResponses: number;
  responsesWithMention: number;
  responsesWithCitation: number;
  mentionRate: number;
  citationRate: number;
  totalCitationCount: number;
  competitorMentions: Record<string, number>;
  samplePromptText: string;
}

export interface TopicDetailCompetitor {
  name: string;
  mentionRate: number;
  totalMentions: number;
  isClient: boolean;
}

export interface TopicDetailData {
  topicId: string;
  topicName: string;
  clientName: string;
  totalResponses: number;
  responsesWithMention: number;
  clientMentionRate: number;
  clientFirstMentionRate: number;
  clientAvgMentionCount: number;
  clientTotalMentions: number;
  clientShareOfVoice: number;
  isotopes: TopicDetailIsotope[];
  competitors: TopicDetailCompetitor[];
}

/**
 * Per-topic drill-down data for /topics/[topicId]. Returns null when the
 * client has no results for this topic (caller renders a 404). Seeds the
 * competitor list from clients.config so 0-mention competitors still appear
 * in the comparison chart.
 *
 * Scopes the results query to `topic_id = topicId` at the DB layer instead
 * of fetching everything via getAllResultsForClient and filtering in JS.
 * Without this, the Supabase default 1000-row query limit can silently drop
 * a topic's rows when the client has many results across many topics — the
 * exact bug that 404'd drill-down for ScaledAgile's `value-streams` when
 * its 9 result rows all landed past the 1000-row cutoff.
 */
export async function getTopicDetail(
  clientId: string,
  topicId: string,
  filters?: QueryFilters
): Promise<TopicDetailData | null> {
  const sb = reader();
  if (!sb) return null;

  // Step 1: find this client's run IDs, optionally date-scoped.
  let runsQuery = sb.from('runs').select('id').eq('client_id', clientId);
  if (filters?.date_from) runsQuery = runsQuery.gte('run_date', filters.date_from);
  if (filters?.date_to) runsQuery = runsQuery.lte('run_date', filters.date_to);
  const { data: runs, error: runsErr } = await runsQuery;
  if (runsErr || !runs || runs.length === 0) return null;
  const runIds = (runs as Array<{ id: string }>).map((r) => r.id);

  // Step 2: pull this topic's results. Single-topic slices are small in
  // practice (one topic × ~4 platforms × ~7 days ≈ 30 rows), but paginate
  // defensively so we're robust against larger rollouts.
  const results = await paginateAll<DbResult>(() => {
    let query = sb
      .from('results')
      .select('*')
      .in('run_id', runIds)
      .eq('topic_id', topicId);
    if (filters?.platform && filters.platform !== 'all') query = query.eq('platform', filters.platform);
    if (filters?.sentiment && filters.sentiment !== 'all') query = query.eq('sentiment', filters.sentiment);
    if (filters?.isotope && filters.isotope !== 'all') query = query.eq('isotope', filters.isotope);
    // See getAllResultsForClient: filter on intent_stage, not the deprecated
    // conversion_intent column.
    if (filters?.conversionIntent && filters.conversionIntent !== 'all') {
      query = query.eq('intent_stage', filters.conversionIntent);
    }
    return query;
  });
  if (results.length === 0) return null;

  // Client name + configured competitor list (same shape as
  // getCompetitorOverview; kept inline to avoid an extra round-trip).
  let clientName = '';
  let configuredCompetitors: string[] = [];
  {
    const { data: clientRow } = await sb
      .from('clients').select('name, config').eq('id', clientId).maybeSingle();
    clientName = (clientRow?.name as string | undefined) ?? '';
    const cfg = (clientRow?.config ?? {}) as {
      competitors?: Array<string | { name?: string }>;
    };
    configuredCompetitors = (cfg.competitors ?? [])
      .map((c) => (typeof c === 'string' ? c : c?.name))
      .filter((n): n is string => Boolean(n));
  }

  // Per-prompt text lookup — pulled from the prompts table, same join
  // pattern as getPromptResults. Missing prompt_text falls back to empty.
  const promptIds = [...new Set(results.map((r) => r.prompt_id))];
  const promptTextMap = new Map<string, string>();
  if (promptIds.length > 0) {
    const { data: promptRows } = await sb
      .from('prompts')
      .select('prompt_id, prompt_text, isotope')
      .in('prompt_id', promptIds);
    for (const row of (promptRows ?? []) as Array<{ prompt_id: string; prompt_text: string | null }>) {
      if (row.prompt_text) promptTextMap.set(row.prompt_id, row.prompt_text);
    }
  }

  const totalResponses = results.length;
  const responsesWithMention = results.filter((r) => r.client_mentioned).length;
  const responsesWithFirstMention = results.filter((r) => r.first_mention).length;
  const clientTotalMentions = results.reduce((s, r) => s + (r.mention_count ?? 0), 0);
  const clientAvgMentionCount = totalResponses > 0 ? clientTotalMentions / totalResponses : 0;
  const clientMentionRate = totalResponses > 0 ? responsesWithMention / totalResponses : 0;
  const clientFirstMentionRate = totalResponses > 0 ? responsesWithFirstMention / totalResponses : 0;

  // Topic name from any result in the set. Prefer a non-empty one to avoid
  // rendering an empty heading when one batch row is missing topic_name.
  const topicName = results.find((r) => r.topic_name)?.topic_name ?? topicId;

  // Per-isotope aggregation.
  const byIsotope = new Map<string, {
    total: number;
    mentioned: number;
    cited: number;
    citationCount: number;
    competitors: Map<string, number>;
    samplePromptId: string;
  }>();

  for (const r of results) {
    const iso = r.isotope ?? 'unknown';
    if (!byIsotope.has(iso)) {
      byIsotope.set(iso, {
        total: 0,
        mentioned: 0,
        cited: 0,
        citationCount: 0,
        competitors: new Map(),
        samplePromptId: r.prompt_id,
      });
    }
    const entry = byIsotope.get(iso)!;
    entry.total++;
    if (r.client_mentioned) entry.mentioned++;
    if ((r.citation_count ?? 0) > 0) entry.cited++;
    entry.citationCount += r.citation_count ?? 0;

    const cm = r.competitor_mentions ?? {};
    for (const [name, count] of Object.entries(cm)) {
      if ((count as number) > 0) {
        entry.competitors.set(name, (entry.competitors.get(name) ?? 0) + (count as number));
      }
    }
  }

  const isotopes: TopicDetailIsotope[] = [...byIsotope.entries()].map(([iso, e]) => ({
    isotope: iso,
    totalResponses: e.total,
    responsesWithMention: e.mentioned,
    responsesWithCitation: e.cited,
    mentionRate: e.total > 0 ? e.mentioned / e.total : 0,
    citationRate: e.total > 0 ? e.cited / e.total : 0,
    totalCitationCount: e.citationCount,
    competitorMentions: Object.fromEntries(e.competitors),
    samplePromptText: promptTextMap.get(e.samplePromptId) ?? '',
  }));

  // Per-competitor aggregation across the whole topic. Seed with configured
  // competitors at zero so the comparison chart shows the full set rather
  // than only brands that happened to appear.
  const compCounts = new Map<string, { mentioned: number; total: number }>();
  for (const name of configuredCompetitors) {
    compCounts.set(name, { mentioned: 0, total: 0 });
  }
  for (const r of results) {
    const cm = r.competitor_mentions ?? {};
    for (const [name, count] of Object.entries(cm)) {
      if (!compCounts.has(name)) compCounts.set(name, { mentioned: 0, total: 0 });
      const entry = compCounts.get(name)!;
      if ((count as number) > 0) entry.mentioned += count as number;
    }
  }

  // Total competitor mentions across every response — used for share-of-voice.
  let totalCompetitorMentions = 0;
  for (const [, entry] of compCounts) totalCompetitorMentions += entry.mentioned;
  const clientShareOfVoice =
    clientTotalMentions + totalCompetitorMentions > 0
      ? clientTotalMentions / (clientTotalMentions + totalCompetitorMentions)
      : 0;

  const competitors: TopicDetailCompetitor[] = [];
  competitors.push({
    name: clientName,
    mentionRate: clientMentionRate,
    totalMentions: clientTotalMentions,
    isClient: true,
  });
  for (const [name, entry] of compCounts) {
    competitors.push({
      name,
      mentionRate: totalResponses > 0 ? entry.mentioned / totalResponses : 0,
      totalMentions: entry.mentioned,
      isClient: false,
    });
  }
  competitors.sort((a, b) => b.mentionRate - a.mentionRate);

  return {
    topicId,
    topicName,
    clientName,
    totalResponses,
    responsesWithMention,
    clientMentionRate,
    clientFirstMentionRate,
    clientAvgMentionCount,
    clientTotalMentions,
    clientShareOfVoice,
    isotopes,
    competitors,
  };
}

// ---------------------------------------------------------------------------
// Top Gaps (for the dashboard "Top Opportunities" card)
// ---------------------------------------------------------------------------

export interface TopGapRow {
  topicId: string;
  topicName: string;
  category: string;
  clientRate: number;
  topCompetitorName: string;
  topCompetitorRate: number;
  gap: number;
}

/**
 * For each topic where the client has results, return the gap to the
 * single best-performing competitor on that topic. Sorted biggest-gap first
 * and capped at `limit` rows. Used by TopGapsCard on the dashboard.
 *
 * Implementation note: piggy-backs on getTopicIsotopeStats (which already
 * computes per-topic competitorRates) rather than re-querying the results
 * table — keeps the SQL surface small and the gap math consistent with
 * what TopicCompetition shows.
 */
export async function getTopGaps(
  clientId: string,
  filters?: QueryFilters,
  limit = 5
): Promise<TopGapRow[]> {
  const topicStats = await getTopicIsotopeStats(clientId, filters);
  if (topicStats.length === 0) return [];

  const gaps: TopGapRow[] = [];
  for (const t of topicStats) {
    const competitorEntries = Object.entries(t.competitorRates ?? {});
    if (competitorEntries.length === 0) continue;

    // Pick the strongest competitor on this topic by mention rate.
    let topName = '';
    let topRate = 0;
    for (const [name, rate] of competitorEntries) {
      if (rate > topRate) {
        topRate = rate;
        topName = name;
      }
    }

    const gap = topRate - t.overallMentionRate;
    if (gap > 0) {
      gaps.push({
        topicId: t.topicId,
        topicName: t.topicName,
        category: t.category,
        clientRate: t.overallMentionRate,
        topCompetitorName: topName,
        topCompetitorRate: topRate,
        gap,
      });
    }
  }

  return gaps.sort((a, b) => b.gap - a.gap).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Phase 2: Prompt Results (for Prompt Detail page)
// ---------------------------------------------------------------------------

export interface PromptResultRow {
  promptId: string;
  topicId: string;
  topicName: string;
  isotope: string;
  promptText: string;
  results: Array<{
    platform: string;
    responseText: string;
    clientMentioned: boolean;
    citations: string[];
    sentiment: string | null;
    recommendationStrength: string | null;
    ctaPresent: boolean;
    competitorMentions: Record<string, number>;
  }>;
}

export async function getPromptResults(
  clientId: string,
  platform?: string,
  topicFilter?: string,
  isotopeFilter?: string,
  sentimentFilter?: string,
  conversionIntentFilter?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<PromptResultRow[]> {
  const sb = reader();
  if (!sb) return [];

  try {
    // Get run IDs, scoped by date range to match the global date filter on
    // every other page query.
    let runsQuery = sb.from('runs').select('id').eq('client_id', clientId);
    if (dateFrom) runsQuery = runsQuery.gte('run_date', dateFrom);
    if (dateTo) runsQuery = runsQuery.lte('run_date', dateTo);
    const { data: runs } = await runsQuery;
    if (!runs || runs.length === 0) return [];
    const runIds = runs.map((r: any) => r.id);

    // 226 prompts × 4 platforms ≈ 900 rows per run, multiplied by the
    // date range. Paginate to avoid the 1000-row silent cap.
    const data = await paginateAll<Record<string, unknown>>(() => {
      let query = sb
        .from('results')
        .select('prompt_id, topic_id, topic_name, isotope, response_text, client_mentioned, citations, sentiment, recommendation_strength, cta_present, competitor_mentions, platform')
        .in('run_id', runIds);
      if (platform && platform !== 'all') query = query.eq('platform', platform);
      if (topicFilter) query = query.eq('topic_id', topicFilter);
      if (isotopeFilter) query = query.eq('isotope', isotopeFilter);
      if (sentimentFilter && sentimentFilter !== 'all') query = query.eq('sentiment', sentimentFilter);
      // intent_stage column (new 5-stage taxonomy), not deprecated
      // conversion_intent. See getAllResultsForClient for the full note.
      if (conversionIntentFilter && conversionIntentFilter !== 'all') query = query.eq('intent_stage', conversionIntentFilter);
      return query;
    });
    if (data.length === 0) return [];

    // Group by prompt_id
    const promptMap = new Map<string, PromptResultRow>();
    for (const r of data as any[]) {
      if (!promptMap.has(r.prompt_id)) {
        promptMap.set(r.prompt_id, {
          promptId: r.prompt_id,
          topicId: r.topic_id,
          topicName: r.topic_name,
          isotope: r.isotope ?? 'unknown',
          promptText: '', // Not stored in results; will need prompts table lookup
          results: [],
        });
      }
      promptMap.get(r.prompt_id)!.results.push({
        platform: r.platform,
        responseText: r.response_text ?? '',
        clientMentioned: r.client_mentioned ?? false,
        citations: r.citations ?? [],
        sentiment: r.sentiment,
        recommendationStrength: r.recommendation_strength,
        ctaPresent: r.cta_present ?? false,
        competitorMentions: r.competitor_mentions ?? {},
      });
    }

    // Try to get prompt texts from prompts table
    const { data: prompts } = await sb
      .from('prompts')
      .select('prompt_id, prompt_text')
      .in('prompt_id', [...promptMap.keys()]);

    if (prompts) {
      for (const p of prompts as any[]) {
        const row = promptMap.get(p.prompt_id);
        if (row) row.promptText = p.prompt_text ?? '';
      }
    }

    return [...promptMap.values()];
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Daily / Weekly Aggregation (for Trends page + Weekly Summary card)
// ---------------------------------------------------------------------------

/**
 * Return the distinct run_date values for this client, sorted newest first.
 * Used to populate the Custom date filter dropdown — only dates that have
 * data are selectable.
 */
/**
 * Return the most recent run_date for this client, or null when the client
 * has no runs yet. Used by layout chrome (header, sidebar) to display the
 * "as of" date next to the client switcher.
 */
export async function getLatestRunDate(clientId: string): Promise<string | null> {
  const sb = reader();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from('runs')
      .select('run_date')
      .eq('client_id', clientId)
      .not('run_date', 'is', null)
      .order('run_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { run_date: string }).run_date ?? null;
  } catch { return null; }
}

export async function getAvailableRunDates(clientId: string): Promise<string[]> {
  const sb = reader();
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from('runs')
      .select('run_date')
      .eq('client_id', clientId)
      .not('run_date', 'is', null)
      .order('run_date', { ascending: false });

    if (error || !data) return [];
    const unique = [...new Set((data as Array<{ run_date: string }>).map((r) => r.run_date))];
    return unique;
  } catch { return []; }
}

export interface DailyTrendPoint {
  date: string;
  platforms: Record<string, { mention_rate: number; result_count: number }>;
  composite_mention_rate: number;
}

/**
 * Daily trend data for the Trends page. For each distinct run_date in
 * [date_from, date_to] (or the last N days if no range given), returns
 * per-platform mention rate and a composite weighted average.
 *
 * Reads aggregated mention_rate and prompt_count from the runs table
 * directly (populated by batch runner finalizeSupabaseRun), so this is
 * one cheap round-trip with no per-result scan.
 */
export async function getDailyTrends(
  clientId: string,
  filters?: { date_from?: string; date_to?: string; days?: number },
): Promise<DailyTrendPoint[]> {
  const sb = reader();
  if (!sb) return [];

  try {
    let query = sb
      .from('runs')
      .select('run_date, platform, mention_rate, prompt_count')
      .eq('client_id', clientId)
      .not('run_date', 'is', null);

    if (filters?.date_from) query = query.gte('run_date', filters.date_from);
    if (filters?.date_to) query = query.lte('run_date', filters.date_to);
    if (!filters?.date_from && !filters?.date_to) {
      const days = filters?.days ?? 7;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      query = query.gte('run_date', cutoff);
    }

    const { data, error } = await query.order('run_date', { ascending: true });
    if (error || !data) return [];

    type Row = { run_date: string; platform: string; mention_rate: number; prompt_count: number };
    const byDate = new Map<string, DailyTrendPoint>();

    for (const row of data as Row[]) {
      if (!byDate.has(row.run_date)) {
        byDate.set(row.run_date, {
          date: row.run_date,
          platforms: {},
          composite_mention_rate: 0,
        });
      }
      const point = byDate.get(row.run_date)!;
      point.platforms[row.platform] = {
        mention_rate: row.mention_rate ?? 0,
        result_count: row.prompt_count ?? 0,
      };
    }

    // Composite = prompt-weighted average across platforms for the day.
    for (const point of byDate.values()) {
      let totalPrompts = 0;
      let totalMentions = 0;
      for (const p of Object.values(point.platforms)) {
        totalPrompts += p.result_count;
        totalMentions += p.mention_rate * p.result_count;
      }
      point.composite_mention_rate = totalPrompts > 0 ? totalMentions / totalPrompts : 0;
    }

    return [...byDate.values()];
  } catch { return []; }
}

export interface WeeklySummary {
  startDate: string;
  endDate: string;
  daysOfData: number;
  startMentionRate: number;
  endMentionRate: number;
  deltaMentionRate: number;
  bestPlatform: { platform: string; mention_rate: number } | null;
  mostImprovedTopic: {
    topicId: string;
    topicName: string;
    startRate: number;
    endRate: number;
    delta: number;
  } | null;
}

/**
 * Compute a weekly summary card for the Overview page.
 *
 * Aggregates start-of-week vs end-of-week mention rates, picks the
 * best-performing platform at end-of-week, and identifies the topic with
 * the biggest week-over-week mention rate improvement.
 *
 * Returns null when fewer than 2 distinct dates exist — can't compute
 * a delta from a single day. The dashboard page gates WeeklySummary card
 * rendering on this null check.
 */
export async function getWeeklySummary(clientId: string): Promise<WeeklySummary | null> {
  const sb = reader();
  if (!sb) return null;

  try {
    const dates = await getAvailableRunDates(clientId);
    if (dates.length < 2) return null;

    const recent = dates.slice(0, 7);
    const endDate = recent[0]!;
    const startDate = recent[recent.length - 1]!;

    const { data: runs, error: runsErr } = await sb
      .from('runs')
      .select('id, run_date, platform, mention_rate, prompt_count')
      .eq('client_id', clientId)
      .in('run_date', [startDate, endDate]);
    if (runsErr || !runs || runs.length === 0) return null;

    type Row = { id: string; run_date: string; platform: string; mention_rate: number; prompt_count: number };
    const typed = runs as Row[];

    const weightedRate = (rows: Row[]): number => {
      let totalPrompts = 0;
      let totalMentions = 0;
      for (const r of rows) {
        totalPrompts += r.prompt_count ?? 0;
        totalMentions += (r.mention_rate ?? 0) * (r.prompt_count ?? 0);
      }
      return totalPrompts > 0 ? totalMentions / totalPrompts : 0;
    };

    const startRuns = typed.filter((r) => r.run_date === startDate);
    const endRuns = typed.filter((r) => r.run_date === endDate);
    const startMentionRate = weightedRate(startRuns);
    const endMentionRate = weightedRate(endRuns);

    let bestPlatform: WeeklySummary['bestPlatform'] = null;
    for (const r of endRuns) {
      if (!bestPlatform || r.mention_rate > bestPlatform.mention_rate) {
        bestPlatform = { platform: r.platform, mention_rate: r.mention_rate };
      }
    }

    const startRunIds = startRuns.map((r) => r.id);
    const endRunIds = endRuns.map((r) => r.id);
    const allRunIds = [...startRunIds, ...endRunIds];

    // start + end runs × 226 prompts × 4 platforms per run can exceed 1000.
    const results = await paginateAll<{ run_id: string; topic_id: string; topic_name: string; client_mentioned: boolean }>(
      () =>
        sb
          .from('results')
          .select('run_id, topic_id, topic_name, client_mentioned')
          .in('run_id', allRunIds)
    );

    let mostImprovedTopic: WeeklySummary['mostImprovedTopic'] = null;
    if (results.length > 0) {
      const startRunIdSet = new Set(startRunIds);
      const endRunIdSet = new Set(endRunIds);

      const topicStats = new Map<string, { name: string; startHits: number; startTotal: number; endHits: number; endTotal: number }>();
      for (const r of results) {
        const existing = topicStats.get(r.topic_id) ?? { name: r.topic_name, startHits: 0, startTotal: 0, endHits: 0, endTotal: 0 };
        if (startRunIdSet.has(r.run_id)) {
          existing.startTotal += 1;
          if (r.client_mentioned) existing.startHits += 1;
        }
        if (endRunIdSet.has(r.run_id)) {
          existing.endTotal += 1;
          if (r.client_mentioned) existing.endHits += 1;
        }
        topicStats.set(r.topic_id, existing);
      }

      let bestDelta = -Infinity;
      for (const [topicId, s] of topicStats.entries()) {
        if (s.startTotal === 0 || s.endTotal === 0) continue;
        const startRate = s.startHits / s.startTotal;
        const endRate = s.endHits / s.endTotal;
        const delta = endRate - startRate;
        if (delta > bestDelta) {
          bestDelta = delta;
          mostImprovedTopic = { topicId, topicName: s.name, startRate, endRate, delta };
        }
      }
    }

    return {
      startDate,
      endDate,
      daysOfData: recent.length,
      startMentionRate,
      endMentionRate,
      deltaMentionRate: endMentionRate - startMentionRate,
      bestPlatform,
      mostImprovedTopic,
    };
  } catch { return null; }
}
