/**
 * Isotope taxonomy — the canonical list of prompt intent types the pipeline
 * produces, plus their display labels and short descriptions.
 *
 * Lifted out of `lib/fixtures.ts` so consumers can pull these constants
 * without dragging the 160KB J.Crew analyzedMetrics.json snapshot into
 * their import graph. Pure presentation data; no client-specific content.
 */

import type { IsotopeType } from './types';

export const ISOTOPE_TYPES: IsotopeType[] = [
  'informational',
  'commercial',
  'comparative',
  'persona',
  'specific',
  'conversational',
];

export const ISOTOPE_LABELS: Record<IsotopeType, string> = {
  informational: 'Informational',
  commercial: 'Commercial',
  comparative: 'Comparative',
  persona: 'Persona',
  specific: 'Specific',
  conversational: 'Conversational',
};

export const ISOTOPE_DESCRIPTIONS: Record<IsotopeType, string> = {
  informational: 'Educational queries asking "What is X?"',
  commercial: 'Buying intent queries like "Best X tools"',
  comparative: 'Head-to-head queries like "X vs Y vs Z"',
  persona: 'Role-based queries like "As a [role], what should I use?"',
  specific: 'Narrow, detailed queries with multiple requirements',
  conversational: 'Natural, casual phrasing like real user questions',
};
