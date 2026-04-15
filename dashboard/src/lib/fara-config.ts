/**
 * Fara-7B Visual Check Configuration
 *
 * Feature flag: Set NEXT_PUBLIC_FARA_ENABLED=true in .env.local
 * Ollama endpoint: Defaults to localhost:11434
 *
 * This configuration enables visual spot-checking of AI search results
 * using the Fara-7B vision-language model running locally via Ollama.
 */

export const FARA_CONFIG = {
  // Feature flag - defaults to false (feature hidden in production)
  ENABLED: process.env.NEXT_PUBLIC_FARA_ENABLED === 'true',

  // Ollama configuration
  OLLAMA_ENDPOINT: process.env.NEXT_PUBLIC_OLLAMA_ENDPOINT || 'http://localhost:11434',
  MODEL: 'hf.co/bartowski/microsoft_Fara-7B-GGUF:Q3_K_S',

  // Rate limiting (protects 4GB VRAM GPU)
  MAX_QUERIES_PER_SESSION: 5,
  DELAY_BETWEEN_QUERIES_MS: 30000, // 30 seconds between queries

  // Timeouts
  REQUEST_TIMEOUT_MS: 45000, // 45 seconds (vision models are slow)
  HEALTH_CHECK_TIMEOUT_MS: 5000, // 5 seconds for health check
} as const;

export type FaraConfig = typeof FARA_CONFIG;
