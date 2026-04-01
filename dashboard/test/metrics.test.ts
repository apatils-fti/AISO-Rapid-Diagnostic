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
} from '../src/lib/metrics';
import type { EnrichedResult } from '../src/lib/metrics';

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
  it('maps isotopes to intent levels', () => {
    expect(mapConversionIntent('commercial')).toBe('high');
    expect(mapConversionIntent('specific')).toBe('high');
    expect(mapConversionIntent('comparative')).toBe('medium');
    expect(mapConversionIntent('persona')).toBe('medium');
    expect(mapConversionIntent('informational')).toBe('low');
    expect(mapConversionIntent('conversational')).toBe('low');
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
