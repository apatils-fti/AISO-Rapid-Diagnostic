/**
 * Isotope taxonomy — the 5 question-style buckets the prompt generator
 * produces. Plus display labels (full + short) and short descriptions.
 *
 * Pure presentation data; no client-specific content. lib/metrics.ts holds
 * a parallel `LEGACY_ISOTOPE_MAP` that normalises pre-migration values from
 * the old 6-isotope taxonomy (informational/commercial/persona/specific/
 * conversational + comparative) so historical FTI/J.Crew rows still
 * aggregate correctly. UI components read from this file, not metrics.ts.
 */

import type { IsotopeType } from './types';

export const ISOTOPE_TYPES: IsotopeType[] = [
  'declarative',
  'comparative',
  'situated',
  'constrained',
  'adversarial',
];

export const ISOTOPE_LABELS: Record<IsotopeType, string> = {
  declarative: 'Declarative',
  comparative: 'Comparative',
  situated: 'Situated',
  constrained: 'Constrained',
  adversarial: 'Adversarial',
};

/**
 * 3-letter abbreviations for tight column headers (the heatmap on /topics).
 * Hand-picked rather than `.slice(0, 4)` because "Situated" and
 * "Constrained" don't truncate cleanly to 4 chars ("Situ" / "Cons" read as
 * unfinished words; "Sit" / "Con" read cleanly as abbreviations).
 */
export const ISOTOPE_SHORT_LABELS: Record<IsotopeType, string> = {
  declarative: 'Decl',
  comparative: 'Comp',
  situated: 'Sit',
  constrained: 'Con',
  adversarial: 'Adv',
};

export const ISOTOPE_DESCRIPTIONS: Record<IsotopeType, string> = {
  declarative: 'Direct questions like "What is X?" or "What does X do?"',
  comparative: 'Head-to-head comparisons: "X vs Y", "Build vs buy"',
  situated: 'Role- or scenario-based: "As a [role], how should I…"',
  constrained: 'Queries with explicit requirements, budgets, or limits',
  adversarial: 'Skeptical or challenge questions: "Is X really worth it?"',
};
