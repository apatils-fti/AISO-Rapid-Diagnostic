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
 * Pick the run tier given a target prompt count and template floors.
 *
 *   target >= minPromptCount        → full
 *   target >= quickRunMinimum       → quick
 *   otherwise                       → exploratory
 */
export function pickTier(target: number, template: ArchetypeTemplate): RunTier {
  if (target >= template.minPromptCount) return 'full';
  if (target >= template.quickRunMinimum) return 'quick';
  return 'exploratory';
}

export function minPerCellForTier(tier: RunTier): number {
  if (tier === 'full') return 2;
  if (tier === 'quick') return 1;
  return 0;
}

/**
 * Ceiling-based stratified allocation.
 *
 *   count(cell) = max(ceil(intent_w × isotope_w × target), minPerCell)
 *
 * Over-quota cells are trimmed from the largest cell first (never below
 * minPerCell) until the total hits the target. If the sum is still below
 * target after the floor pass, excess is distributed to the largest-weight
 * cells.
 */
export function allocateCells(
  template: ArchetypeTemplate,
  target: number,
  tier: RunTier,
): Record<IntentStage, Record<Isotope, number>> {
  const minPerCell = minPerCellForTier(tier);
  const counts: Record<IntentStage, Record<Isotope, number>> = {} as Record<
    IntentStage,
    Record<Isotope, number>
  >;

  for (const intent of INTENT_STAGES) {
    const row: Record<Isotope, number> = {} as Record<Isotope, number>;
    for (const iso of ISOTOPES) {
      const w = template.weights.intents[intent] * template.weights.isotopes[iso];
      row[iso] = Math.max(Math.ceil(w * target), minPerCell);
    }
    counts[intent] = row;
  }

  let total = sumCells(counts);

  // Trim over-quota from the largest cells until we hit target.
  while (total > target) {
    const largest = findLargestCell(counts, minPerCell);
    if (!largest) break;
    counts[largest.intent][largest.iso] -= 1;
    total -= 1;
  }

  // Top up from highest-weight cells if under target.
  while (total < target) {
    const highest = findHighestWeightCell(template, counts);
    if (!highest) break;
    counts[highest.intent][highest.iso] += 1;
    total += 1;
  }

  return counts;
}

function sumCells(counts: Record<IntentStage, Record<Isotope, number>>): number {
  let total = 0;
  for (const intent of INTENT_STAGES) {
    for (const iso of ISOTOPES) {
      total += counts[intent][iso];
    }
  }
  return total;
}

function findLargestCell(
  counts: Record<IntentStage, Record<Isotope, number>>,
  floor: number,
): { intent: IntentStage; iso: Isotope } | null {
  let best: { intent: IntentStage; iso: Isotope } | null = null;
  let bestVal = floor;
  for (const intent of INTENT_STAGES) {
    for (const iso of ISOTOPES) {
      const v = counts[intent][iso];
      if (v > bestVal) {
        bestVal = v;
        best = { intent, iso };
      }
    }
  }
  return best;
}

function findHighestWeightCell(
  template: ArchetypeTemplate,
  counts: Record<IntentStage, Record<Isotope, number>>,
): { intent: IntentStage; iso: Isotope } | null {
  let best: { intent: IntentStage; iso: Isotope } | null = null;
  let bestW = -1;
  for (const intent of INTENT_STAGES) {
    for (const iso of ISOTOPES) {
      const w = template.weights.intents[intent] * template.weights.isotopes[iso];
      const tieBreaker = counts[intent][iso] / 1000;
      if (w + tieBreaker > bestW) {
        bestW = w + tieBreaker;
        best = { intent, iso };
      }
    }
  }
  return best;
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

  const tier = pickTier(targetPromptCount, template);
  const warnings: string[] = [];
  if (tier === 'exploratory') {
    warnings.push(
      `targetPromptCount=${targetPromptCount} below quickRunMinimum=${template.quickRunMinimum} — output labeled exploratory, no coverage claim`,
    );
  } else if (tier === 'quick') {
    warnings.push(
      `targetPromptCount=${targetPromptCount} below minPromptCount=${template.minPromptCount} — output labeled indicative, rare cells may have only 1 prompt`,
    );
  }

  const cellCounts = allocateCells(template, targetPromptCount, tier);
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
