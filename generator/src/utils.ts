import {
  INTENT_STAGES,
  ISOTOPES,
  type ArchetypeTemplate,
  type FlatPrompt,
  type IntentStage,
  type Isotope,
  type RunTier,
} from './types.js';
import { minPerCellForTier } from './generate.js';

const DEDUP_JACCARD_THRESHOLD = 0.85;
const COVERAGE_BIAS_TOLERANCE = 0.10;

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Deduplicate prompts by Jaccard similarity of their filled prompt text.
 * Checks across all intent+isotope combinations (no same-cell-only shortcut).
 * Returns a new list preserving order; drops later duplicates.
 */
export function dedupePrompts(prompts: FlatPrompt[], threshold = DEDUP_JACCARD_THRESHOLD): FlatPrompt[] {
  const kept: { prompt: FlatPrompt; tokens: Set<string> }[] = [];
  for (const p of prompts) {
    const tokens = tokenize(p.promptText);
    let isDupe = false;
    for (const k of kept) {
      if (jaccard(tokens, k.tokens) >= threshold) {
        isDupe = true;
        break;
      }
    }
    if (!isDupe) kept.push({ prompt: p, tokens });
  }
  return kept.map((k) => k.prompt);
}

export interface CoverageBiasReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  intentShares: Record<IntentStage, number>;
  isotopeShares: Record<Isotope, number>;
  cellCounts: Record<string, number>;
}

/**
 * Two-axis coverage bias check.
 *
 * Rules:
 *  - No intent share exceeds (weight + COVERAGE_BIAS_TOLERANCE).
 *  - No isotope share exceeds (weight + COVERAGE_BIAS_TOLERANCE).
 *  - Every cell has at least minPerCell prompts (tier-dependent).
 *
 * In `full` tier, cell-floor violations are errors. In `quick` tier, they
 * are warnings. In `exploratory` tier, cell-floor checks are skipped.
 */
export function checkCoverageBias(
  prompts: FlatPrompt[],
  template: ArchetypeTemplate,
  tier: RunTier,
): CoverageBiasReport {
  const total = prompts.length;
  const errors: string[] = [];
  const warnings: string[] = [];

  const intentCounts: Record<IntentStage, number> = {
    learning: 0, discovery: 0, evaluation: 0, validation: 0, acquisition: 0,
  };
  const isotopeCounts: Record<Isotope, number> = {
    declarative: 0, comparative: 0, situated: 0, constrained: 0, adversarial: 0,
  };
  const cellCounts: Record<string, number> = {};

  for (const p of prompts) {
    intentCounts[p.intent_stage] += 1;
    isotopeCounts[p.isotope] += 1;
    const key = `${p.intent_stage}.${p.isotope}`;
    cellCounts[key] = (cellCounts[key] ?? 0) + 1;
  }

  const intentShares = {} as Record<IntentStage, number>;
  const isotopeShares = {} as Record<Isotope, number>;

  if (total === 0) {
    errors.push('no prompts generated');
    return { ok: false, errors, warnings, intentShares, isotopeShares, cellCounts };
  }

  for (const intent of INTENT_STAGES) {
    const share = intentCounts[intent] / total;
    intentShares[intent] = share;
    const max = template.weights.intents[intent] + COVERAGE_BIAS_TOLERANCE;
    if (share > max) {
      errors.push(
        `intent '${intent}' share ${share.toFixed(3)} exceeds weight+${COVERAGE_BIAS_TOLERANCE} (${max.toFixed(3)})`,
      );
    }
  }
  for (const iso of ISOTOPES) {
    const share = isotopeCounts[iso] / total;
    isotopeShares[iso] = share;
    const max = template.weights.isotopes[iso] + COVERAGE_BIAS_TOLERANCE;
    if (share > max) {
      errors.push(
        `isotope '${iso}' share ${share.toFixed(3)} exceeds weight+${COVERAGE_BIAS_TOLERANCE} (${max.toFixed(3)})`,
      );
    }
  }

  const minPerCell = minPerCellForTier(tier);
  if (minPerCell > 0) {
    for (const intent of INTENT_STAGES) {
      for (const iso of ISOTOPES) {
        const key = `${intent}.${iso}`;
        const count = cellCounts[key] ?? 0;
        if (count < minPerCell) {
          const msg = `cell ${key} has ${count} prompt(s), below minPerCell=${minPerCell}`;
          if (tier === 'full') errors.push(msg);
          else warnings.push(msg);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    intentShares,
    isotopeShares,
    cellCounts,
  };
}
