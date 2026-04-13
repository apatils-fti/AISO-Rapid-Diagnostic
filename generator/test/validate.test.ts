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

describe('validate: weight sum enforcement', () => {
  it('rejects intent weights summing to 0.99', () => {
    const raw = loadTemplate('transactional-commerce');
    raw.weights.intents.learning = 0.09; // was 0.10
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('intent weights must sum'))).toBe(true);
    }
  });

  it('rejects isotope weights summing to 1.02', () => {
    const raw = loadTemplate('transactional-commerce');
    raw.weights.isotopes.declarative = 0.27; // was 0.25
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('isotope weights must sum'))).toBe(true);
    }
  });

  it('accepts intent weights within 0.001 tolerance', () => {
    const raw = loadTemplate('transactional-commerce');
    raw.weights.intents.learning = 0.1005;
    raw.weights.intents.discovery = 0.2495;
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

describe('validate: minPromptCount sanity', () => {
  it('rejects minPromptCount below the computed floor', () => {
    const raw = loadTemplate('trust-based-advisory');
    raw.minPromptCount = 50; // nowhere near 267
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('below computed floor'))).toBe(true);
    }
  });

  it('rejects quickRunMinimum >= minPromptCount', () => {
    const raw = loadTemplate('transactional-commerce');
    raw.quickRunMinimum = 200;
    raw.minPromptCount = 200;
    const r = safeParseTemplate(raw);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes('strictly less than'))).toBe(true);
    }
  });
});
