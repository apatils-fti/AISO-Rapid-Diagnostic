/**
 * Platform abstraction layer for multi-platform AI search collection.
 * Supports Perplexity, ChatGPT Search, Google AI Overview, and Claude Search.
 */

export type PlatformId = 'perplexity' | 'chatgpt_search' | 'google_ai_overview' | 'claude_search';

/**
 * Normalized response from any AI search platform.
 * Platform-specific details are preserved in rawResponse.
 */
export interface PlatformResponse {
  platform: PlatformId;
  model: string;
  content: string;           // The LLM response text
  citations: string[];       // URLs cited in the response (may be empty)
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  rawResponse: unknown;      // Original API response for debugging/analysis
}

/**
 * Common interface for all platform clients.
 * Each platform implements this interface with its specific API logic.
 */
export interface PlatformClient {
  readonly platform: PlatformId;
  readonly model: string;

  /**
   * Send a query to the platform and return a normalized response.
   * Handles rate limiting and retries internally.
   */
  query(promptText: string): Promise<PlatformResponse>;
}

/**
 * Configuration for creating a platform client.
 */
export interface PlatformConfig {
  apiKey: string;
  model?: string;
  rpmLimit?: number;
}

/**
 * Environment variable names for each platform's API key.
 */
export const PLATFORM_ENV_VARS: Record<PlatformId, string> = {
  perplexity: 'PERPLEXITY_API_KEY',
  chatgpt_search: 'OPENAI_API_KEY',
  google_ai_overview: 'GOOGLE_API_KEY',
  claude_search: 'ANTHROPIC_API_KEY',
};

/**
 * Default models for each platform.
 */
export const DEFAULT_MODELS: Record<PlatformId, string> = {
  perplexity: 'sonar',
  chatgpt_search: 'gpt-4o',
  google_ai_overview: 'gemini-pro',
  claude_search: 'claude-3-5-sonnet-20241022',
};

/**
 * Default rate limits (requests per minute) for each platform.
 */
export const DEFAULT_RPM_LIMITS: Record<PlatformId, number> = {
  perplexity: 50,
  chatgpt_search: 60,
  google_ai_overview: 60,
  claude_search: 60,
};
