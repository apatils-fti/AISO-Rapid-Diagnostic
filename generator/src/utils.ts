import {
  INTENT_STAGES,
  ISOTOPES,
  type ArchetypeTemplate,
  type FlatPrompt,
  type IntentStage,
  type Isotope,
  type RunTier,
} from './types.js';

const DEDUP_JACCARD_THRESHOLD = 0.85;
const FLAT_EXPECTED_SHARE = 0.20;      // 1/5 per intent, 1/5 per isotope
const COVERAGE_BIAS_TOLERANCE = 0.03;  // flag when share exceeds 0.23 (accommodates rounding noise)

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
 * Two-axis coverage bias check — flat allocation version.
 *
 * Rules:
 *  - No intent share exceeds 0.22 (flat expected is 0.20).
 *  - No isotope share exceeds 0.22.
 *  - Flat invariant: max(cells) - min(cells) <= 1.
 *
 * In `full` tier, flat-invariant violations are errors. In `quick` tier
 * they are warnings. In `exploratory` tier the invariant is skipped.
 */
export function checkCoverageBias(
  prompts: FlatPrompt[],
  _template: ArchetypeTemplate,
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

  const maxShare = FLAT_EXPECTED_SHARE + COVERAGE_BIAS_TOLERANCE;

  for (const intent of INTENT_STAGES) {
    const share = intentCounts[intent] / total;
    intentShares[intent] = share;
    if (share > maxShare) {
      errors.push(
        `intent '${intent}' share ${share.toFixed(3)} exceeds flat threshold ${maxShare.toFixed(3)}`,
      );
    }
  }
  for (const iso of ISOTOPES) {
    const share = isotopeCounts[iso] / total;
    isotopeShares[iso] = share;
    if (share > maxShare) {
      errors.push(
        `isotope '${iso}' share ${share.toFixed(3)} exceeds flat threshold ${maxShare.toFixed(3)}`,
      );
    }
  }

  // Flat invariant: every cell count within 1 of every other cell.
  if (tier !== 'exploratory') {
    const allCellCounts = INTENT_STAGES.flatMap((intent) =>
      ISOTOPES.map((iso) => cellCounts[`${intent}.${iso}`] ?? 0),
    );
    const minCell = Math.min(...allCellCounts);
    const maxCell = Math.max(...allCellCounts);
    if (maxCell - minCell > 1) {
      const msg = `flat invariant violated: cell counts range from ${minCell} to ${maxCell} (expected max-min <= 1)`;
      if (tier === 'full') errors.push(msg);
      else warnings.push(msg);
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
