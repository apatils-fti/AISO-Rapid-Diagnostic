export const INTENT_STAGES = [
  'learning',
  'discovery',
  'evaluation',
  'validation',
  'acquisition',
] as const;

export const ISOTOPES = [
  'declarative',
  'comparative',
  'situated',
  'constrained',
  'adversarial',
] as const;

export type IntentStage = (typeof INTENT_STAGES)[number];
export type Isotope = (typeof ISOTOPES)[number];

export interface IntentWeights {
  learning: number;
  discovery: number;
  evaluation: number;
  validation: number;
  acquisition: number;
}

export interface IsotopeWeights {
  declarative: number;
  comparative: number;
  situated: number;
  constrained: number;
  adversarial: number;
}

export type SeedMatrix = Record<IntentStage, Record<Isotope, string[]>>;

export interface ArchetypeMeta {
  id: string;
  name: string;
  description: string;
  sectors: string[];
  primaryFocus: string[];
  promptEmphasis: string;
}

export interface ArchetypeTemplate {
  archetype: ArchetypeMeta;
  weights: {
    intents: IntentWeights;
    isotopes: IsotopeWeights;
  };
  minPromptCount: number;
  quickRunMinimum: number;
  seeds: SeedMatrix;
}

export interface FlatPrompt {
  promptId: string;
  topicId: string;
  topicName: string;
  category: string;
  promptText: string;
  isotope: Isotope;
  intent_stage: IntentStage;
}

export type RunTier = 'full' | 'quick' | 'exploratory';

export interface GenerationResult {
  prompts: FlatPrompt[];
  tier: RunTier;
  warnings: string[];
  stats: {
    totalPrompts: number;
    intentDistribution: Record<IntentStage, number>;
    isotopeDistribution: Record<Isotope, number>;
    cellCounts: Record<string, number>;
  };
}

export interface Topic {
  id: string;
  name: string;
  category: string;
}

export interface ExpandedSubtopic extends Topic {
  primaryIntent: IntentStage;
}

export interface GenerateOptions {
  template: ArchetypeTemplate;
  topics: Topic[];
  targetPromptCount: number;
  brand: string;
  competitor: string;
  personas: string[];
  attributes: string[];
  pricePoints: string[];
  contexts: string[];
}
