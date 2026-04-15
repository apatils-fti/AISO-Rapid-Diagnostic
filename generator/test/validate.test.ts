import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { safeParseTemplate, parseTemplate, assertAllCellsPresent } from '../src/validate.js';

function loadTemplate(name: string) {
  const path = resolve(__dirname, '..', 'templates', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

const ARCHETYPES = [
  'transactional-commerce',
  'trust-based-advisory',
  'b2b',
  'digital-media',
  'local-experiences',
];

describe('validate: real archetype templates', () => {
  for (const name of ARCHETYPES) {
    it(`parses ${name}.json`, () => {
      const raw = loadTemplate(name);
      const result = safeParseTemplate(raw);
      if (!result.success) {
        throw new Error(`${name} failed: ${JSON.stringify(result.error.issues, null, 2)}`);
      }
      expect(result.success).toBe(true);
    });

    it(`${name}: all 25 cells populated`, () => {
      const raw = loadTemplate(name);
      const template = parseTemplate(raw);
      expect(() => assertAllCellsPresent(template)).not.toThrow();
    });
  }
});

describe('validate: weightsActive field', () => {
  it('weightsActive=false passes', () => {
    const raw = loadTemplate('transactional-commerce');
    raw.weights.weightsActive = false;
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(true);
  });

  it('weightsActive=true passes (weights stored, just inactive)', () => {
    const raw = loadTemplate('transactional-commerce');
    raw.weights.weightsActive = true;
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(true);
  });

  it('omitted weightsActive defaults to false', () => {
    const raw = loadTemplate('transactional-commerce');
    delete raw.weights.weightsActive;
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.weights.weightsActive).toBe(false);
    }
  });
});

describe('validate: weight values are no longer constrained by sum', () => {
  it('accepts intent weights that do not sum to 1.0 (weights are inactive)', () => {
    const raw = loadTemplate('transactional-commerce');
    raw.weights.intents.learning = 0.99; // wildly wrong sum
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(true);
  });

  it('accepts isotope weights that do not sum to 1.0', () => {
    const raw = loadTemplate('transactional-commerce');
    raw.weights.isotopes.declarative = 0.01;
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(true);
  });
});

describe('validate: seed floor', () => {
  it('rejects a cell with only 2 seeds', () => {
    const raw = loadTemplate('transactional-commerce');
    raw.seeds.learning.declarative = raw.seeds.learning.declarative.slice(0, 2);
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(false);
  });

  it('rejects a missing cell', () => {
    const raw = loadTemplate('transactional-commerce');
    delete raw.seeds.learning.adversarial;
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(false);
  });
});

describe('validate: minPromptCount/quickRunMinimum removed from schema', () => {
  it('templates no longer carry minPromptCount', () => {
    for (const name of ARCHETYPES) {
      const raw = loadTemplate(name);
      expect(raw.minPromptCount, `${name}`).toBeUndefined();
    }
  });

  it('templates no longer carry quickRunMinimum', () => {
    for (const name of ARCHETYPES) {
      const raw = loadTemplate(name);
      expect(raw.quickRunMinimum, `${name}`).toBeUndefined();
    }
  });

  it('extra minPromptCount field is silently dropped by strip()', () => {
    // Zod strips unknown keys by default, so a rogue field doesn't break parsing.
    const raw = loadTemplate('transactional-commerce');
    raw.minPromptCount = 999;
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as any).minPromptCount).toBeUndefined();
    }
  });
});
