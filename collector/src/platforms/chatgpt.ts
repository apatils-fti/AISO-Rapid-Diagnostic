/**
 * ChatGPT Search client using OpenAI Responses API with web_search tool.
 * Returns search-grounded responses with citations.
 */

import type { PlatformClient, PlatformResponse } from './types.js';
import { RateLimiter, sleep } from '../rate-limiter.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const MAX_RETRIES = 5;
const RETRY_BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 120_000];

interface OpenAIResponsesRequest {
  model: string;
  input: string;
  tools: Array<{ type: 'web_search' }>;
}

interface UrlCitation {
  type: 'url_citation';
  url: string;
  title?: string;
  start_index: number;
  end_index: number;
}

interface OutputTextContent {
  type: 'output_text';
  text: string;
  annotations?: UrlCitation[];
}

interface MessageBlock {
  type: 'message';
  status: string;
  content: OutputTextContent[];
  role?: string;
}

interface WebSearchCallBlock {
  type: 'web_search_call';
  status: string;
  action?: {
    type: string;
    query?: string;
    queries?: string[];
  };
}

type OutputBlock = MessageBlock | WebSearchCallBlock;

interface OpenAIResponsesResponse {
  id: string;
  model: string;
  created_at: number;
  output: OutputBlock[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

export class ChatGPTClient implements PlatformClient {
  readonly platform = 'chatgpt_search' as const;
  readonly model: string;
  private apiKey: string;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string, model = 'gpt-4o', rpmLimit = 60) {
    this.apiKey = apiKey;
    this.model = model;
    this.rateLimiter = new RateLimiter(rpmLimit);
  }

  /**
   * Send a query to ChatGPT with web search enabled.
   * Returns normalized PlatformResponse with citations extracted from search results.
   */
  async query(promptText: string): Promise<PlatformResponse> {
    const body: OpenAIResponsesRequest = {
      model: this.model,
      input: promptText,
      tools: [{ type: 'web_search' }],
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.rateLimiter.acquire();

      try {
        const res = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
          const waitMs = Math.max(retryAfter * 1000, RETRY_BACKOFF_MS[attempt] || 15_000);
          console.warn(`  ⚠  Rate limited (429). Waiting ${(waitMs / 1000).toFixed(0)}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
          await sleep(waitMs);
          continue;
        }

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`OpenAI API ${res.status}: ${errorBody}`);
        }

        const data: OpenAIResponsesResponse = await res.json();
        return this.normalizeResponse(data);
      } catch (err) {
        lastError = err as Error;

        if (attempt < MAX_RETRIES) {
          const waitMs = RETRY_BACKOFF_MS[attempt] || 15_000;
          console.warn(`  ⚠  Request failed: ${lastError.message}. Retrying in ${(waitMs / 1000).toFixed(0)}s (${attempt + 1}/${MAX_RETRIES})...`);
          await sleep(waitMs);
        }
      }
    }

    throw new Error(`OpenAI API call failed after ${MAX_RETRIES} retries: ${lastError?.message}`);
  }

  /**
   * Convert OpenAI Responses API format to normalized PlatformResponse.
   * Text is in output[].content[].text (type: output_text)
   * Citations are in output[].content[].annotations[] (type: url_citation)
   */
  private normalizeResponse(raw: OpenAIResponsesResponse): PlatformResponse {
    const textParts: string[] = [];
    const citations: string[] = [];

    for (const block of raw.output) {
      if (block.type === 'message' && Array.isArray(block.content)) {
        for (const contentItem of block.content) {
          if (contentItem.type === 'output_text') {
            // Extract text
            if (contentItem.text) {
              textParts.push(contentItem.text);
            }
            // Extract citations from annotations
            if (Array.isArray(contentItem.annotations)) {
              for (const annotation of contentItem.annotations) {
                if (annotation.type === 'url_citation' && annotation.url) {
                  // Remove tracking params and dedupe
                  const cleanUrl = annotation.url.split('?utm_source=')[0];
                  if (!citations.includes(cleanUrl)) {
                    citations.push(cleanUrl);
                  }
                }
              }
            }
          }
        }
      }
    }

    return {
      platform: 'chatgpt_search',
      model: raw.model,
      content: textParts.join('\n'),
      citations,
      usage: raw.usage ? {
        promptTokens: raw.usage.input_tokens,
        completionTokens: raw.usage.output_tokens,
      } : undefined,
      rawResponse: raw,
    };
  }
}
