/**
 * Unified Platform Data Service
 *
 * Normalizes data from two sources into a single API:
 *   - Perplexity / ChatGPT Search: pre-computed fixture data (analyzedMetrics.json)
 *   - Gemini 2.5 Flash / Claude Sonnet 4.6: raw batch results (public/scripts/*.json)
 *
 * All components should read platform data through this service instead of
 * directly accessing fixtures or localStorage.
 */

import { analyzedMetrics, clientConfig, promptLibrary } from './fixtures';
import { PLATFORM_COLORS } from './colors';

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

const BATCH_URLS: Record<string, string> = {
  perplexity: '/scripts/perplexity-batch-results.json',
  chatgpt_search: '/scripts/chatgpt-batch-results.json',
  gemini: '/scripts/gemini-batch-results.json',
  claude: '/scripts/claude-batch-results.json',
  google_ai_overview: '/scripts/google-batch-results.json',
};

// ---------------------------------------------------------------------------
// Internal types for batch data
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

interface BatchFile {
  metadata: {
    generatedAt: string;
    promptCount: number;
    requestsUsed: number;
    successCount: number;
    errorCount: number;
  };
  results: BatchResult[];
}

interface EnrichedResult extends BatchResult {
  mentionCount: number;
  isFirstMention: boolean;
  competitorsMentioned: string[];
  clientCited: boolean;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let _cache: {
  batchData: Record<string, EnrichedResult[]>;
  platformStats: PlatformStats[] | null;
  loaded: boolean;
} = {
  batchData: {},
  platformStats: null,
  loaded: false,
};

// ---------------------------------------------------------------------------
// Text analysis helpers
// ---------------------------------------------------------------------------

const CLIENT_NAME = clientConfig.clientName; // "J.Crew"
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

  // Check if any competitor appears before the client
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
    // clientMentioned: true if brand name appears in text OR client URL in citations
    clientMentioned:
      text.toLowerCase().includes(CLIENT_NAME.toLowerCase()) || cited,
  };
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Normalize a raw result object into a BatchResult.
 * Google AI Overview uses different field names (overviewText, citedSources, hasOverview).
 */
function normalizeBatchResult(raw: Record<string, unknown>): BatchResult | null {
  const responseText = (raw.responseText ?? raw.overviewText ?? '') as string;
  const citations = (raw.citations ?? raw.citedSources ?? []) as string[];

  return {
    promptId: raw.promptId as string,
    topicId: raw.topicId as string,
    responseText,
    citations: Array.isArray(citations) ? citations : [],
    clientMentioned: (raw.clientMentioned ?? false) as boolean,
    timestamp: (raw.timestamp ?? '') as string,
    error: raw.error as string | undefined,
  };
}

async function fetchBatchResults(platform: string): Promise<EnrichedResult[]> {
  const url = BATCH_URLS[platform];
  if (!url) return [];

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const rawResults: Record<string, unknown>[] = data.results;
    if (!rawResults || !Array.isArray(rawResults)) return [];

    // Normalize, filter to results with actual response text, then enrich
    return rawResults
      .map(normalizeBatchResult)
      .filter((r): r is BatchResult => r !== null && r.responseText.length > 0)
      .map(enrichResult);
  } catch (error) {
    console.warn(`[platform-data] Failed to load ${platform} batch:`, error);
    return [];
  }
}

async function ensureLoaded(): Promise<void> {
  if (_cache.loaded) return;

  // Fetch batch results for all 5 platforms in parallel
  const [perplexityResults, chatgptResults, geminiResults, claudeResults, googleResults] =
    await Promise.all([
      fetchBatchResults('perplexity'),
      fetchBatchResults('chatgpt_search'),
      fetchBatchResults('gemini'),
      fetchBatchResults('claude'),
      fetchBatchResults('google_ai_overview'),
    ]);

  _cache.batchData.perplexity = perplexityResults;
  _cache.batchData.chatgpt_search = chatgptResults;
  _cache.batchData.gemini = geminiResults;
  _cache.batchData.claude = claudeResults;
  _cache.batchData.google_ai_overview = googleResults;
  _cache.loaded = true;
  _cache.platformStats = null; // Invalidate computed stats

  console.log(
    `[platform-data] Loaded: Perplexity=${perplexityResults.length}, ChatGPT=${chatgptResults.length}, Gemini=${geminiResults.length}, Claude=${claudeResults.length}, Google=${googleResults.length}`
  );
}

// ---------------------------------------------------------------------------
// Stats computation from batch data
// ---------------------------------------------------------------------------

function computeBatchPlatformStats(
  platform: string,
  results: EnrichedResult[]
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
  // Citations are available if any result has a non-empty citations array
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

  // Use per-platform brandMentionRate from breakdown, fall back to combined textMetrics
  const brandMentionRate =
    (breakdown as any).brandMentionRate ??
    textMetrics?.brandMentionRate ??
    0;

  // Per-platform firstMentionRate and avgMentionCount aren't broken out in fixtures.
  // Use the combined values — these are Perplexity + ChatGPT combined.
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
 * Get stats for all platforms. Fetches batch data on first call.
 * Safe to call from useEffect — async.
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
  platform: string
): Promise<PlatformStats | null> {
  const all = await getAllPlatformStats();
  return all.find((s) => s.platform === platform) ?? null;
}

/**
 * Get all AI responses for a given prompt across all platforms.
 * Searches batch data for all 4 platforms.
 */
export async function getPromptResponses(
  promptId: string
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
 * Get all responses for a topic, grouped by platform.
 * Useful for the multi-platform prompt detail view.
 */
export async function getTopicResponses(
  topicId: string
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
 * Get per-topic stats for each platform.
 * Used by TopicComparisonTable to show per-topic breakdown.
 */
export async function getTopicPlatformStats(
  topicId: string
): Promise<TopicPlatformStats[]> {
  if (typeof window === 'undefined') return [];

  await ensureLoaded();

  const stats: TopicPlatformStats[] = [];

  // Fixture platforms — use textMetrics.byTopic
  const topicTextMetrics = analyzedMetrics.textMetrics?.byTopic[topicId];
  for (const platform of ['perplexity', 'chatgpt_search'] as const) {
    const meta = PLATFORM_META[platform];
    const breakdown = analyzedMetrics.summary.platformBreakdown[platform];
    if (!breakdown?.available) continue;

    // textMetrics.byTopic has combined stats, not per-platform.
    // Use the combined brandMentionRate as an approximation.
    stats.push({
      platform,
      displayName: meta.displayName,
      color: meta.color,
      brandMentionRate: topicTextMetrics?.brandMentionRate ?? 0,
      totalPrompts: topicTextMetrics?.totalResponses ?? 0,
      promptsWithMention: topicTextMetrics?.responsesWithMention ?? 0,
    });
  }

  // Batch platforms — compute from filtered results
  for (const platform of ['gemini', 'claude'] as const) {
    const meta = PLATFORM_META[platform];
    const results = (_cache.batchData[platform] || []).filter(
      (r) => r.topicId === topicId
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
 * Generate an executive summary sentence from the data.
 * Returns structured data that can be rendered as natural language.
 */
export async function getExecutiveSummary(): Promise<ExecutiveSummary> {
  const allStats = await getAllPlatformStats();
  const availableStats = allStats.filter((s) => s.available);

  // Client mention rate across all available platforms (weighted by prompt count)
  const totalPrompts = availableStats.reduce((s, p) => s + p.totalPrompts, 0);
  const totalMentions = availableStats.reduce(
    (s, p) => s + p.promptsWithMention,
    0
  );
  const overallMentionRate = totalPrompts > 0 ? totalMentions / totalPrompts : 0;

  // Competitor ranking
  const brandMetrics = analyzedMetrics.textMetrics?.overall.brandMetrics ?? {};
  const allBrands = Object.entries(brandMetrics)
    .map(([name, m]) => ({ name, rate: m.mentionRate }))
    .sort((a, b) => b.rate - a.rate);

  const clientRank = allBrands.findIndex((b) => b.name === CLIENT_NAME) + 1;
  const topCompetitor = allBrands.find((b) => b.name !== CLIENT_NAME);

  // Biggest gap topic
  const topicResults = analyzedMetrics.topicResults;
  let biggestGapTopic = '';
  let biggestGapDelta = 0;

  for (const topic of topicResults) {
    const topicMetrics = analyzedMetrics.textMetrics?.byTopic[topic.topicId];
    if (!topicMetrics) continue;

    const clientRate =
      topicMetrics.brandMetrics[CLIENT_NAME]?.mentionRate ?? 0;
    for (const [compName, compMetrics] of Object.entries(
      topicMetrics.brandMetrics
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
 * Compute overall brand metrics from all batch data.
 * Returns mention rates, citation rate, share of voice, and per-competitor rates.
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

  // Share of voice: client mention count / total brand mention count
  const clientMentionCount = allResults.reduce((s, r) => s + r.mentionCount, 0);
  let totalBrandMentionCount = clientMentionCount;

  // Per-competitor stats
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
        // Check if this competitor appears before the client
        const compPos = text.indexOf(cl);
        const clientPos = text.indexOf(CLIENT_NAME.toLowerCase());
        if (clientPos === -1 || compPos < clientPos) {
          // Check if first among ALL brands
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
 * Used by PromptTable to show per-prompt stats for the selected platform.
 */
export async function getAllResponsesForPlatform(
  platform: string
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

/** Lazily-built promptId → isotope mapping from the prompt library. */
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
 * Per-topic, per-isotope mention/citation stats computed from batch data.
 * Returns { [topicId]: { [isotope]: TopicIsotopeStats } }.
 * Optionally filter to specific platforms.
 */
export async function getTopicIsotopeStatsMap(
  platforms?: string[]
): Promise<Record<string, Record<string, TopicIsotopeStats>>> {
  if (typeof window === 'undefined') return {};
  await ensureLoaded();

  const isotopeMap = getPromptIsotopeMap();
  const platformKeys = platforms || Object.keys(_cache.batchData);

  // Accumulate: topicId → isotope → counts
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

  // Convert to TopicIsotopeStats
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
 * Per-topic (aggregated across all isotopes) mention/citation stats.
 * Returns { [topicId]: TopicIsotopeStats }.
 */
export async function getTopicStatsMap(
  platforms?: string[]
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
 * Get platform metadata (display name, color) for a platform key.
 */
export function getPlatformMeta(platform: string) {
  return PLATFORM_META[platform] ?? { displayName: platform, color: '#6B7280' };
}

/**
 * Get all platform keys in display order.
 */
export function getPlatformKeys(): string[] {
  return Object.keys(PLATFORM_META);
}

/**
 * Clear the cache (for testing or after re-import).
 */
export function clearCache(): void {
  _cache = { batchData: {}, platformStats: null, loaded: false };
}
