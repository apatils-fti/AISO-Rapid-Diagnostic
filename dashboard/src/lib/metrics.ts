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
  platformSpread: number | null; // null when single platform selected
  platformSpreadPromptCount: number; // prompts with 2+ platforms used for spread calc
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

export interface AcquisitionScore {
  conversionQueryMentionRate: number;
  ctaPresenceRate: number;
  highIntentMentionRate: number;
  composite: number;
}

export interface RecommendationScore {
  recommendationRate: number;
  strongRecommendationRate: number;
  qualifiedRecommendationRate: number;
  decisionCriteriaWinRate: number;
  composite: number;
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
/*
  Composite formulas (all sub-metrics normalized 0-100 before weighting):
    Visibility      = 0.35*mentionRate + 0.30*shareOfVoice + 0.20*firstMentionRate + 0.15*platformSpread
    Trust           = 0.30*citationRate + 0.45*sentimentPositiveRate + 0.25*topicDominanceScore
    Acquisition     = 0.40*highIntentMentionRate + 0.35*conversionQueryMentionRate + 0.25*ctaPresenceRate
    Recommendation  = 0.35*recommendationRate + 0.30*strongRecommendationRate + 0.35*decisionCriteriaWinRate
*/

export function getVisibilityScore(
  results: EnrichedResult[],
  isSinglePlatform = false
): VisibilityScore {
  if (results.length === 0) {
    return {
      mentionRate: 0, shareOfVoice: 0, firstMentionRate: 0,
      platformSpread: null, platformSpreadPromptCount: 0, composite: 0,
    };
  }

  const mentioned = results.filter(r => r.client_mentioned);
  const mentionRate = mentioned.length / results.length;
  const shareOfVoice = mentionRate;
  const firstMentionRate = mentionRate;

  // Platform spread: only meaningful when viewing all platforms
  let platformSpread: number | null = null;
  let platformSpreadPromptCount = 0;

  if (!isSinglePlatform) {
    // Group by prompt_id: count total platforms and mentioning platforms
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

    // Only include prompts with results from 2+ platforms
    let totalSpread = 0;
    for (const [promptId, allPlatforms] of promptAllPlatforms) {
      if (allPlatforms.size < 2) continue;
      platformSpreadPromptCount++;
      const mentionedCount = promptMentionPlatforms.get(promptId)?.size ?? 0;
      totalSpread += mentionedCount / allPlatforms.size;
    }
    platformSpread = platformSpreadPromptCount > 0 ? totalSpread / platformSpreadPromptCount : 0;
  }

  // Composite: use platformSpread if available, otherwise redistribute weight
  const spreadValue = platformSpread ?? 0;
  const composite = isSinglePlatform
    ? Math.round(
        // Without spread: redistribute 0.15 weight across other 3 metrics
        0.41 * (mentionRate * 100) +
        0.35 * (shareOfVoice * 100) +
        0.24 * (firstMentionRate * 100)
      )
    : Math.round(
        0.35 * (mentionRate * 100) +
        0.30 * (shareOfVoice * 100) +
        0.20 * (firstMentionRate * 100) +
        0.15 * (spreadValue * 100)
      );

  return { mentionRate, shareOfVoice, firstMentionRate, platformSpread, platformSpreadPromptCount, composite };
}

export function getTrustScore(results: EnrichedResult[]): TrustScore {
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
    0.30 * (citationRate * 100) +
    0.45 * (sentimentBreakdown.positive * 100) +
    0.25 * (topicDominanceScore * 100)
  );

  return { citationRate, sentimentBreakdown, topicDominanceScore, composite };
}

export function getAcquisitionScore(results: EnrichedResult[]): AcquisitionScore {
  if (results.length === 0) {
    return { conversionQueryMentionRate: 0, ctaPresenceRate: 0, highIntentMentionRate: 0, composite: 0 };
  }

  const highIntent = results.filter(
    r => r.conversion_intent === 'high' || r.isotope === 'commercial' || r.isotope === 'specific'
  );
  const highIntentMentioned = highIntent.filter(r => r.client_mentioned);
  const highIntentMentionRate = highIntent.length > 0 ? highIntentMentioned.length / highIntent.length : 0;
  const conversionQueryMentionRate = highIntentMentionRate;

  const mentionedResults = results.filter(r => r.client_mentioned);
  const withCta = results.filter(r => r.cta_present && r.client_mentioned);
  const ctaPresenceRate = mentionedResults.length > 0 ? withCta.length / mentionedResults.length : 0;

  const composite = Math.round(
    0.40 * (highIntentMentionRate * 100) +
    0.35 * (conversionQueryMentionRate * 100) +
    0.25 * (ctaPresenceRate * 100)
  );

  return { conversionQueryMentionRate, ctaPresenceRate, highIntentMentionRate, composite };
}

export function getRecommendationScore(results: EnrichedResult[]): RecommendationScore {
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
    0.35 * (recommendationRate * 100) +
    0.30 * (strongRecommendationRate * 100) +
    0.35 * (decisionCriteriaWinRate * 100)
  );

  return { recommendationRate, strongRecommendationRate, qualifiedRecommendationRate, decisionCriteriaWinRate, composite };
}
