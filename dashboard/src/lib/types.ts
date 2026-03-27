// Client Configuration Types
export interface Competitor {
  name: string;
  domains: string[];
}

export interface ClientConfig {
  clientName: string;
  clientDomains: string[];
  industry: string;
  competitors: Competitor[];
  runDate: string;
  platforms: string[];
  futurePlatforms: string[];
}

// Prompt Library Types
export type IsotopeType = 'informational' | 'commercial' | 'comparative' | 'persona' | 'specific' | 'conversational';

export interface Prompt {
  id: string;
  text: string;
  isotope: IsotopeType;
  topic: string;
}

export interface Topic {
  id: string;
  name: string;
  category: string;
  prompts: Prompt[];
}

export interface PromptLibrary {
  topics: Topic[];
}

// Analyzed Metrics Types
export interface IsotopeResult {
  cited: boolean;
  citationCount: number;
  avgPosition: number | null;
  consistency: number;
  runs: number;
  runsWithCitation: number;
  competitorCitations: Record<string, number>;
}

export interface ParametricPresence {
  mentioned: boolean;
  mentionRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  position: 'primary' | 'secondary' | 'mentioned' | 'absent';
}

export interface TopicResult {
  topicId: string;
  topicName: string;
  category: string;
  overallScore: number;
  isotopeResults: Record<IsotopeType, IsotopeResult>;
  robustnessScore: number;
  parametricPresence: ParametricPresence;
}

export interface PlatformBreakdown {
  citationShare?: number;
  promptsCited?: number;
  totalPrompts?: number;
  avgCitationPosition?: number;
  available: boolean;
  comingSoon?: boolean;
}

export interface Summary {
  overallScore: number;
  totalPrompts: number;
  totalCitations: number;
  clientCitations: number;
  citationShare: number;
  parametricMentionRate: number;
  ragCitationRate: number;
  topCompetitor: {
    name: string;
    citationShare: number;
  };
  platformBreakdown: Record<string, PlatformBreakdown>;
}

export interface CompetitorOverview {
  name: string;
  isClient: boolean;
  overallCitationShare: number;
  topicShares: Record<string, number>;
  strongestTopics: string[];
  weakestTopics: string[];
  avgCitationPosition: number;
  parametricMentionRate: number;
}

export interface GapAnalysis {
  quadrant: string;
  parametricScore: number;
  ragScore: number;
  insight: string;
  recommendations: string[];
}

export interface AnalyzedMetrics {
  summary: Summary;
  topicResults: TopicResult[];
  competitorOverview: CompetitorOverview[];
  gapAnalysis: GapAnalysis;
}

// Raw Results Types
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ResponseAnalysis {
  clientCited: boolean;
  clientMentionedInText: boolean;
  competitorsCited: string[];
  totalCitations: number;
}

export interface RawResultResponse {
  text: string;
  citations: string[];
  searchResults: SearchResult[];
}

export interface RawResult {
  promptId: string;
  platform: string;
  model: string;
  runId: number;
  timestamp: string;
  response: RawResultResponse;
  analysis: ResponseAnalysis;
}

export interface RawResults {
  results: RawResult[];
}

// UI Types
export type CitationStatus = 'cited' | 'not-cited' | 'intermittent';

export interface OpportunityGap {
  topic: string;
  topicId: string;
  isotope: IsotopeType;
  dominantCompetitor: string;
  competitorShare: number;
  clientShare: number;
  insight: string;
}
