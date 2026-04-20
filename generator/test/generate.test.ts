import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTemplate } from '../src/validate.js';
import { generate, pickTier, allocateCells, fillSeed } from '../src/generate.js';
import { INTENT_STAGES, ISOTOPES, type GenerateOptions, type IntentStage, type Isotope, type Topic } from '../src/types.js';

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

function allCellValues(counts: Record<IntentStage, Record<Isotope, number>>): number[] {
  return INTENT_STAGES.flatMap((i) => ISOTOPES.map((iso) => counts[i][iso]));
}

describe('pickTier', () => {
  it('selects full at or above 250', () => {
    expect(pickTier(250)).toBe('full');
    expect(pickTier(500)).toBe('full');
    expect(pickTier(1000)).toBe('full');
  });

  it('selects quick between 125 (inclusive) and 250 (exclusive)', () => {
    expect(pickTier(125)).toBe('quick');
    expect(pickTier(200)).toBe('quick');
    expect(pickTier(249)).toBe('quick');
  });

  it('selects exploratory below 125', () => {
    expect(pickTier(124)).toBe('exploratory');
    expect(pickTier(50)).toBe('exploratory');
    expect(pickTier(25)).toBe('exploratory');
  });
});

describe('allocateCells: flat distribution', () => {
  it('250 → exactly 10 per cell across all 25 cells', () => {
    const counts = allocateCells(250);
    for (const intent of INTENT_STAGES) {
      for (const iso of ISOTOPES) {
        expect(counts[intent][iso]).toBe(10);
      }
    }
  });

  it('125 → exactly 5 per cell across all 25 cells', () => {
    const counts = allocateCells(125);
    for (const intent of INTENT_STAGES) {
      for (const iso of ISOTOPES) {
        expect(counts[intent][iso]).toBe(5);
      }
    }
  });

  it('500 → exactly 20 per cell', () => {
    const counts = allocateCells(500);
    for (const intent of INTENT_STAGES) {
      for (const iso of ISOTOPES) {
        expect(counts[intent][iso]).toBe(20);
      }
    }
  });

  it('sum always equals target (wide range)', () => {
    for (const target of [25, 26, 50, 100, 124, 125, 126, 200, 240, 250, 260, 300, 499, 500]) {
      const counts = allocateCells(target);
      const sum = allCellValues(counts).reduce((a, b) => a + b, 0);
      expect(sum, `target=${target}`).toBe(target);
    }
  });

  it('flat invariant: max(cells) - min(cells) <= 1', () => {
    for (const target of [26, 100, 126, 200, 240, 251, 260, 499]) {
      const counts = allocateCells(target);
      const all = allCellValues(counts);
      const diff = Math.max(...all) - Math.min(...all);
      expect(diff, `target=${target}`).toBeLessThanOrEqual(1);
    }
  });

  it('no cell drops to 0 for target >= 25', () => {
    for (const target of [25, 26, 50, 100, 125, 126, 200, 250]) {
      const counts = allocateCells(target);
      const all = allCellValues(counts);
      expect(Math.min(...all), `target=${target}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('multiples of 25 have zero variance (every cell equal)', () => {
    for (const target of [25, 50, 75, 100, 125, 150, 200, 250, 500]) {
      const counts = allocateCells(target);
      const all = allCellValues(counts);
      expect(Math.max(...all) - Math.min(...all), `target=${target}`).toBe(0);
    }
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

describe('generate: full tier (flat, target=250)', () => {
  it('produces exactly 250 prompts', () => {
    const result = generate(defaultOpts(250));
    expect(result.prompts.length).toBe(250);
    expect(result.tier).toBe('full');
  });

  it('fills all 25 cells', () => {
    const result = generate(defaultOpts(250));
    const seen = new Set<string>();
    for (const p of result.prompts) seen.add(`${p.intent_stage}.${p.isotope}`);
    expect(seen.size).toBe(25);
  });

  it('intent distribution within 0.23 flat threshold', () => {
    const result = generate(defaultOpts(250));
    const counts: Record<string, number> = {};
    for (const p of result.prompts) counts[p.intent_stage] = (counts[p.intent_stage] ?? 0) + 1;
    for (const intent of INTENT_STAGES) {
      const share = (counts[intent] ?? 0) / result.prompts.length;
      expect(share, `intent=${intent}`).toBeLessThanOrEqual(0.23);
      expect(share, `intent=${intent}`).toBeGreaterThanOrEqual(0.17);
    }
  });

  it('isotope distribution within 0.23 flat threshold', () => {
    const result = generate(defaultOpts(250));
    const counts: Record<string, number> = {};
    for (const p of result.prompts) counts[p.isotope] = (counts[p.isotope] ?? 0) + 1;
    for (const iso of ISOTOPES) {
      const share = (counts[iso] ?? 0) / result.prompts.length;
      expect(share, `isotope=${iso}`).toBeLessThanOrEqual(0.23);
      expect(share, `isotope=${iso}`).toBeGreaterThanOrEqual(0.17);
    }
  });

  it('no indicative/exploratory warning at 250', () => {
    const result = generate(defaultOpts(250));
    expect(result.warnings.filter((w) => w.includes('exploratory') || w.includes('indicative'))).toHaveLength(0);
  });
});

describe('generate: quick tier (125–249)', () => {
  it('at 125 produces 125 prompts in quick tier', () => {
    const result = generate(defaultOpts(125));
    expect(result.prompts.length).toBe(125);
    expect(result.tier).toBe('quick');
  });

  it('warns that output is indicative at 200', () => {
    const result = generate(defaultOpts(200));
    expect(result.tier).toBe('quick');
    expect(result.warnings.some((w) => w.includes('indicative'))).toBe(true);
  });
});

describe('generate: exploratory tier (< 125)', () => {
  it('warns that output is exploratory at 50', () => {
    const result = generate(defaultOpts(50));
    expect(result.tier).toBe('exploratory');
    expect(result.warnings.some((w) => w.includes('exploratory'))).toBe(true);
  });
});

describe('generate: variable filling', () => {
  it('no prompt text contains unfilled core variables', () => {
    const result = generate(defaultOpts(250));
    for (const p of result.prompts) {
      expect(p.promptText).not.toMatch(/\{brand\}/);
      expect(p.promptText).not.toMatch(/\{topicName\}/);
      expect(p.promptText).not.toMatch(/\{category\}/);
    }
  });
});
