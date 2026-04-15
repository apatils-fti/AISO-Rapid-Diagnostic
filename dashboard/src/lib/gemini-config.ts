/**
 * Gemini 2.5 Flash Configuration
 *
 * Feature flag: Set NEXT_PUBLIC_GEMINI_ENABLED=true in .env.local
 * API key: Set NEXT_PUBLIC_GEMINI_API_KEY in .env.local
 *
 * Free tier: 250 requests total (matching Google AI sample size)
 * This configuration enables checking Gemini 2.5 Flash responses
 * for brand citations and mentions.
 */

export const GEMINI_CONFIG = {
  // Feature flag - defaults to false (feature hidden in production)
  ENABLED: process.env.NEXT_PUBLIC_GEMINI_ENABLED === 'true',

  // Gemini API configuration
  API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
  ENDPOINT: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',

  // Request limits (free tier protection)
  MAX_REQUESTS: 250,

  // Rate limiting (10 RPM free tier = 6s minimum, using 7s for safety)
  RATE_LIMIT_MS: 7000,
} as const;

export type GeminiConfig = typeof GEMINI_CONFIG;
