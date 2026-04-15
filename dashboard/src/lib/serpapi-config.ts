/**
 * SerpApi Configuration for Google AI Overviews
 *
 * Feature flag: Set NEXT_PUBLIC_SERPAPI_ENABLED=true in .env.local
 * API key: Set NEXT_PUBLIC_SERPAPI_KEY in .env.local
 *
 * Free tier: 250 searches total
 * This configuration enables checking Google AI Overview visibility
 * for brand citations and mentions.
 */

export const SERPAPI_CONFIG = {
  // Feature flag - defaults to false (feature hidden in production)
  ENABLED: process.env.NEXT_PUBLIC_SERPAPI_ENABLED === 'true',

  // SerpApi configuration
  API_KEY: process.env.NEXT_PUBLIC_SERPAPI_KEY || '',
  ENDPOINT: 'https://serpapi.com/search.json',

  // Search limits (free tier protection)
  MAX_SEARCHES: 250,
} as const;

export type SerpApiConfig = typeof SERPAPI_CONFIG;
