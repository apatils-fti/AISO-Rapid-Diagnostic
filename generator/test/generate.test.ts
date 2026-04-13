import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTemplate } from '../src/validate.js';
import { generate, pickTier, allocateCells, fillSeed, minPerCellForTier } from '../src/generate.js';
import { INTENT_STAGES, ISOTOPES, type GenerateOptions, type Topic } from '../src/types.js';

function loadTemplate(name: string) {
  const path = resolve(__dirname, '..', 'templates', `${name}.json`);
  return parseTemplate(JSON.parse(readFileSync(path, 'utf8')));
}

const TOPICS: Topic[] = [
  { id: 't1', name: 'cashmere sweaters', category: 'sweaters' },
  { id: 't2', name: 'chino pants', category: 'pants' },
  { id: 't3', name: 'oxford shirts', category: 'shirts' },
  { id: 't4', name: 'wool overcoats', category: 'outerwear' },
  { id: 't5', name: 'leather belts', category: 'accessories' },
];

function defaultOpts(targetPromptCount: number, archetype = 'transactional-commerce'): GenerateOptions {
  return {
    template: loadTemplate(archetype),
    topics: TOPICS,
    targetPromptCount,
    brand: 'J.Crew',
    competitor: 'Banana Republic',
    personas: ['office worker', 'new parent', 'college student', 'retiree'],
    attributes: ['wool', 'slim fit', 'machine washable', 'organic'],
    pricePoints: ['$100', '$150', '$200'],
    contexts: ['a wedding', 'winter', 'a job interview', 'weekend'],
  };
}

describe('pickTier', () => {
  it('selects full at or above minPromptCount', () => {
    const t = loadTemplate('transactional-commerce');
    expect(pickTier(134, t)).toBe('full');
    expect(pickTier(500, t)).toBe('full');
  });

  it('selects quick between quickRunMinimum and minPromptCount', () => {
    const t = loadTemplate('transactional-commerce');
    expect(pickTier(100, t)).toBe('quick');
    expect(pickTier(67, t)).toBe('quick');
  });

  it('selects exploratory below quickRunMinimum', () => {
    const t = loadTemplate('transactional-commerce');
    expect(pickTier(50, t)).toBe('exploratory');
    expect(pickTier(10, t)).toBe('exploratory');
  });
});

describe('allocateCells', () => {
  it('respects minPerCell floor in full tier', () => {
    const t = loadTemplate('trust-based-advisory');
    const counts = allocateCells(t, 267, 'full');
    for (const intent of INTENT_STAGES) {
      for (const iso of ISOTOPES) {
        expect(counts[intent][iso]).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('total matches target (full tier)', () => {
    const t = loadTemplate('transactional-commerce');
    const counts = allocateCells(t, 200, 'full');
    let sum = 0;
    for (const intent of INTENT_STAGES) for (const iso of ISOTOPES) sum += counts[intent][iso];
    expect(sum).toBe(200);
  });

  it('quick tier uses minPerCell=1', () => {
    expect(minPerCellForTier('quick')).toBe(1);
    const t = loadTemplate('trust-based-advisory');
    const counts = allocateCells(t, 150, 'quick');
    for (const intent of INTENT_STAGES) {
      for (const iso of ISOTOPES) {
        expect(counts[intent][iso]).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('exploratory tier uses minPerCell=0', () => {
    expect(minPerCellForTier('exploratory')).toBe(0);
  });
});

describe('fillSeed', () => {
  it('substitutes variables', () => {
    const out = fillSeed('buy {brand} {topicName} for {context}', {
      brand: 'J.Crew',
      topicName: 'chinos',
      context: 'a wedding',
    });
    expect(out).toBe('buy J.Crew chinos for a wedding');
  });

  it('leaves missing variables as placeholders', () => {
    const out = fillSeed('{brand} and {unknown}', { brand: 'J.Crew' });
    expect(out).toBe('J.Crew and {unknown}');
  });
});

describe('generate: full tier distribution', () => {
  it('produces exactly targetPromptCount prompts', () => {
    const result = generate(defaultOpts(200));
    expect(result.prompts.length).toBe(200);
  });

  it('fills all 25 cells in full tier', () => {
    const result = generate(defaultOpts(200));
    const seen = new Set<string>();
    for (const p of result.prompts) seen.add(`${p.intent_stage}.${p.isotope}`);
    expect(seen.size).toBe(25);
  });

  it('intent distribution stays within (weight + 0.10)', () => {
    const result = generate(defaultOpts(200));
    const template = loadTemplate('transactional-commerce');
    const counts: Record<string, number> = {};
    for (const p of result.prompts) counts[p.intent_stage] = (counts[p.intent_stage] ?? 0) + 1;
    for (const intent of INTENT_STAGES) {
      const share = (counts[intent] ?? 0) / result.prompts.length;
      const max = template.weights.intents[intent] + 0.1;
      expect(share).toBeLessThanOrEqual(max + 0.001);
    }
  });

  it('isotope distribution stays within (weight + 0.10)', () => {
    const result = generate(defaultOpts(200));
    const template = loadTemplate('transactional-commerce');
    const counts: Record<string, number> = {};
    for (const p of result.prompts) counts[p.isotope] = (counts[p.isotope] ?? 0) + 1;
    for (const iso of ISOTOPES) {
      const share = (counts[iso] ?? 0) / result.prompts.length;
      const max = template.weights.isotopes[iso] + 0.1;
      expect(share).toBeLessThanOrEqual(max + 0.001);
    }
  });

  it('sets tier=full and no tier warnings for ≥ minPromptCount', () => {
    const result = generate(defaultOpts(200));
    expect(result.tier).toBe('full');
    expect(result.warnings.filter((w) => w.includes('exploratory') || w.includes('indicative'))).toHaveLength(0);
  });
});

describe('generate: quick tier', () => {
  it('warns that output is indicative', () => {
    const result = generate(defaultOpts(100));
    expect(result.tier).toBe('quick');
    expect(result.warnings.some((w) => w.includes('indicative'))).toBe(true);
  });
});

describe('generate: exploratory tier', () => {
  it('warns that output is exploratory', () => {
    const result = generate(defaultOpts(40));
    expect(result.tier).toBe('exploratory');
    expect(result.warnings.some((w) => w.includes('exploratory'))).toBe(true);
  });
});

describe('generate: variable filling', () => {
  it('no prompt text contains unfilled core variables', () => {
    const result = generate(defaultOpts(200));
    for (const p of result.prompts) {
      expect(p.promptText).not.toMatch(/\{brand\}/);
      expect(p.promptText).not.toMatch(/\{topicName\}/);
      expect(p.promptText).not.toMatch(/\{category\}/);
    }
  });
});
