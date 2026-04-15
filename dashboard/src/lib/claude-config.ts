/**
 * Claude Sonnet 4.6 Configuration
 *
 * Feature flag: Set NEXT_PUBLIC_CLAUDE_ENABLED=true in .env.local
 * API key: Set ANTHROPIC_API_KEY in .env.local (server-side only)
 *
 * Using the same 250 prompts sample as Google AI Overviews and Gemini
 * This configuration enables checking Claude Sonnet 4.6 responses
 * for brand citations and mentions.
 */

export const CLAUDE_CONFIG = {
  // Feature flag - defaults to false (feature hidden in production)
  ENABLED: process.env.NEXT_PUBLIC_CLAUDE_ENABLED === 'true',

  // Claude API configuration (server-side only, not exposed to client)
  // API key should be stored as ANTHROPIC_API_KEY in .env.local
  MODEL: 'claude-sonnet-4-6',

  // Request limits (matching Gemini sample size)
  MAX_REQUESTS: 250,

  // Rate limiting (Claude is more generous: 3s minimum between requests)
  RATE_LIMIT_MS: 3000,
} as const;

export type ClaudeConfig = typeof CLAUDE_CONFIG;
