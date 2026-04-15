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

// Text metrics helpers
export function getCompetitorTextMetrics(name: string) {
  return analyzedMetrics.textMetrics?.overall.brandMetrics[name];
}

export function getTopicTextMetrics(topicId: string) {
  return analyzedMetrics.textMetrics?.byTopic[topicId];
}

export function getAllBrandMentionRates() {
  const brandMetrics = analyzedMetrics.textMetrics?.overall.brandMetrics ?? {};
  return Object.entries(brandMetrics)
    .map(([name, metrics]) => ({
      name,
      mentionRate: metrics.mentionRate,
      firstMentionRate: metrics.firstMentionRate,
      totalMentions: metrics.totalMentions,
    }))
    .sort((a, b) => b.mentionRate - a.mentionRate);
}

/**
 * Get brand metrics filtered to selected platforms.
 * Averages mention rates across the selected platforms, weighted by response count.
 * Falls back to combined overall metrics if per-platform data isn't available.
 */
export function getFilteredBrandMetrics(selectedPlatforms?: string[]) {
  const byPlatform = (analyzedMetrics.textMetrics as any)?.byPlatform;
  if (!selectedPlatforms || !byPlatform) {
    return analyzedMetrics.textMetrics?.overall?.brandMetrics ?? {};
  }

  const merged: Record<string, { mentionRate: number; firstMentionRate: number; avgMentionCount: number; totalMentions: number }> = {};
  let totalResponses = 0;

  for (const platform of selectedPlatforms) {
    const platformData = byPlatform[platform];
    if (!platformData) continue;
    totalResponses += platformData.totalResponses;

    for (const [brand, metrics] of Object.entries(platformData.brandMetrics as Record<string, any>)) {
      if (!merged[brand]) {
        merged[brand] = { mentionRate: 0, firstMentionRate: 0, avgMentionCount: 0, totalMentions: 0 };
      }
      // Weight by response count for accurate averaging
      merged[brand].mentionRate += metrics.mentionRate * platformData.totalResponses;
      merged[brand].firstMentionRate += metrics.firstMentionRate * platformData.totalResponses;
      merged[brand].avgMentionCount += metrics.avgMentionCount * platformData.totalResponses;
      merged[brand].totalMentions += metrics.totalMentions;
    }
  }

  // Normalize by total responses
  if (totalResponses > 0) {
    for (const brand of Object.keys(merged)) {
      merged[brand].mentionRate /= totalResponses;
      merged[brand].firstMentionRate /= totalResponses;
      merged[brand].avgMentionCount /= totalResponses;
    }
  }

  return merged;
}

/**
 * Get topic-level brand metrics filtered to selected platforms.
 */
export function getFilteredTopicBrandMetrics(topicId: string, selectedPlatforms?: string[]) {
  const byTopicByPlatform = (analyzedMetrics.textMetrics as any)?.byTopicByPlatform;
  if (!selectedPlatforms || !byTopicByPlatform?.[topicId]) {
    return analyzedMetrics.textMetrics?.byTopic?.[topicId]?.brandMetrics ?? {};
  }

  const topicPlatforms = byTopicByPlatform[topicId];
  const merged: Record<string, { mentionRate: number; firstMentionRate: number; avgMentionCount: number; totalMentions: number }> = {};
  let totalResponses = 0;

  for (const platform of selectedPlatforms) {
    const platformData = topicPlatforms[platform];
    if (!platformData) continue;
    totalResponses += platformData.totalResponses;

    for (const [brand, metrics] of Object.entries(platformData.brandMetrics as Record<string, any>)) {
      if (!merged[brand]) {
        merged[brand] = { mentionRate: 0, firstMentionRate: 0, avgMentionCount: 0, totalMentions: 0 };
      }
      merged[brand].mentionRate += metrics.mentionRate * platformData.totalResponses;
      merged[brand].firstMentionRate += metrics.firstMentionRate * platformData.totalResponses;
      merged[brand].avgMentionCount += metrics.avgMentionCount * platformData.totalResponses;
      merged[brand].totalMentions += metrics.totalMentions;
    }
  }

  if (totalResponses > 0) {
    for (const brand of Object.keys(merged)) {
      merged[brand].mentionRate /= totalResponses;
      merged[brand].firstMentionRate /= totalResponses;
      merged[brand].avgMentionCount /= totalResponses;
    }
  }

  return merged;
}
