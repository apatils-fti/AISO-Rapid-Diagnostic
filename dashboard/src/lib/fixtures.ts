import clientConfigData from '@/fixtures/clientConfig.json';
import promptLibraryData from '@/fixtures/promptLibrary.json';
import analyzedMetricsData from '@/fixtures/analyzedMetrics.json';
import rawResultsData from '@/fixtures/rawResults.json';
import type {
  ClientConfig,
  PromptLibrary,
  AnalyzedMetrics,
  RawResults,
  TopicResult,
  IsotopeType
} from './types';

export const clientConfig = clientConfigData as ClientConfig;
export const promptLibrary = promptLibraryData as PromptLibrary;
export const analyzedMetrics = analyzedMetricsData as AnalyzedMetrics;
export const rawResults = rawResultsData as RawResults;

// Helper functions
export function getTopicById(topicId: string): TopicResult | undefined {
  return analyzedMetrics.topicResults.find(t => t.topicId === topicId);
}

export function getPromptsForTopic(topicId: string) {
  const topic = promptLibrary.topics.find(t => t.id === topicId);
  return topic?.prompts || [];
}

export function getRawResultsForPrompt(promptId: string) {
  return rawResults.results.filter(r => r.promptId === promptId);
}

export function getTopicCategories(): string[] {
  const categories = new Set(promptLibrary.topics.map(t => t.category));
  return Array.from(categories);
}

export function getTopicsByCategory(category: string) {
  return analyzedMetrics.topicResults.filter(t => t.category === category);
}

export const ISOTOPE_TYPES: IsotopeType[] = [
  'informational',
  'commercial',
  'comparative',
  'persona',
  'specific',
  'conversational'
];

export const ISOTOPE_LABELS: Record<IsotopeType, string> = {
  informational: 'Informational',
  commercial: 'Commercial',
  comparative: 'Comparative',
  persona: 'Persona',
  specific: 'Specific',
  conversational: 'Conversational'
};

export const ISOTOPE_DESCRIPTIONS: Record<IsotopeType, string> = {
  informational: 'Educational queries asking "What is X?"',
  commercial: 'Buying intent queries like "Best X tools"',
  comparative: 'Head-to-head queries like "X vs Y vs Z"',
  persona: 'Role-based queries like "As a [role], what should I use?"',
  specific: 'Narrow, detailed queries with multiple requirements',
  conversational: 'Natural, casual phrasing like real user questions'
};
