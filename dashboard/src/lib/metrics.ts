import type { EnrichedResult } from './supabase';

// ─── Types ───────────────────────────────────────────────────
export interface VisibilityScore {
  mentionRate: number;
  shareOfVoice: number;
  firstMentionRate: number;
  platformSpread: number;
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
  Data flow:
  Supabase results (enriched) → getXxxScore(results) → { sub-metrics, composite }

  Composite formulas (all sub-metrics normalized 0-100 before weighting):
    Visibility  = 0.35*mentionRate + 0.30*shareOfVoice + 0.20*firstMentionRate + 0.15*platformSpread
    Trust       = 0.30*citationRate + 0.45*sentimentPositiveRate + 0.25*topicDominanceScore
    Acquisition = 0.40*highIntentMentionRate + 0.35*conversionQueryMentionRate + 0.25*ctaPresenceRate
    Recommendation = 0.35*recommendationRate + 0.30*strongRecommendationRate + 0.35*decisionCriteriaWinRate
*/

export function getVisibilityScore(results: EnrichedResult[]): VisibilityScore {
  if (results.length === 0) {
    return { mentionRate: 0, shareOfVoice: 0, firstMentionRate: 0, platformSpread: 0, composite: 0 };
  }

  const mentioned = results.filter(r => r.client_mentioned);
  const mentionRate = mentioned.length / results.length;

  // Share of voice: client mentions / all brand mentions (approximate from client_mentioned)
  const shareOfVoice = mentionRate; // Simplified: will be refined when competitor data is available

  // First mention rate: approximate as mention rate (no position data in enriched results)
  const firstMentionRate = mentionRate;

  // Platform spread: for each unique prompt_id, count how many platforms mention the brand
  const promptPlatforms = new Map<string, Set<string>>();
  const promptAllPlatforms = new Map<string, Set<string>>();
  for (const r of results) {
    if (!promptAllPlatforms.has(r.prompt_id)) {
      promptAllPlatforms.set(r.prompt_id, new Set());
    }
    promptAllPlatforms.get(r.prompt_id)!.add(r.platform);

    if (r.client_mentioned) {
      if (!promptPlatforms.has(r.prompt_id)) {
        promptPlatforms.set(r.prompt_id, new Set());
      }
      promptPlatforms.get(r.prompt_id)!.add(r.platform);
    }
  }

  let totalSpread = 0;
  let promptCount = 0;
  for (const [promptId, allPlatforms] of promptAllPlatforms) {
    const mentionedPlatforms = promptPlatforms.get(promptId);
    const count = mentionedPlatforms ? mentionedPlatforms.size : 0;
    totalSpread += count / allPlatforms.size;
    promptCount++;
  }
  const platformSpread = promptCount > 0 ? totalSpread / promptCount : 0;

  const composite = Math.round(
    0.35 * (mentionRate * 100) +
    0.30 * (shareOfVoice * 100) +
    0.20 * (firstMentionRate * 100) +
    0.15 * (platformSpread * 100)
  );

  return { mentionRate, shareOfVoice, firstMentionRate, platformSpread, composite };
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

  // Citation rate: % of results that have domain citations
  const withCitations = results.filter(r => r.citations && r.citations.length > 0);
  const citationRate = withCitations.length / results.length;

  // Sentiment breakdown
  const sentimentCounts = { positive: 0, neutral: 0, hedged: 0, negative: 0, not_mentioned: 0 };
  for (const r of results) {
    const s = r.sentiment as keyof typeof sentimentCounts;
    if (s in sentimentCounts) {
      sentimentCounts[s]++;
    }
  }
  const sentimentBreakdown: SentimentBreakdown = {
    positive: sentimentCounts.positive / results.length,
    neutral: sentimentCounts.neutral / results.length,
    hedged: sentimentCounts.hedged / results.length,
    negative: sentimentCounts.negative / results.length,
    not_mentioned: sentimentCounts.not_mentioned / results.length,
  };

  // Topic dominance: % of topics where client is mentioned in majority of results
  const topicMentions = new Map<string, { mentioned: number; total: number }>();
  for (const r of results) {
    const topic = r.topic_name || 'unknown';
    if (!topicMentions.has(topic)) {
      topicMentions.set(topic, { mentioned: 0, total: 0 });
    }
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

  // High-intent results: commercial + specific isotopes
  const highIntent = results.filter(
    r => r.conversion_intent === 'high' || r.isotope === 'commercial' || r.isotope === 'specific'
  );
  const highIntentMentioned = highIntent.filter(r => r.client_mentioned);
  const highIntentMentionRate = highIntent.length > 0
    ? highIntentMentioned.length / highIntent.length
    : 0;

  // Conversion query mention rate (same as high intent for now)
  const conversionQueryMentionRate = highIntentMentionRate;

  // CTA presence rate
  const withCta = results.filter(r => r.cta_present && r.client_mentioned);
  const mentionedResults = results.filter(r => r.client_mentioned);
  const ctaPresenceRate = mentionedResults.length > 0
    ? withCta.length / mentionedResults.length
    : 0;

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
      recommendationRate: 0,
      strongRecommendationRate: 0,
      qualifiedRecommendationRate: 0,
      decisionCriteriaWinRate: 0,
      composite: 0,
    };
  }

  const mentionedResults = results.filter(r => r.client_mentioned);
  const total = mentionedResults.length || 1; // guard division by zero

  const withRec = mentionedResults.filter(
    r => r.recommendation_strength === 'strong' || r.recommendation_strength === 'qualified'
  );
  const recommendationRate = withRec.length / total;

  const strong = mentionedResults.filter(r => r.recommendation_strength === 'strong');
  const strongRecommendationRate = strong.length / total;

  const qualified = mentionedResults.filter(r => r.recommendation_strength === 'qualified');
  const qualifiedRecommendationRate = qualified.length / total;

  // Decision criteria winner: only on comparative prompts
  const comparative = results.filter(r => r.isotope === 'comparative');
  const comparativeWins = comparative.filter(r => r.decision_criteria_winner);
  const decisionCriteriaWinRate = comparative.length > 0
    ? comparativeWins.length / comparative.length
    : 0;

  const composite = Math.round(
    0.35 * (recommendationRate * 100) +
    0.30 * (strongRecommendationRate * 100) +
    0.35 * (decisionCriteriaWinRate * 100)
  );

  return {
    recommendationRate,
    strongRecommendationRate,
    qualifiedRecommendationRate,
    decisionCriteriaWinRate,
    composite,
  };
}
