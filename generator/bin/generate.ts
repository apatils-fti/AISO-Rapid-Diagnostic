#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTemplate } from '../src/validate.js';
import { generate } from '../src/generate.js';
import { dedupePrompts, checkCoverageBias } from '../src/utils.js';

interface ClientConfig {
  brand: string;
  competitor: string;
  archetype: string;
  targetPromptCount: number;
  personas: string[];
  attributes: string[];
  pricePoints: string[];
  contexts: string[];
  topics: { id: string; name: string; category: string }[];
}

function usage(): never {
  // eslint-disable-next-line no-console
  console.error('usage: generate --config <client.json> [--out <file.json>]');
  process.exit(2);
}

function parseArgs(argv: string[]): { config: string; out?: string } {
  let config: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--config') config = argv[++i];
    else if (arg === '--out') out = argv[++i];
  }
  if (!config) usage();
  return { config, out };
}

function main() {
  const { config: configPath, out } = parseArgs(process.argv.slice(2));
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as ClientConfig;

  const here = dirname(fileURLToPath(import.meta.url));
  const templatePath = resolve(here, '..', 'templates', `${config.archetype}.json`);
  const rawTemplate = JSON.parse(readFileSync(templatePath, 'utf8'));
  const template = parseTemplate(rawTemplate);

  const result = generate({
    template,
    topics: config.topics,
    targetPromptCount: config.targetPromptCount,
    brand: config.brand,
    competitor: config.competitor,
    personas: config.personas,
    attributes: config.attributes,
    pricePoints: config.pricePoints,
    contexts: config.contexts,
  });

  // Coverage check runs on pre-dedup allocation output where the flat
  // invariant (max - min <= 1) is guaranteed by construction. Dedup can
  // remove prompts unevenly across cells (seed text similarity is
  // content-dependent), which is expected and not a structural violation.
  const coverage = checkCoverageBias(result.prompts, template, result.tier);
  const deduped = dedupePrompts(result.prompts);

  const dedupWarnings: string[] = deduped.length < result.prompts.length
    ? [`dedup removed ${result.prompts.length - deduped.length} near-duplicate prompts (${deduped.length} remain)`]
    : [];

  const output = {
    tier: result.tier,
    totalPrompts: deduped.length,
    warnings: [...result.warnings, ...coverage.warnings, ...dedupWarnings],
    errors: coverage.errors,
    stats: result.stats,
    coverage,
    prompts: deduped,
  };

  const outJson = JSON.stringify(output, null, 2);
  if (out) writeFileSync(out, outJson);
  else process.stdout.write(outJson);

  if (!coverage.ok) {
    // eslint-disable-next-line no-console
    console.error('coverage bias check failed:\n' + coverage.errors.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }
}

main();
