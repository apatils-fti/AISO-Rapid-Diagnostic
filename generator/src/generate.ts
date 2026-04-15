import {
  INTENT_STAGES,
  ISOTOPES,
  type ArchetypeTemplate,
  type FlatPrompt,
  type GenerateOptions,
  type GenerationResult,
  type IntentStage,
  type Isotope,
  type RunTier,
  type Topic,
} from './types.js';
import { tagTopicsWithPrimaryIntent } from './expand.js';

/**
 * Pick the run tier from targetPromptCount using uniform flat thresholds.
 * Same thresholds for every archetype — weights are stored in templates
 * but do not drive allocation.
 *
 *   target >= 250  → full       (10 per cell before trim)
 *   target >= 125  → quick      (5 per cell before trim)
 *   otherwise      → exploratory (ceil(target/25) per cell)
 */
export function pickTier(target: number): RunTier {
  if (target >= 250) return 'full';
  if (target >= 125) return 'quick';
  return 'exploratory';
}

/**
 * Flat allocation: every cell in the 5×5 matrix gets exactly ceil(target/25)
 * prompts, then excess is trimmed from random cells until the total equals
 * target. Cells never drop below 1 for targets ≥ 25.
 *
 * Weights are deliberately ignored. The flat invariant is
 *   max(cells) - min(cells) <= 1
 * which is enforced downstream by checkCoverageBias.
 */
export function allocateCells(
  target: number,
): Record<IntentStage, Record<Isotope, number>> {
  const base = Math.ceil(target / 25);
  const counts = {} as Record<IntentStage, Record<Isotope, number>>;
  for (const intent of INTENT_STAGES) {
    const row = {} as Record<Isotope, number>;
    for (const iso of ISOTOPES) row[iso] = base;
    counts[intent] = row;
  }

  let total = 25 * base;
  if (total <= target) return counts;

  const cells: Array<[IntentStage, Isotope]> = [];
  for (const intent of INTENT_STAGES) {
    for (const iso of ISOTOPES) cells.push([intent, iso]);
  }
  // Fisher-Yates shuffle so trim is uniformly random across cells.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = cells[i]!;
    cells[i] = cells[j]!;
    cells[j] = tmp;
  }

  let cursor = 0;
  const guard = cells.length * base;
  while (total > target) {
    const [intent, iso] = cells[cursor % cells.length]!;
    if (counts[intent][iso] > 1) {
      counts[intent][iso] -= 1;
      total -= 1;
    }
    cursor += 1;
    if (cursor > guard) break;
  }

  return counts;
}

/**
 * Fill a template string with variable values. Missing variables are left
 * as-is so downstream consumers can see what's missing.
 */
export function fillSeed(seed: string, vars: Record<string, string>): string {
  return seed.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

function pickFrom<T>(arr: T[], index: number): T {
  const item = arr[index % arr.length];
  if (item === undefined) throw new Error('cannot pick from empty array');
  return item;
}

export function generate(opts: GenerateOptions): GenerationResult {
  const { template, topics, targetPromptCount, brand, competitor, personas, attributes, pricePoints, contexts } = opts;

  if (topics.length === 0) {
    throw new Error('at least one topic is required');
  }

  const tier = pickTier(targetPromptCount);
  const warnings: string[] = [];
  if (tier === 'exploratory') {
    warnings.push(
      `targetPromptCount=${targetPromptCount} below 125 — output labeled exploratory, no coverage claim`,
    );
  } else if (tier === 'quick') {
    warnings.push(
      `targetPromptCount=${targetPromptCount} below 250 — output labeled indicative`,
    );
  }

  const cellCounts = allocateCells(targetPromptCount);
  const tagged = tagTopicsWithPrimaryIntent(topics, template);

  const prompts: FlatPrompt[] = [];
  let promptCounter = 0;
  const intentDistribution: Record<IntentStage, number> = {
    learning: 0, discovery: 0, evaluation: 0, validation: 0, acquisition: 0,
  };
  const isotopeDistribution: Record<Isotope, number> = {
    declarative: 0, comparative: 0, situated: 0, constrained: 0, adversarial: 0,
  };
  const flatCellCounts: Record<string, number> = {};

  for (const intent of INTENT_STAGES) {
    for (const iso of ISOTOPES) {
      const cellTarget = cellCounts[intent][iso];
      if (cellTarget === 0) continue;

      const matchingTopics = tagged.filter((t) => t.primaryIntent === intent);
      const topicPool: Topic[] = matchingTopics.length > 0 ? matchingTopics : tagged;

      const seeds = template.seeds[intent][iso];

      for (let i = 0; i < cellTarget; i++) {
        const topic = pickFrom(topicPool, i);
        const seed = pickFrom(seeds, i);
        const persona = pickFrom(personas, promptCounter);
        const attribute1 = pickFrom(attributes, promptCounter);
        const attribute2 = pickFrom(attributes, promptCounter + 1);
        const pricePoint = pickFrom(pricePoints, promptCounter);
        const context = pickFrom(contexts, promptCounter);

        const filled = fillSeed(seed, {
          brand,
          competitor,
          persona,
          topicName: topic.name,
          category: topic.category,
          pricePoint,
          context,
          attribute1,
          attribute2,
          current_year: String(new Date().getFullYear()),
        });

        const prompt: FlatPrompt = {
          promptId: `${template.archetype.id}-${intent}-${iso}-${promptCounter}`,
          topicId: topic.id,
          topicName: topic.name,
          category: topic.category,
          promptText: filled,
          isotope: iso,
          intent_stage: intent,
        };
        prompts.push(prompt);
        intentDistribution[intent] += 1;
        isotopeDistribution[iso] += 1;
        flatCellCounts[`${intent}.${iso}`] = (flatCellCounts[`${intent}.${iso}`] ?? 0) + 1;
        promptCounter += 1;
      }
    }
  }

  return {
    prompts,
    tier,
    warnings,
    stats: {
      totalPrompts: prompts.length,
      intentDistribution,
      isotopeDistribution,
      cellCounts: flatCellCounts,
    },
  };
}
