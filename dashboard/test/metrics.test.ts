import { describe, it, expect } from 'vitest';
import {
  classifyRecommendationStrength,
  detectCta,
  detectDecisionCriteriaWinner,
  mapConversionIntent,
  getVisibilityScore,
  getTrustScore,
  getAcquisitionScore,
  getRecommendationScore,
  getWeightsForArchetype,
  ARCHETYPE_WEIGHTS,
} from '../src/lib/metrics';
import type { EnrichedResult, PillarWeights } from '../src/lib/metrics';

// ─── Regex Classifier Tests ──────────────────────────────────

describe('classifyRecommendationStrength', () => {
  it('detects strong recommendations', () => {
    expect(classifyRecommendationStrength('I highly recommend J.Crew for business casual.')).toBe('strong');
    expect(classifyRecommendationStrength('J.Crew is the best option for workwear.')).toBe('strong');
    expect(classifyRecommendationStrength('My top pick is J.Crew.')).toBe('strong');
    expect(classifyRecommendationStrength('J.Crew is the top choice for capsule wardrobes.')).toBe('strong');
  });

  it('detects qualified recommendations', () => {
    expect(classifyRecommendationStrength('J.Crew is a good option for casual wear.')).toBe('qualified');
    expect(classifyRecommendationStrength('J.Crew is worth considering for your wardrobe.')).toBe('qualified');
    expect(classifyRecommendationStrength('J.Crew is a solid choice for basics.')).toBe('qualified');
    expect(classifyRecommendationStrength('J.Crew is ideal for smart casual.')).toBe('qualified');
  });

  it('returns absent when no recommendation language', () => {
    expect(classifyRecommendationStrength('J.Crew sells clothing online.')).toBe('absent');
    expect(classifyRecommendationStrength('The store is located in Manhattan.')).toBe('absent');
  });

  it('handles negation correctly', () => {
    expect(classifyRecommendationStrength('I would not recommend J.Crew for formal events.')).toBe('absent');
    expect(classifyRecommendationStrength("J.Crew is not the best option anymore.")).toBe('absent');
    expect(classifyRecommendationStrength("I wouldn't recommend J.Crew at full price.")).toBe('absent');
  });
});

describe('detectCta', () => {
  it('detects CTA patterns', () => {
    expect(detectCta('You can visit jcrew.com to browse their collection.')).toBe(true);
    expect(detectCta('Shop at J.Crew for the latest styles.')).toBe(true);
    expect(detectCta('Buy from J.Crew during their seasonal sale.')).toBe(true);
    expect(detectCta('Find at J.Crew stores nationwide.')).toBe(true);
    expect(detectCta('Check out jcrew.com/mens for options.')).toBe(true);
  });

  it('returns false when no CTA', () => {
    expect(detectCta('J.Crew is a popular clothing brand.')).toBe(false);
    expect(detectCta('Many people like their casual wear.')).toBe(false);
  });
});

describe('detectDecisionCriteriaWinner', () => {
  it('detects brand in last 2 sentences of comparative prompts', () => {
    const text = 'Both brands offer quality basics. However, for overall value, J.Crew edges out the competition.';
    expect(detectDecisionCriteriaWinner(text, 'comparative', 'J.Crew')).toBe(true);
  });

  it('returns false for non-comparative isotopes', () => {
    const text = 'J.Crew is the clear winner here.';
    expect(detectDecisionCriteriaWinner(text, 'informational', 'J.Crew')).toBe(false);
    expect(detectDecisionCriteriaWinner(text, 'commercial', 'J.Crew')).toBe(false);
  });

  it('returns false when brand not in last 2 sentences', () => {
    const text = 'J.Crew offers some good basics. But Everlane has better sustainability practices. Overall, Everlane is the better choice.';
    expect(detectDecisionCriteriaWinner(text, 'comparative', 'J.Crew')).toBe(false);
  });

  it('handles empty text', () => {
    expect(detectDecisionCriteriaWinner('', 'comparative', 'J.Crew')).toBe(false);
  });
});

describe('mapConversionIntent', () => {
  it('maps legacy 6-isotope values to intent levels', () => {
    // Legacy fallback path — these values are still in the Supabase
    // `results.isotope` column for runs made before the 5×5 refactor.
    expect(mapConversionIntent('commercial')).toBe('high');
    expect(mapConversionIntent('specific')).toBe('high');
    expect(mapConversionIntent('comparative')).toBe('medium');
    expect(mapConversionIntent('persona')).toBe('medium');
    expect(mapConversionIntent('informational')).toBe('low');
    expect(mapConversionIntent('conversational')).toBe('low');
  });

  it('maps new 5-isotope values to intent levels', () => {
    expect(mapConversionIntent('declarative')).toBe('high');
    expect(mapConversionIntent('constrained')).toBe('high');
    expect(mapConversionIntent('comparative')).toBe('medium');
    expect(mapConversionIntent('situated')).toBe('medium');
    expect(mapConversionIntent('adversarial')).toBe('low');
  });

  it('returns low for unknown isotope strings', () => {
    expect(mapConversionIntent('nonsense')).toBe('low');
    expect(mapConversionIntent('')).toBe('low');
  });
});

// ─── Pillar Score Tests ──────────────────────────────────────

function makeResult(overrides: Partial<EnrichedResult> = {}): EnrichedResult {
  return {
    id: 'test-id',
    run_id: 'test-run',
    prompt_id: 'test-prompt',
    platform: 'perplexity',
    response_text: 'Test response about J.Crew.',
    client_mentioned: true,
    isotope: 'informational',
    topic_name: 'test-topic',
    sentiment: 'neutral',
    recommendation_strength: 'absent',
    cta_present: false,
    decision_criteria_winner: false,
    conversion_intent: 'low',
    citations: [],
    created_at: '2026-03-27T00:00:00Z',
    ...overrides,
  };
}

describe('getVisibilityScore', () => {
  it('returns zeros for empty results', () => {
    const score = getVisibilityScore([]);
    expect(score.composite).toBe(0);
    expect(score.mentionRate).toBe(0);
  });

  it('computes mention rate correctly', () => {
    const results = [
      makeResult({ client_mentioned: true }),
      makeResult({ client_mentioned: false }),
      makeResult({ client_mentioned: true }),
    ];
    const score = getVisibilityScore(results);
    expect(score.mentionRate).toBeCloseTo(2 / 3, 2);
  });

  it('computes platform spread across prompts', () => {
    const results = [
      makeResult({ prompt_id: 'p1', platform: 'perplexity', client_mentioned: true }),
      makeResult({ prompt_id: 'p1', platform: 'claude', client_mentioned: true }),
      makeResult({ prompt_id: 'p1', platform: 'gemini', client_mentioned: false }),
    ];
    const score = getVisibilityScore(results);
    // prompt p1: mentioned on 2 of 3 platforms = 0.667
    expect(score.platformSpread).toBeCloseTo(2 / 3, 2);
  });
});

describe('getVisibilityScore firstMentionRate (Four-Pillar Framework)', () => {
  const brandContext = {
    clientName: 'J.Crew',
    competitorNames: ['Banana Republic', 'Everlane', 'Madewell'],
  };

  it('returns 0 when brandContext is missing (no silent data)', () => {
    const results = [
      makeResult({ client_mentioned: true, response_text: 'J.Crew is great' }),
      makeResult({ client_mentioned: true, response_text: 'J.Crew and more' }),
    ];
    const score = getVisibilityScore(results);
    expect(score.firstMentionRate).toBe(0);
  });

  it('returns 0 when brandContext has empty competitorNames', () => {
    const results = [
      makeResult({ client_mentioned: true, response_text: 'J.Crew is great' }),
    ];
    const score = getVisibilityScore(results, false, undefined, {
      clientName: 'J.Crew',
      competitorNames: [],
    });
    expect(score.firstMentionRate).toBe(0);
  });

  it('returns 1.0 when client appears before every competitor in every mention', () => {
    const results = [
      makeResult({
        client_mentioned: true,
        response_text: 'J.Crew is the top choice over Banana Republic and Everlane.',
      }),
      makeResult({
        client_mentioned: true,
        response_text: 'J.Crew leads the pack, followed by Madewell.',
      }),
    ];
    const score = getVisibilityScore(results, false, undefined, brandContext);
    expect(score.firstMentionRate).toBe(1);
  });

  it('returns 0 when client appears after a competitor in every mention', () => {
    const results = [
      makeResult({
        client_mentioned: true,
        response_text: 'Banana Republic beats J.Crew.',
      }),
      makeResult({
        client_mentioned: true,
        response_text: 'Everlane is better than J.Crew.',
      }),
    ];
    const score = getVisibilityScore(results, false, undefined, brandContext);
    expect(score.firstMentionRate).toBe(0);
  });

  it('computes partial firstMentionRate with mixed ordering', () => {
    const results = [
      // first mention ✓
      makeResult({
        client_mentioned: true,
        response_text: 'J.Crew is the leader, then Banana Republic.',
      }),
      // not first mention ✗
      makeResult({
        client_mentioned: true,
        response_text: 'Banana Republic beats J.Crew.',
      }),
    ];
    const score = getVisibilityScore(results, false, undefined, brandContext);
    // 1 first mention out of 2 mentioned = 0.5
    expect(score.firstMentionRate).toBeCloseTo(0.5, 2);
  });

  it('denominator is mentioned.length, NOT results.length', () => {
    // 2 mentions out of 4 results, both first → firstMentionRate should be 1.0,
    // NOT 0.5 (2/4). The Four-Pillar Framework denominator is mentions, not prompts.
    const results = [
      makeResult({
        client_mentioned: true,
        response_text: 'J.Crew vs Banana Republic — J.Crew wins.',
      }),
      makeResult({
        client_mentioned: true,
        response_text: 'J.Crew is the best, Everlane is second.',
      }),
      makeResult({ client_mentioned: false, response_text: 'Banana Republic only.' }),
      makeResult({ client_mentioned: false, response_text: 'No brand match here.' }),
    ];
    const score = getVisibilityScore(results, false, undefined, brandContext);
    expect(score.firstMentionRate).toBe(1);
    expect(score.mentionRate).toBeCloseTo(0.5, 2);
  });

  it('returns 0 firstMentionRate when no prompts mention the client (avoids NaN)', () => {
    const results = [
      makeResult({ client_mentioned: false, response_text: 'Competitors only.' }),
      makeResult({ client_mentioned: false, response_text: 'Nothing here either.' }),
    ];
    const score = getVisibilityScore(results, false, undefined, brandContext);
    expect(score.firstMentionRate).toBe(0);
    expect(score.mentionRate).toBe(0);
  });
});

describe('getTrustScore', () => {
  it('returns zeros for empty results', () => {
    const score = getTrustScore([]);
    expect(score.composite).toBe(0);
  });

  it('computes sentiment breakdown', () => {
    const results = [
      makeResult({ sentiment: 'positive' }),
      makeResult({ sentiment: 'positive' }),
      makeResult({ sentiment: 'hedged' }),
      makeResult({ sentiment: 'neutral' }),
    ];
    const score = getTrustScore(results);
    expect(score.sentimentBreakdown.positive).toBeCloseTo(0.5, 2);
    expect(score.sentimentBreakdown.hedged).toBeCloseTo(0.25, 2);
    expect(score.sentimentBreakdown.neutral).toBeCloseTo(0.25, 2);
  });
});

describe('getAcquisitionScore', () => {
  it('returns zeros for empty results', () => {
    const score = getAcquisitionScore([]);
    expect(score.composite).toBe(0);
  });

  it('computes high-intent mention rate from commercial/specific isotopes', () => {
    const results = [
      makeResult({ isotope: 'commercial', conversion_intent: 'high', client_mentioned: true }),
      makeResult({ isotope: 'specific', conversion_intent: 'high', client_mentioned: false }),
      makeResult({ isotope: 'informational', conversion_intent: 'low', client_mentioned: true }),
    ];
    const score = getAcquisitionScore(results);
    // 1 of 2 high-intent results mentioned = 50%
    expect(score.highIntentMentionRate).toBeCloseTo(0.5, 2);
  });

  it('computes CTA presence rate among mentioned results', () => {
    const results = [
      makeResult({ client_mentioned: true, cta_present: true }),
      makeResult({ client_mentioned: true, cta_present: false }),
      makeResult({ client_mentioned: false, cta_present: false }),
    ];
    const score = getAcquisitionScore(results);
    // 1 of 2 mentioned results have CTA = 50%
    expect(score.ctaPresenceRate).toBeCloseTo(0.5, 2);
  });
});

describe('getRecommendationScore', () => {
  it('returns zeros for empty results', () => {
    const score = getRecommendationScore([]);
    expect(score.composite).toBe(0);
  });

  it('computes recommendation rates from mentioned results', () => {
    const results = [
      makeResult({ client_mentioned: true, recommendation_strength: 'strong' }),
      makeResult({ client_mentioned: true, recommendation_strength: 'qualified' }),
      makeResult({ client_mentioned: true, recommendation_strength: 'absent' }),
      makeResult({ client_mentioned: false, recommendation_strength: 'absent' }),
    ];
    const score = getRecommendationScore(results);
    // 3 mentioned: 2 have recs = 66.7%
    expect(score.recommendationRate).toBeCloseTo(2 / 3, 2);
    expect(score.strongRecommendationRate).toBeCloseTo(1 / 3, 2);
    expect(score.qualifiedRecommendationRate).toBeCloseTo(1 / 3, 2);
  });

  it('handles zero comparative prompts without division by zero', () => {
    const results = [
      makeResult({ isotope: 'informational', client_mentioned: true }),
    ];
    const score = getRecommendationScore(results);
    expect(score.decisionCriteriaWinRate).toBe(0);
    expect(Number.isFinite(score.composite)).toBe(true);
  });

  it('computes decision criteria win rate on comparative prompts', () => {
    const results = [
      makeResult({ isotope: 'comparative', decision_criteria_winner: true, client_mentioned: true }),
      makeResult({ isotope: 'comparative', decision_criteria_winner: false, client_mentioned: true }),
    ];
    const score = getRecommendationScore(results);
    expect(score.decisionCriteriaWinRate).toBeCloseTo(0.5, 2);
  });
});

// ─── Archetype Weights Tests ─────────────────────────────────

describe('getWeightsForArchetype', () => {
  it('returns default weights for unknown archetype', () => {
    const weights = getWeightsForArchetype('nonexistent');
    expect(weights.visibility.mentionRate).toBe(0.35);
  });

  it('returns default weights when archetype is undefined', () => {
    const weights = getWeightsForArchetype(undefined);
    expect(weights.visibility.mentionRate).toBe(0.35);
  });

  it('returns transactional-commerce weights', () => {
    const weights = getWeightsForArchetype('transactional-commerce');
    expect(weights.visibility.mentionRate).toBe(0.40);
    expect(weights.visibility.shareOfVoice).toBe(0.25);
  });

  it('returns trust-based-advisory weights', () => {
    const weights = getWeightsForArchetype('trust-based-advisory');
    expect(weights.trust.sentimentPositive).toBe(0.35);
    expect(weights.recommendation.decisionCriteriaWinRate).toBe(0.40);
  });

  it('all archetype weights sum to 1.0 per pillar', () => {
    for (const [name, weights] of Object.entries(ARCHETYPE_WEIGHTS)) {
      for (const [pillar, w] of Object.entries(weights)) {
        const sum = Object.values(w).reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 2);
      }
    }
  });
});

describe('archetype weights affect composite scores', () => {
  it('different archetype weights change trust composite', () => {
    // Make sub-metrics very different so weight changes matter after rounding
    // High citation (100%), low sentiment+ (0%), medium dominance (50%)
    const results = [
      makeResult({ sentiment: 'neutral', citations: ['http://a.com'], topic_name: 'topic-a', client_mentioned: true }),
      makeResult({ sentiment: 'neutral', citations: ['http://b.com'], topic_name: 'topic-a', client_mentioned: true }),
      makeResult({ sentiment: 'neutral', citations: ['http://c.com'], topic_name: 'topic-b', client_mentioned: false }),
    ];
    const defaultScore = getTrustScore(results, getWeightsForArchetype(undefined));
    const mediaScore = getTrustScore(results, getWeightsForArchetype('digital-media'));

    // citationRate=100%, sentimentPositive=0%, topicDominance=50%
    // default: 0.30*100 + 0.45*0 + 0.25*50 = 30+0+12.5 = 43
    // media:   0.40*100 + 0.30*0 + 0.30*50 = 40+0+15   = 55
    expect(mediaScore.composite).toBeGreaterThan(defaultScore.composite);
  });

  it('trust-based-advisory weights sentiment higher in trust pillar', () => {
    const results = [
      makeResult({ sentiment: 'positive', citations: ['http://example.com'] }),
      makeResult({ sentiment: 'positive', citations: [] }),
      makeResult({ sentiment: 'neutral', citations: [] }),
    ];
    const defaultScore = getTrustScore(results, getWeightsForArchetype(undefined));
    const advisoryScore = getTrustScore(results, getWeightsForArchetype('trust-based-advisory'));

    // advisory sentimentPositive weight is 0.35 vs default 0.45
    // advisory citationRate weight is 0.30 vs default 0.30 (same)
    // advisory topicDominance weight is 0.35 vs default 0.25
    // scores differ
    expect(advisoryScore.composite).not.toBe(defaultScore.composite);
  });
});

// ─── Isotope Breakdown Tests ─────────────────────────────────

describe('getAcquisitionScore isotope breakdown', () => {
  it('returns empty breakdown for empty results', () => {
    const score = getAcquisitionScore([]);
    expect(score.isotopeBreakdown).toEqual([]);
  });

  it('computes mention rate per isotope (new taxonomy values)', () => {
    const results = [
      makeResult({ isotope: 'constrained', client_mentioned: true, conversion_intent: 'high' }),
      makeResult({ isotope: 'constrained', client_mentioned: false, conversion_intent: 'high' }),
      makeResult({ isotope: 'situated', client_mentioned: true, conversion_intent: 'medium' }),
      makeResult({ isotope: 'situated', client_mentioned: true, conversion_intent: 'medium' }),
      makeResult({ isotope: 'situated', client_mentioned: false, conversion_intent: 'medium' }),
    ];
    const score = getAcquisitionScore(results);

    const constrained = score.isotopeBreakdown.find(i => i.isotope === 'constrained');
    const situated = score.isotopeBreakdown.find(i => i.isotope === 'situated');

    expect(constrained).toBeDefined();
    expect(constrained!.mentionRate).toBeCloseTo(0.5, 2);
    expect(constrained!.total).toBe(2);
    expect(constrained!.mentioned).toBe(1);

    expect(situated).toBeDefined();
    expect(situated!.mentionRate).toBeCloseTo(2 / 3, 2);
    expect(situated!.total).toBe(3);
    expect(situated!.mentioned).toBe(2);
  });

  it('collapses legacy old-taxonomy isotopes through the fallback map', () => {
    // Legacy rows: `commercial` and `informational` both normalize to
    // `declarative`. All 5 rows should end up in a single declarative bucket.
    const results = [
      makeResult({ isotope: 'commercial', client_mentioned: true, conversion_intent: 'high' }),
      makeResult({ isotope: 'commercial', client_mentioned: false, conversion_intent: 'high' }),
      makeResult({ isotope: 'informational', client_mentioned: true, conversion_intent: 'low' }),
      makeResult({ isotope: 'informational', client_mentioned: true, conversion_intent: 'low' }),
      makeResult({ isotope: 'informational', client_mentioned: false, conversion_intent: 'low' }),
    ];
    const score = getAcquisitionScore(results);

    // Commercial and informational both collapse to declarative
    const declarative = score.isotopeBreakdown.find(i => i.isotope === 'declarative');
    expect(declarative).toBeDefined();
    expect(declarative!.total).toBe(5);
    expect(declarative!.mentioned).toBe(3);
    expect(declarative!.mentionRate).toBeCloseTo(0.6, 2);

    // No bucket uses the old isotope labels
    expect(score.isotopeBreakdown.find(i => i.isotope === 'commercial')).toBeUndefined();
    expect(score.isotopeBreakdown.find(i => i.isotope === 'informational')).toBeUndefined();
  });

  it('sorts isotope breakdown by mention rate descending', () => {
    // `commercial` → declarative (0 mentioned), `specific` → constrained (1 mentioned).
    // Constrained should sort first (higher mention rate).
    const results = [
      makeResult({ isotope: 'commercial', client_mentioned: false }),
      makeResult({ isotope: 'specific', client_mentioned: true }),
    ];
    const score = getAcquisitionScore(results);
    expect(score.isotopeBreakdown[0].isotope).toBe('constrained');
    expect(score.isotopeBreakdown[1].isotope).toBe('declarative');
  });
});

// ─── Citation Rate in Visibility Tests ───────────────────────

describe('getVisibilityScore citation rate', () => {
  it('computes citation rate as display metric', () => {
    const results = [
      makeResult({ citations: ['http://example.com'] }),
      makeResult({ citations: [] }),
      makeResult({ citations: ['http://a.com', 'http://b.com'] }),
    ];
    const score = getVisibilityScore(results, true);
    expect(score.citationRate).toBeCloseTo(2 / 3, 2);
  });

  it('returns 0 citation rate for empty results', () => {
    const score = getVisibilityScore([], true);
    expect(score.citationRate).toBe(0);
  });
});
