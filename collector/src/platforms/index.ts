/**
 * Platform factory - creates platform clients by ID.
 */

export type { PlatformId, PlatformClient, PlatformResponse, PlatformConfig } from './types.js';
export { PLATFORM_ENV_VARS, DEFAULT_MODELS, DEFAULT_RPM_LIMITS } from './types.js';

import type { PlatformId, PlatformClient } from './types.js';
import { DEFAULT_MODELS, DEFAULT_RPM_LIMITS, PLATFORM_ENV_VARS } from './types.js';
import { PerplexityClient } from './perplexity.js';
import { ChatGPTClient } from './chatgpt.js';

/**
 * Create a platform client for the given platform ID.
 * Throws if the platform is not yet supported.
 */
export function createPlatformClient(
  platform: PlatformId,
  apiKey: string,
  model?: string,
  rpmLimit?: number
): PlatformClient {
  const resolvedModel = model ?? DEFAULT_MODELS[platform];
  const resolvedRpmLimit = rpmLimit ?? DEFAULT_RPM_LIMITS[platform];

  switch (platform) {
    case 'perplexity':
      return new PerplexityClient(apiKey, resolvedModel, resolvedRpmLimit);
    case 'chatgpt_search':
      return new ChatGPTClient(apiKey, resolvedModel, resolvedRpmLimit);
    case 'google_ai_overview':
      throw new Error('Google AI Overview support coming soon');
    case 'claude_search':
      throw new Error('Claude Search support coming soon');
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

/**
 * Get the API key for a platform from environment variables.
 * Throws with helpful message if not set.
 */
export function getApiKeyForPlatform(platform: PlatformId): string {
  const envVar = PLATFORM_ENV_VARS[platform];
  const apiKey = process.env[envVar];

  if (!apiKey) {
    throw new Error(
      `Missing ${envVar} environment variable.\n` +
      `Set it with: export ${envVar}=your-api-key`
    );
  }

  return apiKey;
}

/**
 * Check which platforms have API keys configured.
 */
export function getAvailablePlatforms(): PlatformId[] {
  const platforms: PlatformId[] = ['perplexity', 'chatgpt_search', 'google_ai_overview', 'claude_search'];
  return platforms.filter(p => {
    const envVar = PLATFORM_ENV_VARS[p];
    return !!process.env[envVar];
  });
}
