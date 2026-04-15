import { z } from 'zod';
import {
  INTENT_STAGES,
  ISOTOPES,
  type ArchetypeTemplate,
  type IntentStage,
  type Isotope,
} from './types.js';

const MIN_SEEDS_PER_CELL = 3;

const intentWeightsSchema = z.object({
  learning: z.number().min(0).max(1),
  discovery: z.number().min(0).max(1),
  evaluation: z.number().min(0).max(1),
  validation: z.number().min(0).max(1),
  acquisition: z.number().min(0).max(1),
});

const isotopeWeightsSchema = z.object({
  declarative: z.number().min(0).max(1),
  comparative: z.number().min(0).max(1),
  situated: z.number().min(0).max(1),
  constrained: z.number().min(0).max(1),
  adversarial: z.number().min(0).max(1),
});

const isotopeSeedsSchema = z.object({
  declarative: z.array(z.string().min(1)).min(MIN_SEEDS_PER_CELL),
  comparative: z.array(z.string().min(1)).min(MIN_SEEDS_PER_CELL),
  situated: z.array(z.string().min(1)).min(MIN_SEEDS_PER_CELL),
  constrained: z.array(z.string().min(1)).min(MIN_SEEDS_PER_CELL),
  adversarial: z.array(z.string().min(1)).min(MIN_SEEDS_PER_CELL),
});

const seedMatrixSchema = z.object({
  learning: isotopeSeedsSchema,
  discovery: isotopeSeedsSchema,
  evaluation: isotopeSeedsSchema,
  validation: isotopeSeedsSchema,
  acquisition: isotopeSeedsSchema,
});

/**
 * Archetype template schema — flat allocation version.
 *
 * Weights are stored but inactive by default (`weightsActive: false`).
 * Allocation is flat: every cell gets `ceil(target / 25)` prompts, then
 * trimmed randomly to match the target. No weight-sum enforcement, no
 * minPromptCount/quickRunMinimum floors — those were vestiges of the
 * weighted allocation model.
 */
export const archetypeTemplateSchema = z.object({
  archetype: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    sectors: z.array(z.string()).min(1),
    primaryFocus: z.array(z.string()).min(1),
    promptEmphasis: z.string().min(1),
  }),
  weights: z.object({
    intents: intentWeightsSchema,
    isotopes: isotopeWeightsSchema,
    weightsActive: z.boolean().optional().default(false),
  }),
  seeds: seedMatrixSchema,
});

export function parseTemplate(raw: unknown): ArchetypeTemplate {
  return archetypeTemplateSchema.parse(raw) as ArchetypeTemplate;
}

export function safeParseTemplate(raw: unknown) {
  return archetypeTemplateSchema.safeParse(raw);
}

export function assertAllCellsPresent(template: ArchetypeTemplate): void {
  for (const intent of INTENT_STAGES) {
    const row = template.seeds[intent as IntentStage];
    if (!row) throw new Error(`missing intent row: ${intent}`);
    for (const iso of ISOTOPES) {
      const cell = row[iso as Isotope];
      if (!cell || cell.length < MIN_SEEDS_PER_CELL) {
        throw new Error(`cell ${intent}.${iso} has fewer than ${MIN_SEEDS_PER_CELL} seeds`);
      }
    }
  }
}
