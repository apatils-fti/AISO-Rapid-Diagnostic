/**
 * Unified Platform Data Service
 *
 * Reads platform result data from Supabase (runs + results tables) for a
 * given clientId. The clientId is set once per page via <PlatformDataProvider>
 * and all exported query functions use the module-level current client.
 *
 * All five platforms (Perplexity, ChatGPT Search, Gemini, Claude, Google AI
 * Overview) read from Supabase. The old J.Crew fixture fallbacks were removed
 * — empty data now means "no Supabase rows for this client" rather than
 * silently rendering another client's snapshot.
 *
 * Brand name + competitor list also come from Supabase (clients.config)
 * rather than the static J.Crew fixture, so text analysis
 * (first-mention detection, citation matching, share-of-voice) is correct
 * for every client.
 */

import { PLATFORM_COLORS } from './colors';
import { supabaseAnon } from './supabase';
import { paginateAll } from './db';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlatformStats {
  platform: string;
  displayName: string;
  color: string;
  brandMentionRate: number;
  firstMentionRate: number;
  avgMentionCount: number;
  citationRate: number;
  citationsAvailable: boolean;
  totalPrompts: number;
  promptsWithMention: number;
  promptsWithCitation: number;
  available: boolean;
}

export interface PromptResponse {
  promptId: string;
  topicId: string;
  platform: string;
  displayName: string;
  responseText: string;
  citations: string[];
  clientMentioned: boolean;
  clientCited: boolean;
  competitorsMentioned: string[];
  timestamp: string;
}

export interface TopicPlatformStats {
  platform: string;
  displayName: string;
  color: string;
  brandMentionRate: number;
  totalPrompts: number;
  promptsWithMention: number;
}

export interface ExecutiveSummary {
  clientName: string;
  overallMentionRate: number;
  rank: number;
  totalCompetitors: number;
  topCompetitor: string;
  topCompetitorRate: number;
  biggestGapTopic: string;
  biggestGapDelta: number;
  platformCount: number;
  platformsWithData: number;
}

export interface OverallBrandMetrics {
  brandMentionRate: number;
  firstMentionRate: number;
  shareOfVoice: number;
  citationRate: number;
  totalResponses: number;
  promptsWithMention: number;
  promptsWithCitation: number;
  competitorRates: Record<
    string,
    { mentionRate: number; firstMentionRate: number; totalMentions: number }
  >;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_META: Record<string, { displayName: string; color: string }> = {
  perplexity: { displayName: 'Perplexity', color: PLATFORM_COLORS.perplexity },
  chatgpt_search: { displayName: 'ChatGPT Search', color: PLATFORM_COLORS.chatgpt_search },
  gemini: { displayName: 'Gemini 2.5 Flash', color: PLATFORM_COLORS.gemini },
  claude: { displayName: 'Claude Sonnet 4.6', color: PLATFORM_COLORS.claude },
  google_ai_overview: { displayName: 'Google AI Overview', color: PLATFORM_COLORS.google_ai_overview },
};

const SUPABASE_PLATFORMS = ['perplexity', 'chatgpt_search', 'gemini', 'claude', 'google_ai_overview'];

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ClientInfo {
  name: string;
  competitors: string[];
  clientDomains: string[];
}

interface BatchResult {
  promptId: string;
  topicId: string;
  isotope: string | null;
  responseText: string;
  citations: string[];
  clientMentioned: boolean;
  timestamp: string;
  error?: string;
}

interface EnrichedResult extends BatchResult {
  mentionCount: number;
  isFirstMention: boolean;
  competitorsMentioned: string[];
  clientCited: boolean;
}

// ---------------------------------------------------------------------------
// Client ID state (set by <PlatformDataProvider>)
// ---------------------------------------------------------------------------

let _currentClientId: string | null = null;

/**
 * Set the active Supabase client_id. Call via <PlatformDataProvider clientId={id}/>
 * placed in the page tree. Idempotent: re-calls with the same id are no-ops.
 * Switching to a new id invalidates the cache.
 */
export function setCurrentClientId(clientId: string | null): void {
  if (_currentClientId === clientId) return;
  _currentClientId = clientId;
  _cache = { batchData: {}, platformStats: null, clientInfo: null, loaded: false, clientId };
}

// ---------------------------------------------------------------------------
// Cache (keyed by clientId for staleness tracking)
// ---------------------------------------------------------------------------

let _cache: {
  batchData: Record<string, EnrichedResult[]>;
  platformStats: PlatformStats[] | null;
  clientInfo: ClientInfo | null;
  loaded: boolean;
  clientId: string | null;
} = {
  batchData: {},
  platformStats: null,
  clientInfo: null,
  loaded: false,
  clientId: null,
};

// ---------------------------------------------------------------------------
// Text analysis helpers — all take clientInfo explicitly so tests / callers
// can't accidentally reach for a stale module-level default.
// ---------------------------------------------------------------------------

function countMentions(text: string, brand: string): number {
  const lower = text.toLowerCase();
  const target = brand.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = lower.indexOf(target, pos)) !== -1) {
    count++;
    pos += target.length;
  }
  return count;
}

function isClientFirstMention(text: string, info: ClientInfo): boolean {
  const lower = text.toLowerCase();
  const clientPos = lower.indexOf(info.name.toLowerCase());
  if (clientPos === -1) return false;

  for (const comp of info.competitors) {
    const compPos = lower.indexOf(comp.toLowerCase());
    if (compPos !== -1 && compPos < clientPos) {
      return false;
    }
  }
  return true;
}

function findCompetitorsMentioned(text: string, info: ClientInfo): string[] {
  const lower = text.toLowerCase();
  return info.competitors.filter((name) => lower.includes(name.toLowerCase()));
}

function isClientCited(citations: string[], info: ClientInfo): boolean {
  const patterns = [
    info.name.toLowerCase(),
    ...info.clientDomains.map((d) => d.toLowerCase()),
  ];
  return citations.some((url) =>
    patterns.some((p) => url.toLowerCase().includes(p))
  );
}

function enrichResult(result: BatchResult, info: ClientInfo): EnrichedResult {
  const text = result.responseText || '';
  const cited = isClientCited(result.citations, info);
  return {
    ...result,
    mentionCount: countMentions(text, info.name),
    isFirstMention: isClientFirstMention(text, info),
    competitorsMentioned: findCompetitorsMentioned(text, info),
    clientCited: cited,
    clientMentioned:
      text.toLowerCase().includes(info.name.toLowerCase()) || cited,
  };
}

// ---------------------------------------------------------------------------
// Supabase data loading
// ---------------------------------------------------------------------------

/**
 * Normalize a Supabase `results` row into a BatchResult.
 * Drops rows without response text.
 */
function normalizeSupabaseRow(row: Record<string, unknown>): BatchResult | null {
  const responseText = (row.response_text ?? '') as string;
  if (!responseText || typeof responseText !== 'string' || responseText.length === 0) return null;

  const rawCitations = row.citations;
  const citations: string[] = Array.isArray(rawCitations)
    ? (rawCitations as unknown[]).filter((c): c is string => typeof c === 'string')
    : [];

  return {
    promptId: (row.prompt_id ?? '') as string,
    topicId: (row.topic_id ?? '') as string,
    isotope: (row.isotope as string | null) ?? null,
    responseText,
    citations,
    clientMentioned: Boolean(row.client_mentioned ?? false),
    timestamp: (row.created_at ?? '') as string,
    error: row.error as string | undefined,
  };
}

/**
 * Fetch the client row and shape it into a ClientInfo. Accepts flat string
 * competitor lists as well as `[{name, domains}]` shapes emitted by the
 * generator.
 */
async function fetchClientInfo(clientId: string): Promise<ClientInfo | null> {
  if (!supabaseAnon) return null;

  const { data, error } = await supabaseAnon
    .from('clients')
    .select('name, config')
    .eq('id', clientId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { name?: string; config?: Record<string, unknown> };
  const config = (row.config ?? {}) as {
    competitors?: Array<string | { name?: string; domains?: string[] }>;
    clientDomains?: string[];
    client?: { domains?: string[] };
  };

  const competitors = (config.competitors ?? [])
    .map((c) => (typeof c === 'string' ? c : c?.name))
    .filter((n): n is string => Boolean(n));

  const clientDomains =
    config.clientDomains ?? config.client?.domains ?? [];

  return {
    name: row.name ?? '',
    competitors,
    clientDomains,
  };
}

/**
 * Fetch results for a single platform from Supabase, scoped to a clientId.
 * Two-step query: first get run ids for (client_id, platform), then get
 * results for those run ids.
 */
async function fetchBatchResultsFromSupabase(
  platform: string,
  clientId: string,
  info: ClientInfo,
): Promise<EnrichedResult[]> {
  if (!supabaseAnon) return [];

  try {
    const { data: runs, error: runsError } = await supabaseAnon
      .from('runs')
      .select('id')
      .eq('client_id', clientId)
      .eq('platform', platform);

    if (runsError || !runs || runs.length === 0) {
      if (runsError) console.warn(`[platform-data] runs query failed for ${platform}:`, runsError.message);
      return [];
    }

    const runIds = (runs as Array<{ id: string }>).map((r) => r.id);
    const sb = supabaseAnon;

    // 226 prompts × 7 days of runs = ~1,580 rows per platform — comfortably
    // past the 1000-row silent cap. Paginate to fetch the full set.
    const results = await paginateAll<Record<string, unknown>>(() =>
      sb
        .from('results')
        .select('prompt_id, topic_id, isotope, response_text, citations, client_mentioned, created_at')
        .in('run_id', runIds)
    );

    return results
      .map(normalizeSupabaseRow)
      .filter((r): r is BatchResult => r !== null)
      .map((r) => enrichResult(r, info));
  } catch (err) {
    console.warn(`[platform-data] Supabase fetch failed for ${platform}:`, err);
    return [];
  }
}

/**
 * Lazy loader. No-op if clientId is not set (provider hasn't mounted) or if
 * the cache already matches the current clientId. Fetches client info first,
 * then platform data in parallel.
 */
async function ensureLoaded(): Promise<void> {
  if (!_currentClientId) return;
  if (_cache.loaded && _cache.clientId === _currentClientId) return;

  const clientId = _currentClientId;

  const info = await fetchClientInfo(clientId);
  if (!info) {
    // Hard-fail the load rather than silently producing empty text analysis
    // for an unknown client. Pages guard against missing data; they'll render
    // the empty state.
    console.warn(`[platform-data] No clients row for ${clientId}. Returning empty data.`);
    _cache = {
      batchData: Object.fromEntries(SUPABASE_PLATFORMS.map((p) => [p, []])),
      platformStats: null,
      clientInfo: null,
      loaded: true,
      clientId,
    };
    return;
  }

  const batchDataEntries = await Promise.all(
    SUPABASE_PLATFORMS.map(async (platform) => {
      const results = await fetchBatchResultsFromSupabase(platform, clientId, info);
      return [platform, results] as const;
    })
  );

  _cache = {
    batchData: Object.fromEntries(batchDataEntries) as Record<string, EnrichedResult[]>,
    platformStats: null,
    clientInfo: info,
    loaded: true,
    clientId,
  };

  console.log(
    `[platform-data] Loaded from Supabase for clientId=${clientId} (${info.name}):`,
    Object.fromEntries(batchDataEntries.map(([p, rs]) => [p, rs.length])),
  );
}

// ---------------------------------------------------------------------------
// Stats computation from batch data
// ---------------------------------------------------------------------------

function computeBatchPlatformStats(
  platform: string,
  results: EnrichedResult[],
): PlatformStats {
  const meta = PLATFORM_META[platform];
  const total = results.length;

  if (total === 0) {
    return {
      platform,
      displayName: meta.displayName,
      color: meta.color,
      brandMentionRate: 0,
      firstMentionRate: 0,
      avgMentionCount: 0,
      citationRate: 0,
      citationsAvailable: false,
      totalPrompts: 0,
      promptsWithMention: 0,
      promptsWithCitation: 0,
      available: false,
    };
  }

  const withMention = results.filter((r) => r.clientMentioned).length;
  const withFirstMention = results.filter((r) => r.isFirstMention).length;
  const totalMentionCount = results.reduce((sum, r) => sum + r.mentionCount, 0);
  const withClientCitation = results.filter((r) => r.clientCited).length;
  const hasCitations = results.some((r) => r.citations.length > 0);

  return {
    platform,
    displayName: meta.displayName,
    color: meta.color,
    brandMentionRate: withMention / total,
    firstMentionRate: withFirstMention / total,
    avgMentionCount: totalMentionCount / total,
    citationRate: withClientCitation / total,
    citationsAvailable: hasCitations,
    totalPrompts: total,
    promptsWithMention: withMention,
    promptsWithCitation: withClientCitation,
    available: true,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get stats for all platforms, all fetched from Supabase and scoped to the
 * current clientId set by <PlatformDataProvider>.
 */
export async function getAllPlatformStats(): Promise<PlatformStats[]> {
  if (typeof window === 'undefined') return [];

  await ensureLoaded();

  if (_cache.platformStats) return _cache.platformStats;

  const stats: PlatformStats[] = SUPABASE_PLATFORMS.map((platform) =>
    computeBatchPlatformStats(platform, _cache.batchData[platform] || [])
  );

  _cache.platformStats = stats;
  return stats;
}

/**
 * Get stats for a specific platform.
 */
export async function getPlatformStats(
  platform: string,
): Promise<PlatformStats | null> {
  const all = await getAllPlatformStats();
  return all.find((s) => s.platform === platform) ?? null;
}

/**
 * Get all AI responses for a given prompt across all platforms that have
 * data in Supabase.
 */
export async function getPromptResponses(
  promptId: string,
): Promise<PromptResponse[]> {
  if (typeof window === 'undefined') return [];

  await ensureLoaded();

  const responses: PromptResponse[] = [];

  for (const [platform, results] of Object.entries(_cache.batchData)) {
    const result = results.find((r) => r.promptId === promptId);
    if (result) {
      const meta = PLATFORM_META[platform];
      responses.push({
        promptId: result.promptId,
        topicId: result.topicId,
        platform,
        displayName: meta.displayName,
        responseText: result.responseText,
        citations: result.citations,
        clientMentioned: result.clientMentioned,
        clientCited: result.clientCited,
        competitorsMentioned: result.competitorsMentioned,
        timestamp: result.timestamp,
      });
    }
  }

  return responses;
}

/**
 * Get all responses for a topic, grouped by platform. Used by the
 * multi-platform prompt detail view.
 */
export async function getTopicResponses(
  topicId: string,
): Promise<Record<string, PromptResponse[]>> {
  if (typeof window === 'undefined') return {};

  await ensureLoaded();

  const byPlatform: Record<string, PromptResponse[]> = {};

  for (const [platform, results] of Object.entries(_cache.batchData)) {
    const meta = PLATFORM_META[platform];
    const topicResults = results.filter((r) => r.topicId === topicId);
    if (topicResults.length > 0) {
      byPlatform[platform] = topicResults.map((r) => ({
        promptId: r.promptId,
        topicId: r.topicId,
        platform,
        displayName: meta.displayName,
        responseText: r.responseText,
        citations: r.citations,
        clientMentioned: r.clientMentioned,
        clientCited: r.clientCited,
        competitorsMentioned: r.competitorsMentioned,
        timestamp: r.timestamp,
      }));
    }
  }

  return byPlatform;
}

/**
 * Per-topic stats for each platform, entirely from Supabase batch data.
 */
export async function getTopicPlatformStats(
  topicId: string,
): Promise<TopicPlatformStats[]> {
  if (typeof window === 'undefined') return [];

  await ensureLoaded();

  return SUPABASE_PLATFORMS.map((platform) => {
    const meta = PLATFORM_META[platform];
    const results = (_cache.batchData[platform] || []).filter(
      (r) => r.topicId === topicId,
    );
    const total = results.length;
    const withMention = results.filter((r) => r.clientMentioned).length;

    return {
      platform,
      displayName: meta.displayName,
      color: meta.color,
      brandMentionRate: total > 0 ? withMention / total : 0,
      totalPrompts: total,
      promptsWithMention: withMention,
    };
  });
}

/**
 * Generate an executive summary from the Supabase cache. Previously this
 * read pre-computed J.Crew aggregates from analyzedMetrics.json; it now
 * computes ranks + top competitor + biggest topic gap on the fly from the
 * current client's results.
 */
export async function getExecutiveSummary(): Promise<ExecutiveSummary> {
  const empty: ExecutiveSummary = {
    clientName: '',
    overallMentionRate: 0,
    rank: 1,
    totalCompetitors: 0,
    topCompetitor: '',
    topCompetitorRate: 0,
    biggestGapTopic: '',
    biggestGapDelta: 0,
    platformCount: SUPABASE_PLATFORMS.length,
    platformsWithData: 0,
  };

  if (typeof window === 'undefined') return empty;
  await ensureLoaded();

  const info = _cache.clientInfo;
  if (!info) return empty;

  const allResults: EnrichedResult[] = Object.values(_cache.batchData).flat();
  const total = allResults.length;
  if (total === 0) return { ...empty, clientName: info.name };

  const clientMentioned = allResults.filter((r) => r.clientMentioned).length;
  const overallMentionRate = clientMentioned / total;

  // Rank: client + every competitor, sorted by mention rate across all responses
  const brandRates = new Map<string, { mentioned: number; total: number }>();
  brandRates.set(info.name, { mentioned: clientMentioned, total });
  for (const comp of info.competitors) {
    brandRates.set(comp, { mentioned: 0, total });
  }
  const lowerCompetitors = info.competitors.map((c) => c.toLowerCase());
  for (const r of allResults) {
    const text = (r.responseText || '').toLowerCase();
    for (let i = 0; i < info.competitors.length; i++) {
      if (text.includes(lowerCompetitors[i])) {
        const entry = brandRates.get(info.competitors[i])!;
        entry.mentioned++;
      }
    }
  }

  const ranked = [...brandRates.entries()]
    .map(([name, v]) => ({ name, rate: v.total > 0 ? v.mentioned / v.total : 0 }))
    .sort((a, b) => b.rate - a.rate);

  const rank = ranked.findIndex((b) => b.name === info.name) + 1;
  const topCompetitor = ranked.find((b) => b.name !== info.name);

  // Biggest topic gap: per-topic, find the competitor most ahead of the client
  const perTopic = new Map<string, { topicId: string; counts: Map<string, { mentioned: number; total: number }> }>();
  for (const r of allResults) {
    if (!r.topicId) continue;
    if (!perTopic.has(r.topicId)) {
      perTopic.set(r.topicId, { topicId: r.topicId, counts: new Map() });
    }
    const bucket = perTopic.get(r.topicId)!;

    for (const brand of [info.name, ...info.competitors]) {
      if (!bucket.counts.has(brand)) {
        bucket.counts.set(brand, { mentioned: 0, total: 0 });
      }
      const entry = bucket.counts.get(brand)!;
      entry.total++;
    }

    const text = (r.responseText || '').toLowerCase();
    if (r.clientMentioned) bucket.counts.get(info.name)!.mentioned++;
    for (const comp of info.competitors) {
      if (text.includes(comp.toLowerCase())) {
        bucket.counts.get(comp)!.mentioned++;
      }
    }
  }

  let biggestGapTopic = '';
  let biggestGapDelta = 0;
  for (const { topicId, counts } of perTopic.values()) {
    const clientEntry = counts.get(info.name);
    const clientRate = clientEntry && clientEntry.total > 0 ? clientEntry.mentioned / clientEntry.total : 0;
    for (const comp of info.competitors) {
      const compEntry = counts.get(comp);
      if (!compEntry || compEntry.total === 0) continue;
      const compRate = compEntry.mentioned / compEntry.total;
      const delta = compRate - clientRate;
      if (delta > biggestGapDelta) {
        biggestGapDelta = delta;
        biggestGapTopic = topicId;
      }
    }
  }

  const platformsWithData = SUPABASE_PLATFORMS.filter((p) => (_cache.batchData[p] ?? []).length > 0).length;

  return {
    clientName: info.name,
    overallMentionRate,
    rank: rank || 1,
    totalCompetitors: ranked.length,
    topCompetitor: topCompetitor?.name ?? '',
    topCompetitorRate: topCompetitor?.rate ?? 0,
    biggestGapTopic,
    biggestGapDelta,
    platformCount: SUPABASE_PLATFORMS.length,
    platformsWithData,
  };
}

/**
 * Compute overall brand metrics from all Supabase batch data, using the
 * current client's name and competitor list.
 */
export async function getOverallBrandMetrics(): Promise<OverallBrandMetrics> {
  const empty: OverallBrandMetrics = {
    brandMentionRate: 0,
    firstMentionRate: 0,
    shareOfVoice: 0,
    citationRate: 0,
    totalResponses: 0,
    promptsWithMention: 0,
    promptsWithCitation: 0,
    competitorRates: {},
  };

  if (typeof window === 'undefined') return empty;

  await ensureLoaded();

  const info = _cache.clientInfo;
  if (!info) return empty;

  const allResults: EnrichedResult[] = Object.values(_cache.batchData).flat();
  const total = allResults.length;

  if (total === 0) return empty;

  const withMention = allResults.filter((r) => r.clientMentioned).length;
  const withFirstMention = allResults.filter((r) => r.isFirstMention).length;
  const withCitation = allResults.filter((r) => r.clientCited).length;

  const clientMentionCount = allResults.reduce((s, r) => s + r.mentionCount, 0);
  let totalBrandMentionCount = clientMentionCount;

  const competitorRates: OverallBrandMetrics['competitorRates'] = {};
  const clientLower = info.name.toLowerCase();
  for (const comp of info.competitors) {
    const cl = comp.toLowerCase();
    let compMentions = 0;
    let compPromptsMentioned = 0;
    let compPromptsFirst = 0;

    for (const r of allResults) {
      const text = (r.responseText || '').toLowerCase();
      let count = 0;
      let pos = 0;
      while ((pos = text.indexOf(cl, pos)) !== -1) {
        count++;
        pos += cl.length;
      }
      if (count > 0) {
        compPromptsMentioned++;
        compMentions += count;
        const compPos = text.indexOf(cl);
        const clientPos = text.indexOf(clientLower);
        if (clientPos === -1 || compPos < clientPos) {
          let isFirst = true;
          for (const other of info.competitors) {
            if (other === comp) continue;
            const otherPos = text.indexOf(other.toLowerCase());
            if (otherPos !== -1 && otherPos < compPos) {
              isFirst = false;
              break;
            }
          }
          if (isFirst && (clientPos === -1 || compPos < clientPos)) {
            compPromptsFirst++;
          }
        }
      }
    }

    totalBrandMentionCount += compMentions;
    competitorRates[comp] = {
      mentionRate: compPromptsMentioned / total,
      firstMentionRate: compPromptsFirst / total,
      totalMentions: compMentions,
    };
  }

  return {
    brandMentionRate: withMention / total,
    firstMentionRate: withFirstMention / total,
    shareOfVoice: totalBrandMentionCount > 0 ? clientMentionCount / totalBrandMentionCount : 0,
    citationRate: withCitation / total,
    totalResponses: total,
    promptsWithMention: withMention,
    promptsWithCitation: withCitation,
    competitorRates,
  };
}

/**
 * Get all responses for a given platform, keyed by promptId.
 */
export async function getAllResponsesForPlatform(
  platform: string,
): Promise<Record<string, PromptResponse>> {
  if (typeof window === 'undefined') return {};

  await ensureLoaded();

  const results = _cache.batchData[platform] || [];
  const meta = PLATFORM_META[platform] ?? { displayName: platform, color: '#6B7280' };
  const map: Record<string, PromptResponse> = {};

  for (const r of results) {
    map[r.promptId] = {
      promptId: r.promptId,
      topicId: r.topicId,
      platform,
      displayName: meta.displayName,
      responseText: r.responseText,
      citations: r.citations,
      clientMentioned: r.clientMentioned,
      clientCited: r.clientCited,
      competitorsMentioned: r.competitorsMentioned,
      timestamp: r.timestamp,
    };
  }

  return map;
}

// ---------------------------------------------------------------------------
// Topic × Isotope stats from batch data
// ---------------------------------------------------------------------------

export interface TopicIsotopeStats {
  mentionRate: number;
  citationRate: number;
  totalPrompts: number;
  promptsWithMention: number;
  promptsWithCitation: number;
}

/**
 * Per-topic, per-isotope mention/citation stats. Isotope comes from the
 * results table row (`isotope` column) rather than a static J.Crew prompt
 * library map, so the heatmap is correct for every client.
 */
export async function getTopicIsotopeStatsMap(
  platforms?: string[],
): Promise<Record<string, Record<string, TopicIsotopeStats>>> {
  if (typeof window === 'undefined') return {};
  await ensureLoaded();

  const platformKeys = platforms || Object.keys(_cache.batchData);

  const accum: Record<
    string,
    Record<string, { mentioned: number; cited: number; total: number }>
  > = {};

  for (const platform of platformKeys) {
    const results = _cache.batchData[platform] || [];
    for (const r of results) {
      const isotope = r.isotope;
      if (!isotope) continue;

      if (!accum[r.topicId]) accum[r.topicId] = {};
      if (!accum[r.topicId][isotope])
        accum[r.topicId][isotope] = { mentioned: 0, cited: 0, total: 0 };

      const bucket = accum[r.topicId][isotope];
      bucket.total++;
      if (r.clientMentioned) bucket.mentioned++;
      if (r.clientCited) bucket.cited++;
    }
  }

  const result: Record<string, Record<string, TopicIsotopeStats>> = {};
  for (const [topicId, isotopes] of Object.entries(accum)) {
    result[topicId] = {};
    for (const [isotope, b] of Object.entries(isotopes)) {
      result[topicId][isotope] = {
        mentionRate: b.total > 0 ? b.mentioned / b.total : 0,
        citationRate: b.total > 0 ? b.cited / b.total : 0,
        totalPrompts: b.total,
        promptsWithMention: b.mentioned,
        promptsWithCitation: b.cited,
      };
    }
  }

  return result;
}

/**
 * Per-topic aggregated stats across all isotopes.
 */
export async function getTopicStatsMap(
  platforms?: string[],
): Promise<Record<string, TopicIsotopeStats>> {
  if (typeof window === 'undefined') return {};
  await ensureLoaded();

  const platformKeys = platforms || Object.keys(_cache.batchData);
  const accum: Record<
    string,
    { mentioned: number; cited: number; total: number }
  > = {};

  for (const platform of platformKeys) {
    const results = _cache.batchData[platform] || [];
    for (const r of results) {
      if (!accum[r.topicId])
        accum[r.topicId] = { mentioned: 0, cited: 0, total: 0 };
      const bucket = accum[r.topicId];
      bucket.total++;
      if (r.clientMentioned) bucket.mentioned++;
      if (r.clientCited) bucket.cited++;
    }
  }

  const result: Record<string, TopicIsotopeStats> = {};
  for (const [topicId, b] of Object.entries(accum)) {
    result[topicId] = {
      mentionRate: b.total > 0 ? b.mentioned / b.total : 0,
      citationRate: b.total > 0 ? b.cited / b.total : 0,
      totalPrompts: b.total,
      promptsWithMention: b.mentioned,
      promptsWithCitation: b.cited,
    };
  }

  return result;
}

/**
 * Get platform metadata (display name, color) for a platform key. Pure.
 */
export function getPlatformMeta(platform: string) {
  return PLATFORM_META[platform] ?? { displayName: platform, color: '#6B7280' };
}

/**
 * Get all platform keys in display order. Pure.
 */
export function getPlatformKeys(): string[] {
  return Object.keys(PLATFORM_META);
}

/**
 * Clear the cache (testing / manual invalidation).
 */
export function clearCache(): void {
  _cache = { batchData: {}, platformStats: null, clientInfo: null, loaded: false, clientId: _currentClientId };
}
