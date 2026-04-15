// ─── Types ───────────────────────────────────────────────────

export interface EnrichedResult {
  id: string;
  run_id: string;
  prompt_id: string;
  platform: string;
  response_text: string;
  client_mentioned: boolean;
  isotope: string;
  topic_name: string;
  sentiment: string | null;
  recommendation_strength: string;
  cta_present: boolean;
  decision_criteria_winner: boolean;
  conversion_intent: string;
  citations: string[];
  classified_citations: Array<{ url: string; type: string; domain: string }> | null;
  created_at: string;
}

export interface VisibilityScore {
  mentionRate: number;
  shareOfVoice: number;
  firstMentionRate: number;
  citationRate: number;
  platformSpread: number | null;
  platformSpreadPromptCount: number;
  composite: number;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  hedged: number;
  negative: number;
  not_mentioned: number;
}

export interface CitationSourceBreakdown {
  owned: number;
  earned_editorial: number;
  earned_blog: number;
  earned_news: number;
  earned_review: number;
  community: number;
  retail: number;
  competitor: number;
  reference: number;
  other: number;
  totalCitations: number;
}

export interface TrustScore {
  citationRate: number;
  sentimentBreakdown: SentimentBreakdown;
  citationSources: CitationSourceBreakdown;
  topicDominanceScore: number;
  composite: number;
}

export interface IsotopeBreakdown {
  isotope: string;
  mentionRate: number;
  total: number;
  mentioned: number;
}

export interface AcquisitionScore {
  conversionQueryMentionRate: number;
  ctaPresenceRate: number;
  highIntentMentionRate: number;
  isotopeBreakdown: IsotopeBreakdown[];
  composite: number;
}

export interface RecommendationScore {
  recommendationRate: number;
  strongRecommendationRate: number;
  qualifiedRecommendationRate: number;
  decisionCriteriaWinRate: number;
  composite: number;
}

// ─── Archetype Weights ───────────────────────────────────────

export interface PillarWeights {
  visibility: Record<string, number>;
  trust: Record<string, number>;
  acquisition: Record<string, number>;
  recommendation: Record<string, number>;
}

const DEFAULT_WEIGHTS: PillarWeights = {
  visibility: { mentionRate: 0.35, shareOfVoice: 0.30, firstMentionRate: 0.20, platformSpread: 0.15 },
  trust: { citationRate: 0.30, sentimentPositive: 0.45, topicDominance: 0.25 },
  acquisition: { highIntentMentionRate: 0.40, conversionQueryMentionRate: 0.35, ctaPresenceRate: 0.25 },
  recommendation: { recommendationRate: 0.35, strongRecommendationRate: 0.30, decisionCriteriaWinRate: 0.35 },
};

export const ARCHETYPE_WEIGHTS: Record<string, PillarWeights> = {
  'transactional-commerce': {
    visibility: { mentionRate: 0.40, shareOfVoice: 0.25, firstMentionRate: 0.15, platformSpread: 0.20 },
    trust: { citationRate: 0.20, sentimentPositive: 0.40, topicDominance: 0.40 },
    acquisition: { highIntentMentionRate: 0.45, conversionQueryMentionRate: 0.35, ctaPresenceRate: 0.20 },
    recommendation: { recommendationRate: 0.35, strongRecommendationRate: 0.30, decisionCriteriaWinRate: 0.35 },
  },
  'trust-based-advisory': {
    visibility: { mentionRate: 0.10, shareOfVoice: 0.25, firstMentionRate: 0.30, platformSpread: 0.35 },
    trust: { citationRate: 0.30, sentimentPositive: 0.35, topicDominance: 0.35 },
    acquisition: { highIntentMentionRate: 0.30, conversionQueryMentionRate: 0.30, ctaPresenceRate: 0.40 },
    recommendation: { recommendationRate: 0.25, strongRecommendationRate: 0.35, decisionCriteriaWinRate: 0.40 },
  },
  'b2b': {
    visibility: { mentionRate: 0.10, shareOfVoice: 0.30, firstMentionRate: 0.25, platformSpread: 0.35 },
    trust: { citationRate: 0.25, sentimentPositive: 0.30, topicDominance: 0.45 },
    acquisition: { highIntentMentionRate: 0.35, conversionQueryMentionRate: 0.35, ctaPresenceRate: 0.30 },
    recommendation: { recommendationRate: 0.35, strongRecommendationRate: 0.30, decisionCriteriaWinRate: 0.35 },
  },
  'digital-media': {
    visibility: { mentionRate: 0.20, shareOfVoice: 0.30, firstMentionRate: 0.10, platformSpread: 0.40 },
    trust: { citationRate: 0.40, sentimentPositive: 0.30, topicDominance: 0.30 },
    acquisition: { highIntentMentionRate: 0.40, conversionQueryMentionRate: 0.35, ctaPresenceRate: 0.25 },
    recommendation: { recommendationRate: 0.35, strongRecommendationRate: 0.30, decisionCriteriaWinRate: 0.35 },
  },
  'local-experiences': {
    visibility: { mentionRate: 0.35, shareOfVoice: 0.15, firstMentionRate: 0.20, platformSpread: 0.30 },
    trust: { citationRate: 0.20, sentimentPositive: 0.30, topicDominance: 0.50 },
    acquisition: { highIntentMentionRate: 0.40, conversionQueryMentionRate: 0.35, ctaPresenceRate: 0.25 },
    recommendation: { recommendationRate: 0.35, strongRecommendationRate: 0.30, decisionCriteriaWinRate: 0.35 },
  },
};

export function getWeightsForArchetype(archetype?: string): PillarWeights {
  if (!archetype) return DEFAULT_WEIGHTS;
  return ARCHETYPE_WEIGHTS[archetype] ?? DEFAULT_WEIGHTS;
}

// ─── Regex Classifiers (exported for testing) ────────────────

const STRONG_REC = /(?<!not |don't |wouldn't |never |not the )(I highly recommend|best option|top choice|top pick|stands out as the best|first choice)/i;
const QUALIFIED_REC = /(?<!not |don't |wouldn't |never |not a |not the )(I recommend|good option|worth considering|solid choice|a great option|worth trying|ideal for)/i;
const CTA_PATTERN = /visit jcrew\.com|shop at j\.?crew|buy from j\.?crew|find at j\.?crew|check out j\.?crew|jcrew\.com\/|shop\.jcrew/i;

export function classifyRecommendationStrength(text: string): 'strong' | 'qualified' | 'absent' {
  if (STRONG_REC.test(text)) return 'strong';
  if (QUALIFIED_REC.test(text)) return 'qualified';
  return 'absent';
}

export function detectCta(text: string): boolean {
  return CTA_PATTERN.test(text);
}

export function detectDecisionCriteriaWinner(
  text: string,
  isotope: string,
  brandName: string
): boolean {
  if (isotope !== 'comparative') return false;
  const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return false;
  const lastTwo = sentences.slice(-2);
  const brandRegex = new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return lastTwo.some(s => brandRegex.test(s));
}

/**
 * Legacy 6-isotope → new 5-isotope taxonomy fallback map.
 *
 * The Supabase `results.isotope` column still holds old values for runs made
 * before the 5×5 taxonomy refactor. New generator runs will write the new
 * values directly; until that data lands, we normalize at read time.
 *
 * Many-to-one collapses: `informational` and `commercial` both map to
 * `declarative`. No isotope maps to multiple new values.
 */
const LEGACY_ISOTOPE_MAP: Record<string, string> = {
  informational: 'declarative',
  commercial: 'declarative',
  comparative: 'comparative',
  persona: 'situated',
  specific: 'constrained',
  conversational: 'adversarial',
};

/**
 * Display labels for the new 5-isotope taxonomy. Used by the Acquisition
 * pillar card's "By Isotope" breakdown.
 */
export const ISOTOPE_LABELS: Record<string, string> = {
  declarative: 'Declarative',
  comparative: 'Comparative',
  situated: 'Situated',
  constrained: 'Constrained',
  adversarial: 'Adversarial',
};

/**
 * Normalize a result's isotope to the new 5-value taxonomy.
 *
 * Reads only the `isotope` column, not `intent_stage` — intent is a
 * separate axis (buyer goal) and is NOT interchangeable with isotope
 * (question style). Intent-based breakdowns are a separate feature.
 *
 * - If the row already has a new-taxonomy value, pass through.
 * - If the row has an old-taxonomy value, map via LEGACY_ISOTOPE_MAP.
 * - Otherwise, return 'unknown' (caller should drop from aggregations).
 */
export function getNormalizedIsotope(r: { isotope: string | null | undefined }): string {
  const iso = r.isotope || '';
  if (ISOTOPE_LABELS[iso]) return iso;
  if (LEGACY_ISOTOPE_MAP[iso]) return LEGACY_ISOTOPE_MAP[iso];
  return 'unknown';
}

/**
 * Determine if the client brand appears in the response text before any
 * competitor. Returns false if the client isn't mentioned at all.
 * Case-insensitive substring match.
 */
export function isClientFirstMention(
  text: string,
  clientName: string,
  competitorNames: string[],
): boolean {
  if (!text || !clientName) return false;
  const lower = text.toLowerCase();
  const clientPos = lower.indexOf(clientName.toLowerCase());
  if (clientPos === -1) return false;
  for (const comp of competitorNames) {
    if (!comp) continue;
    const compPos = lower.indexOf(comp.toLowerCase());
    if (compPos !== -1 && compPos < clientPos) return false;
  }
  return true;
}

export function mapConversionIntent(isotope: string): 'high' | 'medium' | 'low' {
  // Legacy low-intent distinctions that do NOT survive the new-taxonomy
  // collapse: `informational` and `conversational` both normalize into
  // the declarative/adversarial buckets, which are "high" and "low"
  // respectively. But their original intent semantics were both "low"
  // (just asking, not buying). Preserve the old rating explicitly before
  // routing through the normalization helper.
  if (isotope === 'informational' || isotope === 'conversational') return 'low';

  // Everything else normalizes cleanly:
  //   commercial / specific → constrained / declarative → high
  //   comparative            → comparative              → medium
  //   persona                → situated                 → medium
  //   plus the new-taxonomy values (declarative, constrained, etc.) pass
  //   through unchanged.
  const iso = getNormalizedIsotope({ isotope });
  if (iso === 'constrained' || iso === 'declarative') return 'high';
  if (iso === 'comparative' || iso === 'situated') return 'medium';
  return 'low';
}

// ─── Pillar Score Computation ────────────────────────────────

export interface BrandContext {
  clientName: string;
  competitorNames: string[];
}

export function getVisibilityScore(
  results: EnrichedResult[],
  isSinglePlatform = false,
  weights?: PillarWeights,
  brandContext?: BrandContext,
): VisibilityScore {
  const w = (weights ?? DEFAULT_WEIGHTS).visibility;

  if (results.length === 0) {
    return {
      mentionRate: 0, shareOfVoice: 0, firstMentionRate: 0, citationRate: 0,
      platformSpread: null, platformSpreadPromptCount: 0, composite: 0,
    };
  }

  const mentioned = results.filter(r => r.client_mentioned);
  const mentionRate = mentioned.length / results.length;
  const shareOfVoice = mentionRate;

  // First Mention Rate (Four-Pillar Framework definition):
  //   of prompts where the brand was mentioned, in how many did it appear
  //   before any competitor?
  //
  // Denominator is `mentioned.length`, NOT `results.length`. The old placeholder
  // assigned firstMentionRate = mentionRate which is wrong on both axes
  // (no first-mention detection, wrong denominator).
  //
  // Requires a brandContext with clientName and competitorNames. When not
  // provided or when the competitor list is empty, returns 0 and logs a warning
  // — we explicitly avoid silent zero-data fallback.
  let firstMentionRate = 0;
  if (!brandContext || !brandContext.clientName || brandContext.competitorNames.length === 0) {
    if (mentioned.length > 0) {
      console.warn(
        '[metrics] getVisibilityScore: firstMentionRate set to 0 because brandContext is missing or has no competitors. Pass { clientName, competitorNames } to compute correctly.',
      );
    }
  } else if (mentioned.length > 0) {
    const firstMentions = mentioned.filter(r =>
      isClientFirstMention(r.response_text || '', brandContext.clientName, brandContext.competitorNames),
    );
    firstMentionRate = firstMentions.length / mentioned.length;
  }

  // Citation rate (display only, not in composite)
  const withCitations = results.filter(r => r.citations && r.citations.length > 0);
  const citationRate = withCitations.length / results.length;

  // Platform spread
  let platformSpread: number | null = null;
  let platformSpreadPromptCount = 0;

  if (!isSinglePlatform) {
    const promptAllPlatforms = new Map<string, Set<string>>();
    const promptMentionPlatforms = new Map<string, Set<string>>();
    for (const r of results) {
      if (!promptAllPlatforms.has(r.prompt_id)) promptAllPlatforms.set(r.prompt_id, new Set());
      promptAllPlatforms.get(r.prompt_id)!.add(r.platform);
      if (r.client_mentioned) {
        if (!promptMentionPlatforms.has(r.prompt_id)) promptMentionPlatforms.set(r.prompt_id, new Set());
        promptMentionPlatforms.get(r.prompt_id)!.add(r.platform);
      }
    }

    let totalSpread = 0;
    for (const [promptId, allPlatforms] of promptAllPlatforms) {
      if (allPlatforms.size < 2) continue;
      platformSpreadPromptCount++;
      const mentionedCount = promptMentionPlatforms.get(promptId)?.size ?? 0;
      totalSpread += mentionedCount / allPlatforms.size;
    }
    platformSpread = platformSpreadPromptCount > 0 ? totalSpread / platformSpreadPromptCount : 0;
  }

  const spreadValue = platformSpread ?? 0;
  const composite = isSinglePlatform
    ? Math.round(
        (w.mentionRate / (1 - w.platformSpread)) * (mentionRate * 100) +
        (w.shareOfVoice / (1 - w.platformSpread)) * (shareOfVoice * 100) +
        (w.firstMentionRate / (1 - w.platformSpread)) * (firstMentionRate * 100)
      )
    : Math.round(
        w.mentionRate * (mentionRate * 100) +
        w.shareOfVoice * (shareOfVoice * 100) +
        w.firstMentionRate * (firstMentionRate * 100) +
        w.platformSpread * (spreadValue * 100)
      );

  return { mentionRate, shareOfVoice, firstMentionRate, citationRate, platformSpread, platformSpreadPromptCount, composite };
}

export function getTrustScore(
  results: EnrichedResult[],
  weights?: PillarWeights
): TrustScore {
  const w = (weights ?? DEFAULT_WEIGHTS).trust;

  const emptySources: CitationSourceBreakdown = {
    owned: 0, earned_editorial: 0, earned_blog: 0, earned_news: 0,
    earned_review: 0, community: 0, retail: 0, competitor: 0,
    reference: 0, other: 0, totalCitations: 0,
  };

  if (results.length === 0) {
    return {
      citationRate: 0,
      sentimentBreakdown: { positive: 0, neutral: 0, hedged: 0, negative: 0, not_mentioned: 0 },
      citationSources: emptySources,
      topicDominanceScore: 0,
      composite: 0,
    };
  }

  const withCitations = results.filter(r => r.citations && r.citations.length > 0);
  const citationRate = withCitations.length / results.length;

  // Citation source breakdown from classified_citations
  const sourceCounts = { ...emptySources };
  for (const r of results) {
    const classified = r.classified_citations ?? [];
    for (const c of classified) {
      const t = c.type as keyof Omit<CitationSourceBreakdown, 'totalCitations'>;
      if (t in sourceCounts) sourceCounts[t]++;
      sourceCounts.totalCitations++;
    }
  }
  // Normalize to rates
  const citationSources: CitationSourceBreakdown = { ...sourceCounts };
  if (sourceCounts.totalCitations > 0) {
    const total = sourceCounts.totalCitations;
    citationSources.owned = sourceCounts.owned / total;
    citationSources.earned_editorial = sourceCounts.earned_editorial / total;
    citationSources.earned_blog = sourceCounts.earned_blog / total;
    citationSources.earned_news = sourceCounts.earned_news / total;
    citationSources.earned_review = sourceCounts.earned_review / total;
    citationSources.community = sourceCounts.community / total;
    citationSources.retail = sourceCounts.retail / total;
    citationSources.competitor = sourceCounts.competitor / total;
    citationSources.reference = sourceCounts.reference / total;
    citationSources.other = sourceCounts.other / total;
  }

  const sentimentCounts = { positive: 0, neutral: 0, hedged: 0, negative: 0, not_mentioned: 0 };
  for (const r of results) {
    const s = r.sentiment as keyof typeof sentimentCounts;
    if (s in sentimentCounts) sentimentCounts[s]++;
  }
  const sentimentBreakdown: SentimentBreakdown = {
    positive: sentimentCounts.positive / results.length,
    neutral: sentimentCounts.neutral / results.length,
    hedged: sentimentCounts.hedged / results.length,
    negative: sentimentCounts.negative / results.length,
    not_mentioned: sentimentCounts.not_mentioned / results.length,
  };

  const topicMentions = new Map<string, { mentioned: number; total: number }>();
  for (const r of results) {
    const topic = r.topic_name || 'unknown';
    if (!topicMentions.has(topic)) topicMentions.set(topic, { mentioned: 0, total: 0 });
    const entry = topicMentions.get(topic)!;
    entry.total++;
    if (r.client_mentioned) entry.mentioned++;
  }
  const topics = [...topicMentions.values()];
  const dominantTopics = topics.filter(t => t.total > 0 && t.mentioned / t.total > 0.5);
  const topicDominanceScore = topics.length > 0 ? dominantTopics.length / topics.length : 0;

  const composite = Math.round(
    w.citationRate * (citationRate * 100) +
    w.sentimentPositive * (sentimentBreakdown.positive * 100) +
    w.topicDominance * (topicDominanceScore * 100)
  );

  return { citationRate, sentimentBreakdown, citationSources, topicDominanceScore, composite };
}

export function getAcquisitionScore(
  results: EnrichedResult[],
  weights?: PillarWeights
): AcquisitionScore {
  const w = (weights ?? DEFAULT_WEIGHTS).acquisition;

  if (results.length === 0) {
    return { conversionQueryMentionRate: 0, ctaPresenceRate: 0, highIntentMentionRate: 0, isotopeBreakdown: [], composite: 0 };
  }

  // High-intent. Routed through getNormalizedIsotope so old-taxonomy rows
  // (isotope: 'commercial' | 'specific') and new-taxonomy rows (isotope:
  // 'constrained' | 'declarative') both qualify. But we preserve the legacy
  // low-intent distinctions — `informational` and `conversational` both
  // collapse into declarative/adversarial in the new map, and were "low"
  // in the old mapConversionIntent. Excluding them here preserves the
  // original Acquisition pillar behavior for legacy data.
  const highIntent = results.filter(r => {
    if (r.conversion_intent === 'high') return true;
    if (r.isotope === 'informational' || r.isotope === 'conversational') return false;
    const iso = getNormalizedIsotope(r);
    return iso === 'constrained' || iso === 'declarative';
  });
  const highIntentMentioned = highIntent.filter(r => r.client_mentioned);
  const highIntentMentionRate = highIntent.length > 0 ? highIntentMentioned.length / highIntent.length : 0;
  const conversionQueryMentionRate = highIntentMentionRate;

  // CTA
  const mentionedResults = results.filter(r => r.client_mentioned);
  const withCta = results.filter(r => r.cta_present && r.client_mentioned);
  const ctaPresenceRate = mentionedResults.length > 0 ? withCta.length / mentionedResults.length : 0;

  // Isotope breakdown — grouped by new 5-value taxonomy. Legacy old-taxonomy
  // rows are mapped via LEGACY_ISOTOPE_MAP inside getNormalizedIsotope. Rows
  // with an unrecognizable isotope are dropped.
  const isoMap = new Map<string, { mentioned: number; total: number }>();
  for (const r of results) {
    const iso = getNormalizedIsotope(r);
    if (iso === 'unknown') continue;
    if (!isoMap.has(iso)) isoMap.set(iso, { mentioned: 0, total: 0 });
    const entry = isoMap.get(iso)!;
    entry.total++;
    if (r.client_mentioned) entry.mentioned++;
  }
  const isotopeBreakdown: IsotopeBreakdown[] = [...isoMap.entries()]
    .map(([isotope, stats]) => ({
      isotope,
      mentionRate: stats.total > 0 ? stats.mentioned / stats.total : 0,
      total: stats.total,
      mentioned: stats.mentioned,
    }))
    .sort((a, b) => b.mentionRate - a.mentionRate);

  const composite = Math.round(
    w.highIntentMentionRate * (highIntentMentionRate * 100) +
    w.conversionQueryMentionRate * (conversionQueryMentionRate * 100) +
    w.ctaPresenceRate * (ctaPresenceRate * 100)
  );

  return { conversionQueryMentionRate, ctaPresenceRate, highIntentMentionRate, isotopeBreakdown, composite };
}

export function getRecommendationScore(
  results: EnrichedResult[],
  weights?: PillarWeights
): RecommendationScore {
  const w = (weights ?? DEFAULT_WEIGHTS).recommendation;

  if (results.length === 0) {
    return {
      recommendationRate: 0, strongRecommendationRate: 0,
      qualifiedRecommendationRate: 0, decisionCriteriaWinRate: 0, composite: 0,
    };
  }

  const mentionedResults = results.filter(r => r.client_mentioned);
  const total = mentionedResults.length || 1;

  const withRec = mentionedResults.filter(
    r => r.recommendation_strength === 'strong' || r.recommendation_strength === 'qualified'
  );
  const recommendationRate = withRec.length / total;

  const strong = mentionedResults.filter(r => r.recommendation_strength === 'strong');
  const strongRecommendationRate = strong.length / total;

  const qualified = mentionedResults.filter(r => r.recommendation_strength === 'qualified');
  const qualifiedRecommendationRate = qualified.length / total;

  // `comparative` maps to itself in LEGACY_ISOTOPE_MAP but routing through
  // getNormalizedIsotope keeps the code consistent with the other call sites
  // and correctly handles any future normalization.
  const comparative = results.filter(r => getNormalizedIsotope(r) === 'comparative');
  const comparativeWins = comparative.filter(r => r.decision_criteria_winner);
  const decisionCriteriaWinRate = comparative.length > 0 ? comparativeWins.length / comparative.length : 0;

  const composite = Math.round(
    w.recommendationRate * (recommendationRate * 100) +
    w.strongRecommendationRate * (strongRecommendationRate * 100) +
    w.decisionCriteriaWinRate * (decisionCriteriaWinRate * 100)
  );

  return { recommendationRate, strongRecommendationRate, qualifiedRecommendationRate, decisionCriteriaWinRate, composite };
}
