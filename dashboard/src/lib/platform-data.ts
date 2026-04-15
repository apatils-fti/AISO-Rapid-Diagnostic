/**
 * Unified Platform Data Service
 *
 * Reads platform result data from Supabase (runs + results tables) for a
 * given clientId. The clientId is set once per page via <PlatformDataProvider>
 * and all exported query functions use the module-level current client.
 *
 * Perplexity and ChatGPT Search platform stats still come from the
 * pre-computed fixture (analyzedMetrics.json) — this legacy split is
 * preserved intentionally. Gemini, Claude, Google AI Overview stats come
 * from Supabase via the `results` table.
 */

import { analyzedMetrics, clientConfig, promptLibrary } from './fixtures';
import { PLATFORM_COLORS } from './colors';
import { supabaseAnon } from './supabase';

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

interface BatchResult {
  promptId: string;
  topicId: string;
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
  _cache = { batchData: {}, platformStats: null, loaded: false, clientId };
}

// ---------------------------------------------------------------------------
// Cache (keyed by clientId for staleness tracking)
// ---------------------------------------------------------------------------

let _cache: {
  batchData: Record<string, EnrichedResult[]>;
  platformStats: PlatformStats[] | null;
  loaded: boolean;
  clientId: string | null;
} = {
  batchData: {},
  platformStats: null,
  loaded: false,
  clientId: null,
};

// ---------------------------------------------------------------------------
// Text analysis helpers
// ---------------------------------------------------------------------------

const CLIENT_NAME = clientConfig.clientName;
const CLIENT_PATTERNS = [
  CLIENT_NAME.toLowerCase(),
  ...clientConfig.clientDomains.map((d) => d.toLowerCase()),
];
const COMPETITOR_NAMES = clientConfig.competitors.map((c) => c.name);

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

function isClientFirstMention(text: string): boolean {
  const lower = text.toLowerCase();
  const clientPos = lower.indexOf(CLIENT_NAME.toLowerCase());
  if (clientPos === -1) return false;

  for (const comp of COMPETITOR_NAMES) {
    const compPos = lower.indexOf(comp.toLowerCase());
    if (compPos !== -1 && compPos < clientPos) {
      return false;
    }
  }
  return true;
}

function findCompetitorsMentioned(text: string): string[] {
  const lower = text.toLowerCase();
  return COMPETITOR_NAMES.filter((name) => lower.includes(name.toLowerCase()));
}

function isClientCited(citations: string[]): boolean {
  return citations.some((url) =>
    CLIENT_PATTERNS.some((p) => url.toLowerCase().includes(p))
  );
}

function enrichResult(result: BatchResult): EnrichedResult {
  const text = result.responseText || '';
  const cited = isClientCited(result.citations);
  return {
    ...result,
    mentionCount: countMentions(text, CLIENT_NAME),
    isFirstMention: isClientFirstMention(text),
    competitorsMentioned: findCompetitorsMentioned(text),
    clientCited: cited,
    clientMentioned:
      text.toLowerCase().includes(CLIENT_NAME.toLowerCase()) || cited,
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
    responseText,
    citations,
    clientMentioned: Boolean(row.client_mentioned ?? false),
    timestamp: (row.created_at ?? '') as string,
    error: row.error as string | undefined,
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

    const { data: results, error: resultsError } = await supabaseAnon
      .from('results')
      .select('prompt_id, topic_id, response_text, citations, client_mentioned, created_at')
      .in('run_id', runIds);

    if (resultsError || !results) {
      if (resultsError) console.warn(`[platform-data] results query failed for ${platform}:`, resultsError.message);
      return [];
    }

    return (results as Array<Record<string, unknown>>)
      .map(normalizeSupabaseRow)
      .filter((r): r is BatchResult => r !== null)
      .map(enrichResult);
  } catch (err) {
    console.warn(`[platform-data] Supabase fetch failed for ${platform}:`, err);
    return [];
  }
}

/**
 * Lazy loader. No-op if clientId is not set (provider hasn't mounted) or if
 * the cache already matches the current clientId.
 */
async function ensureLoaded(): Promise<void> {
  if (!_currentClientId) return;
  if (_cache.loaded && _cache.clientId === _currentClientId) return;

  const clientId = _currentClientId;

  const [perplexityResults, chatgptResults, geminiResults, claudeResults, googleResults] =
    await Promise.all([
      fetchBatchResultsFromSupabase('perplexity', clientId),
      fetchBatchResultsFromSupabase('chatgpt_search', clientId),
      fetchBatchResultsFromSupabase('gemini', clientId),
      fetchBatchResultsFromSupabase('claude', clientId),
      fetchBatchResultsFromSupabase('google_ai_overview', clientId),
    ]);

  _cache = {
    batchData: {
      perplexity: perplexityResults,
      chatgpt_search: chatgptResults,
      gemini: geminiResults,
      claude: claudeResults,
      google_ai_overview: googleResults,
    },
    platformStats: null,
    loaded: true,
    clientId,
  };

  console.log(
    `[platform-data] Loaded from Supabase for clientId=${clientId}: Perplexity=${perplexityResults.length}, ChatGPT=${chatgptResults.length}, Gemini=${geminiResults.length}, Claude=${claudeResults.length}, Google=${googleResults.length}`,
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

function computeFixturePlatformStats(platform: string): PlatformStats {
  const meta = PLATFORM_META[platform];
  const breakdown = analyzedMetrics.summary.platformBreakdown[platform];
  const textMetrics = analyzedMetrics.textMetrics?.overall;

  if (!breakdown || !breakdown.available) {
    return {
      platform,
      displayName: meta.displayName,
      color: meta.color,
      brandMentionRate: 0,
      firstMentionRate: 0,
      avgMentionCount: 0,
      citationRate: 0,
      citationsAvailable: true,
      totalPrompts: 0,
      promptsWithMention: 0,
      promptsWithCitation: 0,
      available: false,
    };
  }

  const brandMentionRate =
    (breakdown as any).brandMentionRate ??
    textMetrics?.brandMentionRate ??
    0;

  const clientMetrics = textMetrics?.brandMetrics[CLIENT_NAME];
  const firstMentionRate = textMetrics?.firstMentionRate ?? 0;
  const avgMentionCount = clientMetrics?.avgMentionCount ?? 0;

  const totalPrompts = breakdown.totalPrompts ?? 0;
  const promptsWithMention = Math.round(brandMentionRate * totalPrompts);
  const promptsWithCitation = breakdown.promptsCited ?? 0;
  const citationRate = totalPrompts > 0 ? promptsWithCitation / totalPrompts : 0;

  return {
    platform,
    displayName: meta.displayName,
    color: meta.color,
    brandMentionRate,
    firstMentionRate,
    avgMentionCount,
    citationRate,
    citationsAvailable: true,
    totalPrompts,
    promptsWithMention,
    promptsWithCitation,
    available: true,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get stats for all platforms. Perplexity and ChatGPT Search come from the
 * fixture (legacy). Gemini/Claude/Google come from Supabase via the current
 * clientId set by <PlatformDataProvider>.
 */
export async function getAllPlatformStats(): Promise<PlatformStats[]> {
  if (typeof window === 'undefined') return [];

  await ensureLoaded();

  if (_cache.platformStats) return _cache.platformStats;

  const stats: PlatformStats[] = [
    computeFixturePlatformStats('perplexity'),
    computeFixturePlatformStats('chatgpt_search'),
    computeBatchPlatformStats('gemini', _cache.batchData.gemini || []),
    computeBatchPlatformStats('claude', _cache.batchData.claude || []),
    computeBatchPlatformStats('google_ai_overview', _cache.batchData.google_ai_overview || []),
  ];

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
 * Per-topic stats for each platform. Fixture-backed for Perplexity/ChatGPT,
 * Supabase-backed for Gemini/Claude.
 */
export async function getTopicPlatformStats(
  topicId: string,
): Promise<TopicPlatformStats[]> {
  if (typeof window === 'undefined') return [];

  await ensureLoaded();

  const stats: TopicPlatformStats[] = [];

  const topicTextMetrics = analyzedMetrics.textMetrics?.byTopic[topicId];
  for (const platform of ['perplexity', 'chatgpt_search'] as const) {
    const meta = PLATFORM_META[platform];
    const breakdown = analyzedMetrics.summary.platformBreakdown[platform];
    if (!breakdown?.available) continue;

    stats.push({
      platform,
      displayName: meta.displayName,
      color: meta.color,
      brandMentionRate: topicTextMetrics?.brandMentionRate ?? 0,
      totalPrompts: topicTextMetrics?.totalResponses ?? 0,
      promptsWithMention: topicTextMetrics?.responsesWithMention ?? 0,
    });
  }

  for (const platform of ['gemini', 'claude'] as const) {
    const meta = PLATFORM_META[platform];
    const results = (_cache.batchData[platform] || []).filter(
      (r) => r.topicId === topicId,
    );
    const total = results.length;
    const withMention = results.filter((r) => r.clientMentioned).length;

    stats.push({
      platform,
      displayName: meta.displayName,
      color: meta.color,
      brandMentionRate: total > 0 ? withMention / total : 0,
      totalPrompts: total,
      promptsWithMention: withMention,
    });
  }

  return stats;
}

/**
 * Generate an executive summary from the data.
 */
export async function getExecutiveSummary(): Promise<ExecutiveSummary> {
  const allStats = await getAllPlatformStats();
  const availableStats = allStats.filter((s) => s.available);

  const totalPrompts = availableStats.reduce((s, p) => s + p.totalPrompts, 0);
  const totalMentions = availableStats.reduce(
    (s, p) => s + p.promptsWithMention,
    0,
  );
  const overallMentionRate = totalPrompts > 0 ? totalMentions / totalPrompts : 0;

  const brandMetrics = analyzedMetrics.textMetrics?.overall.brandMetrics ?? {};
  const allBrands = Object.entries(brandMetrics)
    .map(([name, m]) => ({ name, rate: m.mentionRate }))
    .sort((a, b) => b.rate - a.rate);

  const clientRank = allBrands.findIndex((b) => b.name === CLIENT_NAME) + 1;
  const topCompetitor = allBrands.find((b) => b.name !== CLIENT_NAME);

  const topicResults = analyzedMetrics.topicResults;
  let biggestGapTopic = '';
  let biggestGapDelta = 0;

  for (const topic of topicResults) {
    const topicMetrics = analyzedMetrics.textMetrics?.byTopic[topic.topicId];
    if (!topicMetrics) continue;

    const clientRate =
      topicMetrics.brandMetrics[CLIENT_NAME]?.mentionRate ?? 0;
    for (const [compName, compMetrics] of Object.entries(
      topicMetrics.brandMetrics,
    )) {
      if (compName === CLIENT_NAME) continue;
      const delta = compMetrics.mentionRate - clientRate;
      if (delta > biggestGapDelta) {
        biggestGapDelta = delta;
        biggestGapTopic = topic.topicName;
      }
    }
  }

  return {
    clientName: CLIENT_NAME,
    overallMentionRate,
    rank: clientRank || 1,
    totalCompetitors: allBrands.length,
    topCompetitor: topCompetitor?.name ?? '',
    topCompetitorRate: topCompetitor?.rate ?? 0,
    biggestGapTopic,
    biggestGapDelta,
    platformCount: Object.keys(PLATFORM_META).length,
    platformsWithData: availableStats.length,
  };
}

/**
 * Compute overall brand metrics from all Supabase batch data.
 */
export async function getOverallBrandMetrics(): Promise<OverallBrandMetrics> {
  if (typeof window === 'undefined') {
    return {
      brandMentionRate: 0,
      firstMentionRate: 0,
      shareOfVoice: 0,
      citationRate: 0,
      totalResponses: 0,
      promptsWithMention: 0,
      promptsWithCitation: 0,
      competitorRates: {},
    };
  }

  await ensureLoaded();

  const allResults: EnrichedResult[] = Object.values(_cache.batchData).flat();
  const total = allResults.length;

  if (total === 0) {
    return {
      brandMentionRate: 0,
      firstMentionRate: 0,
      shareOfVoice: 0,
      citationRate: 0,
      totalResponses: 0,
      promptsWithMention: 0,
      promptsWithCitation: 0,
      competitorRates: {},
    };
  }

  const withMention = allResults.filter((r) => r.clientMentioned).length;
  const withFirstMention = allResults.filter((r) => r.isFirstMention).length;
  const withCitation = allResults.filter((r) => r.clientCited).length;

  const clientMentionCount = allResults.reduce((s, r) => s + r.mentionCount, 0);
  let totalBrandMentionCount = clientMentionCount;

  const competitorRates: OverallBrandMetrics['competitorRates'] = {};
  for (const comp of COMPETITOR_NAMES) {
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
        const clientPos = text.indexOf(CLIENT_NAME.toLowerCase());
        if (clientPos === -1 || compPos < clientPos) {
          let isFirst = true;
          for (const other of COMPETITOR_NAMES) {
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

let _promptIsotopeMap: Record<string, string> | null = null;
function getPromptIsotopeMap(): Record<string, string> {
  if (_promptIsotopeMap) return _promptIsotopeMap;
  _promptIsotopeMap = {};
  for (const topic of promptLibrary.topics) {
    for (const prompt of topic.prompts) {
      _promptIsotopeMap[prompt.id] = prompt.isotope;
    }
  }
  return _promptIsotopeMap;
}

/**
 * Per-topic, per-isotope mention/citation stats.
 */
export async function getTopicIsotopeStatsMap(
  platforms?: string[],
): Promise<Record<string, Record<string, TopicIsotopeStats>>> {
  if (typeof window === 'undefined') return {};
  await ensureLoaded();

  const isotopeMap = getPromptIsotopeMap();
  const platformKeys = platforms || Object.keys(_cache.batchData);

  const accum: Record<
    string,
    Record<string, { mentioned: number; cited: number; total: number }>
  > = {};

  for (const platform of platformKeys) {
    const results = _cache.batchData[platform] || [];
    for (const r of results) {
      const isotope = isotopeMap[r.promptId];
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
  _cache = { batchData: {}, platformStats: null, loaded: false, clientId: _currentClientId };
}
