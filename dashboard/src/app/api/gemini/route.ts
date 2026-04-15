/**
 * Gemini 2.5 Flash API Route
 *
 * POST /api/gemini
 * Body: { prompt: string, promptId: string, topicId: string }
 *
 * Features:
 * - Server-side rate limiting (7s minimum between requests)
 * - Retry logic for 429 errors
 * - Returns Gemini response with extracted citations
 */

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const RATE_LIMIT_MS = 7000; // 7 seconds

// Track last request time (in-memory, resets on server restart)
let lastRequestTime = 0;

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

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Enforce rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
      console.log(`[Gemini API] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Update last request time
    lastRequestTime = Date.now();

    // Call Gemini API with retry logic
    const result = await callGeminiWithRetry(prompt);

    return NextResponse.json({
      promptId,
      topicId,
      responseText: result.responseText,
      citations: result.citations,
    });

  } catch (error) {
    console.error('[Gemini API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Call Gemini API with retry logic for 429 errors
 */
async function callGeminiWithRetry(prompt: string, retryCount = 0): Promise<{
  responseText: string;
  citations: string[];
}> {
  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      }),
    });

    // Handle 429 rate limit error
    if (response.status === 429 && retryCount === 0) {
      console.log('[Gemini API] 429 rate limit hit, waiting 10s and retrying once...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      return callGeminiWithRetry(prompt, retryCount + 1); // Retry once
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Extract response text
    let responseText = '';
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        responseText = candidate.content.parts[0].text || '';
      }
    }

    // Extract citations from markdown links
    const citations = extractCitations(responseText);

    return {
      responseText,
      citations,
    };

  } catch (error) {
    console.error('[Gemini API] Call failed:', error);
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
