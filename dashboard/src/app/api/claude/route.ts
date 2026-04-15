/**
 * Claude Sonnet 4.6 API Route
 *
 * POST /api/claude
 * Body: { prompt: string, promptId: string, topicId: string }
 *
 * Features:
 * - Server-side rate limiting (3s minimum between requests)
 * - Uses Anthropic SDK for API calls
 * - Retry logic for 429 errors
 * - Returns Claude response with extracted citations
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = 'claude-sonnet-4-6';
const RATE_LIMIT_MS = 3000; // 3 seconds

// Track last request time (in-memory, resets on server restart)
let lastRequestTime = 0;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, promptId, topicId } = body;

    if (!prompt || !promptId || !topicId) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, promptId, topicId' },
        { status: 400 }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env.local' },
        { status: 500 }
      );
    }

    // Enforce rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
      console.log(`[Claude API] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Update last request time
    lastRequestTime = Date.now();

    // Call Claude API with retry logic
    const result = await callClaudeWithRetry(prompt);

    return NextResponse.json({
      promptId,
      topicId,
      responseText: result.responseText,
      citations: result.citations,
    });

  } catch (error) {
    console.error('[Claude API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Call Claude API with retry logic for 429 errors
 */
async function callClaudeWithRetry(prompt: string, retryCount = 0): Promise<{
  responseText: string;
  citations: string[];
}> {
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract response text
    let responseText = '';
    for (const block of message.content) {
      if (block.type === 'text') {
        responseText += block.text;
      }
    }

    // Extract citations from markdown links
    const citations = extractCitations(responseText);

    return {
      responseText,
      citations,
    };

  } catch (error: any) {
    // Handle 429 rate limit error
    if (error.status === 429 && retryCount === 0) {
      console.log('[Claude API] 429 rate limit hit, waiting 10s and retrying once...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      return callClaudeWithRetry(prompt, retryCount + 1); // Retry once
    }

    console.error('[Claude API] Call failed:', error);
    throw error;
  }
}

/**
 * Extract URLs from markdown links in text
 */
function extractCitations(text: string): string[] {
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
