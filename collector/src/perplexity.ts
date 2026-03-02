import type { PerplexityRequest, PerplexityResponse } from './types.js';
import { RateLimiter, sleep } from './rate-limiter.js';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [2_000, 5_000, 15_000]; // exponential-ish back-off

export class PerplexityClient {
  private apiKey: string;
  private model: string;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string, model: string, rpmLimit: number) {
    this.apiKey = apiKey;
    this.model = model;
    this.rateLimiter = new RateLimiter(rpmLimit);
  }

  /**
   * Send a single query to Perplexity Sonar and return the raw API response.
   * Handles rate limiting and retries with back-off.
   */
  async query(promptText: string): Promise<PerplexityResponse> {
    const body: PerplexityRequest = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Provide detailed, well-researched answers with specific brand recommendations and comparisons when asked about products or services.',
        },
        {
          role: 'user',
          content: promptText,
        },
      ],
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Wait for rate limit clearance
      await this.rateLimiter.acquire();

      try {
        const res = await fetch(PERPLEXITY_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (res.status === 429) {
          // Rate limited by server — wait and retry
          const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
          const waitMs = Math.max(retryAfter * 1000, RETRY_BACKOFF_MS[attempt] || 15_000);
          console.warn(`  ⚠  Rate limited (429). Waiting ${(waitMs / 1000).toFixed(0)}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
          await sleep(waitMs);
          continue;
        }

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`Perplexity API ${res.status}: ${errorBody}`);
        }

        const data: PerplexityResponse = await res.json();
        return data;
      } catch (err) {
        lastError = err as Error;

        if (attempt < MAX_RETRIES) {
          const waitMs = RETRY_BACKOFF_MS[attempt] || 15_000;
          console.warn(`  ⚠  Request failed: ${lastError.message}. Retrying in ${(waitMs / 1000).toFixed(0)}s (${attempt + 1}/${MAX_RETRIES})...`);
          await sleep(waitMs);
        }
      }
    }

    throw new Error(`Perplexity API call failed after ${MAX_RETRIES} retries: ${lastError?.message}`);
  }

  get currentModel(): string {
    return this.model;
  }
}
