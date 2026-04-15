/**
 * Gemini 2.5 Flash Service
 *
 * Handles:
 * - API calls to Gemini API
 * - Response parsing
 * - Citation extraction from markdown
 * - Client mention detection
 * - Request tracking (localStorage)
 * - Data aggregation for Compare view
 */

import { GEMINI_CONFIG } from './gemini-config';
import { clientConfig } from './fixtures';

export interface GeminiResult {
  promptId: string;
  topicId: string;
  responseText: string;
  citations: string[];
  clientMentioned: boolean;
  timestamp: string;
}

interface AggregatedStats {
  totalChecked: number;
  responsesWithCitations: number;
  totalCitations: number;
  clientMentions: number;
  avgCitationsPerResponse: number;
}

interface TopicStats {
  checked: number;
  responsesWithCitations: number;
  score: number; // 0-100
}

export class GeminiService {
  private static STORAGE_KEY = 'gemini-results';
  private static COUNTER_KEY = 'gemini-request-count';

  /**
   * Check Gemini response for a prompt
   */
  static async checkPrompt(
    promptText: string,
    promptId: string,
    topicId: string
  ): Promise<GeminiResult> {
    // Check if already exists
    const existing = this.getResult(promptId);
    if (existing) {
      console.log('[Gemini] Using cached result for prompt:', promptId);
      return existing;
    }

    // Check request limit
    const requestCount = this.getRequestsUsed();
    if (requestCount >= GEMINI_CONFIG.MAX_REQUESTS) {
      throw new Error(
        `Request limit reached (${GEMINI_CONFIG.MAX_REQUESTS}). Cannot make more queries.`
      );
    }

    // Validate API key
    if (!GEMINI_CONFIG.API_KEY) {
      throw new Error('Gemini API key not configured. Set NEXT_PUBLIC_GEMINI_API_KEY in .env.local');
    }

    console.log('[Gemini] Querying Gemini 2.5 Flash for:', promptText);

    try {
      // Call Gemini API
      const response = await fetch(`${GEMINI_CONFIG.ENDPOINT}?key=${GEMINI_CONFIG.API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: promptText
            }]
          }]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      // Parse response
      const result = this.parseResponse(data, promptId, topicId);

      // Save result
      this.saveResult(result);

      // Increment request counter
      this.incrementCounter();

      console.log('[Gemini] Result:', {
        citations: result.citations.length,
        clientMentioned: result.clientMentioned,
        textLength: result.responseText.length,
      });

      return result;
    } catch (error) {
      console.error('[Gemini] Error:', error);
      throw error;
    }
  }

  /**
   * Parse Gemini API response
   */
  private static parseResponse(
    data: any,
    promptId: string,
    topicId: string
  ): GeminiResult {
    // Extract response text from Gemini response structure
    let responseText = '';
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        responseText = candidate.content.parts[0].text || '';
      }
    }

    // Extract citations from markdown links [text](url)
    const citations = this.extractCitations(responseText);

    // Check if client is mentioned in response text or citations
    const clientMentioned = this.detectClientMention(responseText, citations);

    return {
      promptId,
      topicId,
      responseText,
      citations,
      clientMentioned,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Extract URLs from markdown links in text
   */
  private static extractCitations(text: string): string[] {
    const citations: string[] = [];

    // Match markdown links: [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = markdownLinkRegex.exec(text)) !== null) {
      const url = match[2];
      if (url && url.startsWith('http')) {
        citations.push(url);
      }
    }

    // Also match plain URLs (http:// or https://)
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const plainUrls = text.match(urlRegex) || [];

    for (const url of plainUrls) {
      if (!citations.includes(url)) {
        citations.push(url);
      }
    }

    return Array.from(new Set(citations)); // Remove duplicates
  }

  /**
   * Detect client mention in response text or citations
   */
  private static detectClientMention(responseText: string, citations: string[]): boolean {
    const lowerText = responseText.toLowerCase();
    const brandName = clientConfig.clientName.toLowerCase();

    // Check text for brand mention
    if (lowerText.includes(brandName)) {
      return true;
    }

    // Check citations for client domains
    for (const url of citations) {
      const lowerUrl = url.toLowerCase();
      for (const domain of clientConfig.clientDomains) {
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
  static saveResult(result: GeminiResult): void {
    if (typeof window === 'undefined') return;

    const results = this.getAllResults();
    results.set(result.promptId, result);

    const serialized = JSON.stringify(Array.from(results.entries()));
    localStorage.setItem(this.STORAGE_KEY, serialized);
  }

  /**
   * Get result for a specific prompt
   */
  static getResult(promptId: string): GeminiResult | null {
    if (typeof window === 'undefined') return null;

    const results = this.getAllResults();
    return results.get(promptId) || null;
  }

  /**
   * Get all results from localStorage
   */
  static getAllResults(): Map<string, GeminiResult> {
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
   * Get number of requests used
   */
  static getRequestsUsed(): number {
    if (typeof window === 'undefined') return 0;

    const stored = localStorage.getItem(this.COUNTER_KEY);
    return stored ? parseInt(stored, 10) : 0;
  }

  /**
   * Get remaining requests
   */
  static getRemainingRequests(): number {
    return Math.max(0, GEMINI_CONFIG.MAX_REQUESTS - this.getRequestsUsed());
  }

  /**
   * Increment request counter
   */
  private static incrementCounter(): void {
    if (typeof window === 'undefined') return;

    const current = this.getRequestsUsed();
    localStorage.setItem(this.COUNTER_KEY, String(current + 1));
  }

  /**
   * Get aggregated stats for platform comparison
   */
  static getAggregatedStats(): AggregatedStats {
    const results = this.getAllResults();
    const allResults = Array.from(results.values());

    const totalChecked = allResults.length;
    const responsesWithCitations = allResults.filter((r) => r.citations.length > 0).length;
    const totalCitations = allResults.reduce((sum, r) => sum + r.citations.length, 0);
    const clientMentions = allResults.filter((r) => r.clientMentioned).length;

    const avgCitationsPerResponse =
      totalChecked > 0 ? totalCitations / totalChecked : 0;

    return {
      totalChecked,
      responsesWithCitations,
      totalCitations,
      clientMentions,
      avgCitationsPerResponse,
    };
  }

  /**
   * Get topic-specific stats
   */
  static getTopicStats(topicId: string): TopicStats {
    const results = this.getAllResults();
    const topicResults = Array.from(results.values()).filter((r) => r.topicId === topicId);

    const checked = topicResults.length;
    const responsesWithCitations = topicResults.filter((r) => r.citations.length > 0).length;

    // Score: percentage of prompts with citations
    const score = checked > 0 ? (responsesWithCitations / checked) * 100 : 0;

    return {
      checked,
      responsesWithCitations,
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
