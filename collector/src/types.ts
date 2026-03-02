// ── Prompt Library Types ──

export interface ClientInfo {
  name: string;
  domains: string[];
}

export interface CompetitorInfo {
  name: string;
  domains: string[];
}

export interface Prompt {
  id: string;
  isotope: string;
  text: string;
}

export interface Topic {
  id: string;
  name: string;
  category: string;
  prompts: Prompt[];
}

export interface PromptLibraryMetadata {
  version: string;
  created: string;
  totalPrompts: number;
  totalTopics: number;
  isotopesPerTopic: number;
  runsPerPrompt: number;
  estimatedApiCalls: number;
  estimatedCost: string;
}

export interface PromptLibrary {
  client: ClientInfo;
  competitors: CompetitorInfo[];
  topics: Topic[];
  metadata: PromptLibraryMetadata;
}

// ── Perplexity API Types ──

export interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PerplexityRequest {
  model: string;
  messages: PerplexityMessage[];
  return_related_questions?: boolean;
  return_images?: boolean;
  search_recency_filter?: string;
}

export interface PerplexityCitation {
  url: string;
  title?: string;
  snippet?: string;
}

export interface PerplexitySearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface PerplexityChoice {
  index: number;
  finish_reason: string;
  message: {
    role: string;
    content: string;
  };
  delta?: {
    role: string;
    content: string;
  };
}

export interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations: string[];
  search_results?: PerplexitySearchResult[];
  choices: PerplexityChoice[];
}

// ── Collection Output Types ──

export interface RunResult {
  runId: number;
  timestamp: string;
  response: PerplexityResponse;
  durationMs: number;
}

export interface PromptResult {
  promptId: string;
  promptText: string;
  topicId: string;
  topicName: string;
  category: string;
  isotope: string;
  platform: 'perplexity';
  model: string;
  collectionTimestamp: string;
  runs: RunResult[];
}

export interface CollectionManifest {
  client: ClientInfo;
  competitors: CompetitorInfo[];
  timestamp: string;
  model: string;
  runsPerPrompt: number;
  totalPrompts: number;
  totalApiCalls: number;
  completedApiCalls: number;
  failedApiCalls: number;
  durationMs: number;
  promptLibraryPath: string;
}

// ── CLI Options ──

export interface CollectOptions {
  promptLibraryPath: string;
  outputDir: string;
  model: string;
  runsPerPrompt: number;
  rpmLimit: number;
  dryRun: boolean;
  resumeFrom?: string; // prompt ID to resume from (for crash recovery)
}
