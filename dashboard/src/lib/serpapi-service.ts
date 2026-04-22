/**
 * SerpApi Service for Google AI Overviews
 *
 * Handles:
 * - API calls to SerpApi Google Search
 * - Parsing AI Overview snippets
 * - Citation extraction
 * - Client mention detection
 * - Search credit tracking (localStorage)
 * - Data aggregation for Compare view
 */

import { SERPAPI_CONFIG } from './serpapi-config';

/**
 * Passed into checkAIOverview so detectClientMention can tell if the active
 * client's brand shows up in the overview text or citations. Previously read
 * statically from clientConfig (a J.Crew snapshot) — now threaded per-call.
 */
export interface SerpApiBrandContext {
  brandName: string;
  clientDomains: string[];
}

export interface GoogleAIOverviewResult {
  promptId: string;
  topicId: string;
  hasOverview: boolean;
  overviewText: string;
  citedSources: string[];
  clientMentioned: boolean;
  timestamp: string;
}

interface AggregatedStats {
  totalChecked: number;
  overviewsFound: number;
  citationsFound: number;
  clientMentions: number;
  avgCitationsPerOverview: number;
}

interface TopicStats {
  checked: number;
  overviewsFound: number;
  score: number; // 0-100
}

export class SerpApiService {
  private static STORAGE_KEY = 'google-ai-overview-results';
  private static COUNTER_KEY = 'serpapi-search-count';

  /**
   * Check AI Overview for a prompt
   */
  static async checkAIOverview(
    promptText: string,
    promptId: string,
    topicId: string,
    brandContext?: SerpApiBrandContext
  ): Promise<GoogleAIOverviewResult> {
    // Check if already exists
    const existing = this.getResult(promptId);
    if (existing) {
      console.log('[SerpApi] Using cached result for prompt:', promptId);
      return existing;
    }

    // Check search limit
    const searchCount = this.getSearchesUsed();
    if (searchCount >= SERPAPI_CONFIG.MAX_SEARCHES) {
      throw new Error(
        `Search limit reached (${SERPAPI_CONFIG.MAX_SEARCHES}). Cannot make more queries.`
      );
    }

    // Validate API key
    if (!SERPAPI_CONFIG.API_KEY) {
      throw new Error('SerpApi API key not configured. Set NEXT_PUBLIC_SERPAPI_KEY in .env.local');
    }

    console.log('[SerpApi] Querying Google AI Overview for:', promptText);

    try {
      // Build SerpApi request
      const params = new URLSearchParams({
        api_key: SERPAPI_CONFIG.API_KEY,
        engine: 'google',
        q: promptText,
        gl: 'us', // Location: United States
        hl: 'en', // Language: English
      });

      const response = await fetch(`${SERPAPI_CONFIG.ENDPOINT}?${params.toString()}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SerpApi error: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      // Parse AI Overview from response
      const result = this.parseAIOverview(data, promptId, topicId, brandContext);

      // Save result
      this.saveResult(result);

      // Increment search counter
      this.incrementCounter();

      console.log('[SerpApi] Result:', {
        hasOverview: result.hasOverview,
        citations: result.citedSources.length,
        clientMentioned: result.clientMentioned,
      });

      return result;
    } catch (error) {
      console.error('[SerpApi] Error:', error);
      throw error;
    }
  }

  /**
   * Parse AI Overview from SerpApi response
   */
  private static parseAIOverview(
    data: any,
    promptId: string,
    topicId: string,
    brandContext?: SerpApiBrandContext
  ): GoogleAIOverviewResult {
    const aiOverview = data.ai_overview;

    if (!aiOverview) {
      console.log('[SerpApi] No AI Overview found in response');
      return {
        promptId,
        topicId,
        hasOverview: false,
        overviewText: '',
        citedSources: [],
        clientMentioned: false,
        timestamp: new Date().toISOString(),
      };
    }

    // Extract overview text
    const overviewText = aiOverview.text || '';

    // Extract cited sources from AI Overview
    const citedSources: string[] = [];
    if (aiOverview.sources && Array.isArray(aiOverview.sources)) {
      for (const source of aiOverview.sources) {
        if (source.link) {
          citedSources.push(source.link);
        }
      }
    }

    // Check if client is mentioned in overview text or cited. When no
    // brandContext is passed the feature degrades to "client never detected"
    // rather than trying to match against a stale default — that's honest
    // for a multi-client pipeline.
    const clientMentioned = brandContext
      ? this.detectClientMention(overviewText, citedSources, brandContext)
      : false;

    return {
      promptId,
      topicId,
      hasOverview: true,
      overviewText,
      citedSources,
      clientMentioned,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detect client mention in overview text or citations
   */
  private static detectClientMention(
    overviewText: string,
    citedSources: string[],
    brandContext: SerpApiBrandContext
  ): boolean {
    const lowerText = overviewText.toLowerCase();
    const brandName = brandContext.brandName.toLowerCase();

    // Check text for brand mention
    if (brandName && lowerText.includes(brandName)) {
      return true;
    }

    // Check citations for client domains
    for (const url of citedSources) {
      const lowerUrl = url.toLowerCase();
      for (const domain of brandContext.clientDomains) {
        if (lowerUrl.includes(domain.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Save result to localStorage
   */
  static saveResult(result: GoogleAIOverviewResult): void {
    if (typeof window === 'undefined') return;

    const results = this.getAllResults();
    results.set(result.promptId, result);

    const serialized = JSON.stringify(Array.from(results.entries()));
    localStorage.setItem(this.STORAGE_KEY, serialized);
  }

  /**
   * Get result for a specific prompt
   */
  static getResult(promptId: string): GoogleAIOverviewResult | null {
    if (typeof window === 'undefined') return null;

    const results = this.getAllResults();
    return results.get(promptId) || null;
  }

  /**
   * Get all results from localStorage
   */
  static getAllResults(): Map<string, GoogleAIOverviewResult> {
    if (typeof window === 'undefined') return new Map();

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return new Map();

    try {
      const parsed = JSON.parse(stored);
      return new Map(parsed);
    } catch {
      return new Map();
    }
  }

  /**
   * Get number of searches used
   */
  static getSearchesUsed(): number {
    if (typeof window === 'undefined') return 0;

    const stored = localStorage.getItem(this.COUNTER_KEY);
    return stored ? parseInt(stored, 10) : 0;
  }

  /**
   * Get remaining searches
   */
  static getRemainingSearches(): number {
    return Math.max(0, SERPAPI_CONFIG.MAX_SEARCHES - this.getSearchesUsed());
  }

  /**
   * Increment search counter
   */
  private static incrementCounter(): void {
    if (typeof window === 'undefined') return;

    const current = this.getSearchesUsed();
    localStorage.setItem(this.COUNTER_KEY, String(current + 1));
  }

  /**
   * Get aggregated stats for platform comparison
   */
  static getAggregatedStats(): AggregatedStats {
    const results = this.getAllResults();
    const allResults = Array.from(results.values());

    const totalChecked = allResults.length;
    const overviewsFound = allResults.filter((r) => r.hasOverview).length;
    const citationsFound = allResults.reduce((sum, r) => sum + r.citedSources.length, 0);
    const clientMentions = allResults.filter((r) => r.clientMentioned).length;

    const avgCitationsPerOverview =
      overviewsFound > 0 ? citationsFound / overviewsFound : 0;

    return {
      totalChecked,
      overviewsFound,
      citationsFound,
      clientMentions,
      avgCitationsPerOverview,
    };
  }

  /**
   * Get topic-specific stats
   */
  static getTopicStats(topicId: string): TopicStats {
    const results = this.getAllResults();
    const topicResults = Array.from(results.values()).filter((r) => r.topicId === topicId);

    const checked = topicResults.length;
    const overviewsFound = topicResults.filter((r) => r.hasOverview).length;

    // Score: percentage of prompts with AI Overview
    const score = checked > 0 ? (overviewsFound / checked) * 100 : 0;

    return {
      checked,
      overviewsFound,
      score,
    };
  }

  /**
   * Clear all data (for testing)
   */
  static clearAll(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.COUNTER_KEY);
  }
}
