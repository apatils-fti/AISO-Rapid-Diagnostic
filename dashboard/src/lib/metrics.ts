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

export interface TrustScore {
  citationRate: number;
  sentimentBreakdown: SentimentBreakdown;
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

export function mapConversionIntent(isotope: string): 'high' | 'medium' | 'low' {
  if (isotope === 'commercial' || isotope === 'specific') return 'high';
  if (isotope === 'comparative' || isotope === 'persona') return 'medium';
  return 'low';
}

// ─── Pillar Score Computation ────────────────────────────────

export function getVisibilityScore(
  results: EnrichedResult[],
  isSinglePlatform = false,
  weights?: PillarWeights
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
  const firstMentionRate = mentionRate;

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

  if (results.length === 0) {
    return {
      citationRate: 0,
      sentimentBreakdown: { positive: 0, neutral: 0, hedged: 0, negative: 0, not_mentioned: 0 },
      topicDominanceScore: 0,
      composite: 0,
    };
  }

  const withCitations = results.filter(r => r.citations && r.citations.length > 0);
  const citationRate = withCitations.length / results.length;

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

  return { citationRate, sentimentBreakdown, topicDominanceScore, composite };
}

export function getAcquisitionScore(
  results: EnrichedResult[],
  weights?: PillarWeights
): AcquisitionScore {
  const w = (weights ?? DEFAULT_WEIGHTS).acquisition;

  if (results.length === 0) {
    return { conversionQueryMentionRate: 0, ctaPresenceRate: 0, highIntentMentionRate: 0, isotopeBreakdown: [], composite: 0 };
  }

  // High-intent
  const highIntent = results.filter(
    r => r.conversion_intent === 'high' || r.isotope === 'commercial' || r.isotope === 'specific'
  );
  const highIntentMentioned = highIntent.filter(r => r.client_mentioned);
  const highIntentMentionRate = highIntent.length > 0 ? highIntentMentioned.length / highIntent.length : 0;
  const conversionQueryMentionRate = highIntentMentionRate;

  // CTA
  const mentionedResults = results.filter(r => r.client_mentioned);
  const withCta = results.filter(r => r.cta_present && r.client_mentioned);
  const ctaPresenceRate = mentionedResults.length > 0 ? withCta.length / mentionedResults.length : 0;

  // Isotope breakdown
  const isoMap = new Map<string, { mentioned: number; total: number }>();
  for (const r of results) {
    const iso = r.isotope || 'unknown';
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

  const comparative = results.filter(r => r.isotope === 'comparative');
  const comparativeWins = comparative.filter(r => r.decision_criteria_winner);
  const decisionCriteriaWinRate = comparative.length > 0 ? comparativeWins.length / comparative.length : 0;

  const composite = Math.round(
    w.recommendationRate * (recommendationRate * 100) +
    w.strongRecommendationRate * (strongRecommendationRate * 100) +
    w.decisionCriteriaWinRate * (decisionCriteriaWinRate * 100)
  );

  return { recommendationRate, strongRecommendationRate, qualifiedRecommendationRate, decisionCriteriaWinRate, composite };
}
