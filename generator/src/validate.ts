import { z } from 'zod';
import {
  INTENT_STAGES,
  ISOTOPES,
  type ArchetypeTemplate,
  type IntentStage,
  type Isotope,
} from './types.js';

const WEIGHT_SUM_TOLERANCE = 0.001;
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

export const archetypeTemplateSchema = z
  .object({
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
    }),
    minPromptCount: z.number().int().positive(),
    quickRunMinimum: z.number().int().positive(),
    seeds: seedMatrixSchema,
  })
  .superRefine((template, ctx) => {
    const intentSum = Object.values(template.weights.intents).reduce((a, b) => a + b, 0);
    if (Math.abs(intentSum - 1) > WEIGHT_SUM_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weights', 'intents'],
        message: `intent weights must sum to 1.0 (got ${intentSum.toFixed(4)})`,
      });
    }

    const isotopeSum = Object.values(template.weights.isotopes).reduce((a, b) => a + b, 0);
    if (Math.abs(isotopeSum - 1) > WEIGHT_SUM_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weights', 'isotopes'],
        message: `isotope weights must sum to 1.0 (got ${isotopeSum.toFixed(4)})`,
      });
    }

    if (template.quickRunMinimum >= template.minPromptCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quickRunMinimum'],
        message: 'quickRunMinimum must be strictly less than minPromptCount',
      });
    }

    const minIntent = Math.min(...Object.values(template.weights.intents));
    const minIsotope = Math.min(...Object.values(template.weights.isotopes));
    const expectedMin = Math.ceil(2 / (minIntent * minIsotope));
    if (template.minPromptCount < expectedMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minPromptCount'],
        message: `minPromptCount (${template.minPromptCount}) is below computed floor ${expectedMin} for these weights`,
      });
    }
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
