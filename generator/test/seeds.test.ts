import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTemplate } from '../src/validate.js';
import { INTENT_STAGES, ISOTOPES } from '../src/types.js';

const ARCHETYPES = [
  'transactional-commerce',
  'trust-based-advisory',
  'b2b',
  'digital-media',
  'local-experiences',
];

function load(name: string) {
  const path = resolve(__dirname, '..', 'templates', `${name}.json`);
  return parseTemplate(JSON.parse(readFileSync(path, 'utf8')));
}

describe('seeds: structural sanity across all archetypes', () => {
  for (const name of ARCHETYPES) {
    it(`${name}: every cell has exactly 5 seeds`, () => {
      const t = load(name);
      for (const intent of INTENT_STAGES) {
        for (const iso of ISOTOPES) {
          const cell = t.seeds[intent][iso];
          expect(cell.length).toBe(5);
          for (const seed of cell) {
            expect(typeof seed).toBe('string');
            expect(seed.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it(`${name}: no seed string duplicated across cells within one archetype`, () => {
      const t = load(name);
      const seen = new Map<string, string>();
      for (const intent of INTENT_STAGES) {
        for (const iso of ISOTOPES) {
          for (const seed of t.seeds[intent][iso]) {
            const prior = seen.get(seed);
            if (prior) {
              throw new Error(`duplicate seed in ${name}: "${seed}" appears in ${prior} and ${intent}.${iso}`);
            }
            seen.set(seed, `${intent}.${iso}`);
          }
        }
      }
    });

    it(`${name}: weights sum to 1.0`, () => {
      const t = load(name);
      const iSum = Object.values(t.weights.intents).reduce((a, b) => a + b, 0);
      const isoSum = Object.values(t.weights.isotopes).reduce((a, b) => a + b, 0);
      expect(Math.abs(iSum - 1)).toBeLessThan(0.001);
      expect(Math.abs(isoSum - 1)).toBeLessThan(0.001);
    });

    it(`${name}: minPromptCount and quickRunMinimum present and consistent`, () => {
      const t = load(name);
      expect(t.minPromptCount).toBeGreaterThan(0);
      expect(t.quickRunMinimum).toBeGreaterThan(0);
      expect(t.quickRunMinimum).toBeLessThan(t.minPromptCount);
    });
  }
});

describe('seeds: variable vocabulary sanity', () => {
  it('uses only known variable names', () => {
    const known = new Set([
      'brand', 'competitor', 'persona', 'topicName', 'category',
      'pricePoint', 'context', 'attribute1', 'attribute2', 'current_year',
    ]);
    const varRe = /\{(\w+)\}/g;
    for (const name of ARCHETYPES) {
      const t = load(name);
      for (const intent of INTENT_STAGES) {
        for (const iso of ISOTOPES) {
          for (const seed of t.seeds[intent][iso]) {
            let m: RegExpExecArray | null;
            while ((m = varRe.exec(seed)) !== null) {
              const v = m[1]!;
              if (!known.has(v)) {
                throw new Error(`${name} ${intent}.${iso}: unknown variable {${v}} in "${seed}"`);
              }
            }
          }
        }
      }
    }
  });
});
