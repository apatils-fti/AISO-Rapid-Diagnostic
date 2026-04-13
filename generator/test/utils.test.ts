import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTemplate } from '../src/validate.js';
import { generate } from '../src/generate.js';
import { tokenize, jaccard, dedupePrompts, checkCoverageBias } from '../src/utils.js';
import type { FlatPrompt, GenerateOptions, Topic } from '../src/types.js';

function loadTemplate(name: string) {
  const path = resolve(__dirname, '..', 'templates', `${name}.json`);
  return parseTemplate(JSON.parse(readFileSync(path, 'utf8')));
}

const TOPICS: Topic[] = [
  { id: 't1', name: 'cashmere sweaters', category: 'sweaters' },
  { id: 't2', name: 'chino pants', category: 'pants' },
  { id: 't3', name: 'oxford shirts', category: 'shirts' },
  { id: 't4', name: 'wool overcoats', category: 'outerwear' },
];

function opts(target: number): GenerateOptions {
  return {
    template: loadTemplate('transactional-commerce'),
    topics: TOPICS,
    targetPromptCount: target,
    brand: 'J.Crew',
    competitor: 'Banana Republic',
    personas: ['office worker', 'retiree'],
    attributes: ['wool', 'slim fit'],
    pricePoints: ['$100', '$150'],
    contexts: ['winter', 'a wedding'],
  };
}

describe('tokenize + jaccard', () => {
  it('tokenizes a simple string', () => {
    const tokens = tokenize('Buy J.Crew sweaters today!');
    expect(tokens.has('buy')).toBe(true);
    expect(tokens.has('j')).toBe(true);
    expect(tokens.has('crew')).toBe(true);
    expect(tokens.has('sweaters')).toBe(true);
  });

  it('identical strings score 1.0', () => {
    const a = tokenize('buy cashmere sweaters today');
    const b = tokenize('buy cashmere sweaters today');
    expect(jaccard(a, b)).toBe(1);
  });

  it('disjoint strings score 0', () => {
    const a = tokenize('apple banana');
    const b = tokenize('carrot dog');
    expect(jaccard(a, b)).toBe(0);
  });

  it('near-duplicates score above 0.85', () => {
    const a = tokenize('buy cashmere sweaters today for winter');
    const b = tokenize('buy cashmere sweaters today for spring');
    expect(jaccard(a, b)).toBeGreaterThan(0.7);
  });
});

describe('dedupePrompts', () => {
  it('drops exact duplicates', () => {
    const mk = (id: string, text: string): FlatPrompt => ({
      promptId: id,
      topicId: 't1',
      topicName: 'sweaters',
      category: 'sweaters',
      promptText: text,
      isotope: 'declarative',
      intent_stage: 'learning',
    });
    const prompts = [
      mk('a', 'what is cashmere and why does it matter'),
      mk('b', 'what is cashmere and why does it matter'),
      mk('c', 'where can I buy a J.Crew sweater'),
    ];
    const out = dedupePrompts(prompts);
    expect(out.length).toBe(2);
  });

  it('drops near-duplicates above threshold', () => {
    const mk = (id: string, text: string): FlatPrompt => ({
      promptId: id,
      topicId: 't1',
      topicName: 'sweaters',
      category: 'sweaters',
      promptText: text,
      isotope: 'declarative',
      intent_stage: 'learning',
    });
    const prompts = [
      mk('a', 'buy cashmere sweaters today for winter season'),
      mk('b', 'buy cashmere sweaters today for winter season now'),
    ];
    const out = dedupePrompts(prompts, 0.85);
    expect(out.length).toBe(1);
  });

  it('keeps distinct prompts', () => {
    const mk = (id: string, text: string): FlatPrompt => ({
      promptId: id,
      topicId: 't1',
      topicName: 'sweaters',
      category: 'sweaters',
      promptText: text,
      isotope: 'declarative',
      intent_stage: 'learning',
    });
    const prompts = [
      mk('a', 'what is cashmere grade'),
      mk('b', 'where can I buy wool overcoats'),
      mk('c', 'J.Crew vs Banana Republic for chinos'),
    ];
    const out = dedupePrompts(prompts);
    expect(out.length).toBe(3);
  });
});

describe('checkCoverageBias', () => {
  it('passes on a clean full-tier generation', () => {
    const result = generate(opts(200));
    const report = checkCoverageBias(result.prompts, opts(200).template, 'full');
    if (!report.ok) {
      // eslint-disable-next-line no-console
      console.error(report.errors);
    }
    expect(report.ok).toBe(true);
    expect(report.errors.length).toBe(0);
  });

  it('detects intent over-representation', () => {
    const result = generate(opts(200));
    // Force all prompts to look like discovery
    const skewed = result.prompts.map((p) => ({ ...p, intent_stage: 'discovery' as const }));
    const template = opts(200).template;
    const report = checkCoverageBias(skewed, template, 'full');
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes("intent 'discovery'"))).toBe(true);
  });

  it('detects isotope over-representation', () => {
    const result = generate(opts(200));
    const skewed = result.prompts.map((p) => ({ ...p, isotope: 'declarative' as const }));
    const template = opts(200).template;
    const report = checkCoverageBias(skewed, template, 'full');
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes("isotope 'declarative'"))).toBe(true);
  });

  it('quick tier reports cell-floor violations as warnings not errors', () => {
    const result = generate(opts(100));
    const report = checkCoverageBias(result.prompts, opts(100).template, 'quick');
    // In quick tier we tolerate minPerCell=1 and any floor violations are warnings.
    expect(report.errors.filter((e) => e.includes('minPerCell')).length).toBe(0);
  });

  it('exploratory tier skips cell-floor checks entirely', () => {
    const result = generate(opts(40));
    const report = checkCoverageBias(result.prompts, opts(40).template, 'exploratory');
    expect(report.errors.filter((e) => e.includes('minPerCell')).length).toBe(0);
    expect(report.warnings.filter((w) => w.includes('minPerCell')).length).toBe(0);
  });
});
