/**
 * Text Analysis Utilities
 *
 * Functions for analyzing brand mentions in AI response text.
 * Used to compute share of voice, mention position, and brand visibility
 * beyond just domain citations.
 */

export interface BrandMentionResult {
  /** Brand name */
  brand: string;
  /** Whether the brand was mentioned at all */
  mentioned: boolean;
  /** Number of times the brand was mentioned */
  mentionCount: number;
  /** Position of first mention (0-indexed character position, null if not mentioned) */
  firstMentionPosition: number | null;
  /** Rank among all brands (1 = first mentioned, null if not mentioned) */
  mentionRank: number | null;
}

export interface TextAnalysisResult {
  /** Analysis results for each brand */
  brands: Record<string, BrandMentionResult>;
  /** Total number of brand mentions across all brands */
  totalMentions: number;
  /** Brand that was mentioned first (or null if none) */
  firstMentionedBrand: string | null;
  /** Client's share of voice (client mentions / total mentions) */
  clientShareOfVoice: number;
  /** Whether the client was mentioned */
  clientMentioned: boolean;
  /** Client's mention rank (1 = first, null if not mentioned) */
  clientMentionRank: number | null;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Count the number of times a brand is mentioned in text.
 * Case-insensitive matching with word boundary awareness.
 */
export function countBrandMentions(text: string, brandName: string): number {
  if (!text || !brandName) return 0;

  // Create a regex that matches the brand name with word boundaries
  // Handle brands with special characters (e.g., "Monday.com", "J.Crew")
  const escapedBrand = escapeRegex(brandName);
  const regex = new RegExp(`\\b${escapedBrand}\\b`, 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Find the character position of the first mention of a brand in text.
 * Returns -1 if not found.
 */
export function findFirstMentionPosition(text: string, brandName: string): number {
  if (!text || !brandName) return -1;

  const lowerText = text.toLowerCase();
  const lowerBrand = brandName.toLowerCase();
  return lowerText.indexOf(lowerBrand);
}

/**
 * Analyze brand mentions for a single brand.
 */
export function analyzeBrandMention(
  text: string,
  brandName: string,
): Omit<BrandMentionResult, 'mentionRank'> {
  const mentionCount = countBrandMentions(text, brandName);
  const firstMentionPosition = findFirstMentionPosition(text, brandName);

  return {
    brand: brandName,
    mentioned: mentionCount > 0,
    mentionCount,
    firstMentionPosition: mentionCount > 0 ? firstMentionPosition : null,
  };
}

/**
 * Analyze brand mentions across all brands in a response.
 *
 * @param text - The AI response text to analyze
 * @param clientName - The client brand name
 * @param competitorNames - Array of competitor brand names
 * @returns Comprehensive text analysis results
 */
export function analyzeTextMentions(
  text: string,
  clientName: string,
  competitorNames: string[],
): TextAnalysisResult {
  const allBrands = [clientName, ...competitorNames];
  const brandResults: Record<string, BrandMentionResult> = {};

  // First pass: analyze each brand
  const analyses: Array<Omit<BrandMentionResult, 'mentionRank'>> = [];
  for (const brand of allBrands) {
    analyses.push(analyzeBrandMention(text, brand));
  }

  // Sort by first mention position to determine ranks
  const mentionedBrands = analyses
    .filter(a => a.mentioned)
    .sort((a, b) => (a.firstMentionPosition ?? Infinity) - (b.firstMentionPosition ?? Infinity));

  // Assign ranks and build results
  let totalMentions = 0;
  let clientMentions = 0;

  for (const analysis of analyses) {
    const rank = mentionedBrands.findIndex(m => m.brand === analysis.brand);
    brandResults[analysis.brand] = {
      ...analysis,
      mentionRank: rank >= 0 ? rank + 1 : null,
    };
    totalMentions += analysis.mentionCount;
    if (analysis.brand === clientName) {
      clientMentions = analysis.mentionCount;
    }
  }

  const clientResult = brandResults[clientName];

  return {
    brands: brandResults,
    totalMentions,
    firstMentionedBrand: mentionedBrands.length > 0 ? mentionedBrands[0].brand : null,
    clientShareOfVoice: totalMentions > 0 ? clientMentions / totalMentions : 0,
    clientMentioned: clientResult?.mentioned ?? false,
    clientMentionRank: clientResult?.mentionRank ?? null,
  };
}

/**
 * Aggregate text analysis across multiple responses.
 */
export interface AggregatedTextMetrics {
  /** % of responses where client brand was mentioned */
  brandMentionRate: number;
  /** % of responses where client brand was mentioned first */
  firstMentionRate: number;
  /** Average mention position (1 = always first, higher = lower position) */
  avgMentionPosition: number;
  /** Overall share of voice across all responses */
  shareOfVoice: number;
  /** Total responses analyzed */
  totalResponses: number;
  /** Responses where client was mentioned */
  responsesWithMention: number;
  /** Responses where client was mentioned first */
  responsesWithFirstMention: number;
  /** Per-brand aggregated metrics */
  brandMetrics: Record<string, {
    mentionRate: number;
    avgMentionCount: number;
    firstMentionRate: number;
    totalMentions: number;
  }>;
}

/**
 * Aggregate text analysis results across multiple responses.
 *
 * @param results - Array of individual TextAnalysisResult objects
 * @param clientName - The client brand name
 * @returns Aggregated metrics
 */
export function aggregateTextMetrics(
  results: TextAnalysisResult[],
  clientName: string,
): AggregatedTextMetrics {
  if (results.length === 0) {
    return {
      brandMentionRate: 0,
      firstMentionRate: 0,
      avgMentionPosition: 0,
      shareOfVoice: 0,
      totalResponses: 0,
      responsesWithMention: 0,
      responsesWithFirstMention: 0,
      brandMetrics: {},
    };
  }

  let responsesWithMention = 0;
  let responsesWithFirstMention = 0;
  let positionSum = 0;
  let positionCount = 0;
  let totalClientMentions = 0;
  let totalAllMentions = 0;

  // Track per-brand metrics
  const brandTotals: Record<string, {
    mentions: number;
    responseCount: number;
    firstMentionCount: number;
    totalMentionCount: number;
  }> = {};

  for (const result of results) {
    // Client metrics
    if (result.clientMentioned) {
      responsesWithMention++;
      if (result.clientMentionRank === 1) {
        responsesWithFirstMention++;
      }
      if (result.clientMentionRank !== null) {
        positionSum += result.clientMentionRank;
        positionCount++;
      }
    }

    totalClientMentions += result.brands[clientName]?.mentionCount ?? 0;
    totalAllMentions += result.totalMentions;

    // Per-brand metrics
    for (const [brand, data] of Object.entries(result.brands)) {
      if (!brandTotals[brand]) {
        brandTotals[brand] = {
          mentions: 0,
          responseCount: 0,
          firstMentionCount: 0,
          totalMentionCount: 0,
        };
      }
      if (data.mentioned) {
        brandTotals[brand].responseCount++;
        brandTotals[brand].totalMentionCount += data.mentionCount;
        if (data.mentionRank === 1) {
          brandTotals[brand].firstMentionCount++;
        }
      }
    }
  }

  const totalResponses = results.length;
  const brandMetrics: AggregatedTextMetrics['brandMetrics'] = {};

  for (const [brand, totals] of Object.entries(brandTotals)) {
    brandMetrics[brand] = {
      mentionRate: totalResponses > 0 ? totals.responseCount / totalResponses : 0,
      avgMentionCount: totals.responseCount > 0 ? totals.totalMentionCount / totals.responseCount : 0,
      firstMentionRate: totalResponses > 0 ? totals.firstMentionCount / totalResponses : 0,
      totalMentions: totals.totalMentionCount,
    };
  }

  return {
    brandMentionRate: totalResponses > 0 ? responsesWithMention / totalResponses : 0,
    firstMentionRate: totalResponses > 0 ? responsesWithFirstMention / totalResponses : 0,
    avgMentionPosition: positionCount > 0 ? positionSum / positionCount : 0,
    shareOfVoice: totalAllMentions > 0 ? totalClientMentions / totalAllMentions : 0,
    totalResponses,
    responsesWithMention,
    responsesWithFirstMention,
    brandMetrics,
  };
}
