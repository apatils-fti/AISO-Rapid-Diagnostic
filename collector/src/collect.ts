#!/usr/bin/env node
/**
 * AISO Collection Engine
 *
 * Loops through every prompt in the prompt library, calls Perplexity's
 * Sonar API `runsPerPrompt` times per prompt, rate-limits to stay
 * within the plan's RPM ceiling, and persists each prompt's results
 * as an individual JSON file.
 *
 * Usage:
 *   PERPLEXITY_API_KEY=pplx-... npm run collect
 *   PERPLEXITY_API_KEY=pplx-... npm run collect -- --dry-run
 *   PERPLEXITY_API_KEY=pplx-... npm run collect -- --resume-from business-casual-commercial
 *   PERPLEXITY_API_KEY=pplx-... npm run collect -- --model sonar-pro
 */

import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { PerplexityClient } from './perplexity.js';
import {
  loadPromptLibrary,
  ensureDir,
  writeJSON,
  readJSONIfExists,
  safeTimestamp,
  formatDuration,
  flattenPrompts,
  progressBar,
} from './utils.js';
import type {
  CollectOptions,
  CollectionManifest,
  PromptResult,
  RunResult,
} from './types.js';

// ── Defaults ──────────────────────────────────────────────

const DEFAULT_PROMPT_LIBRARY = resolve(
  import.meta.dirname ?? '.',
  '../prompts/jcrew-prompt-library.json',
);
const DEFAULT_OUTPUT_BASE = resolve(import.meta.dirname ?? '.', '../data/raw-results');
const DEFAULT_MODEL = 'sonar';
const DEFAULT_RUNS = 3;
const DEFAULT_RPM = 50;

// ── CLI Argument Parsing ──────────────────────────────────

function parseArgs(): CollectOptions {
  const args = process.argv.slice(2);

  const opts: CollectOptions = {
    promptLibraryPath: DEFAULT_PROMPT_LIBRARY,
    outputDir: '', // set below after timestamp
    model: DEFAULT_MODEL,
    runsPerPrompt: DEFAULT_RUNS,
    rpmLimit: DEFAULT_RPM,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--model':
        opts.model = args[++i];
        break;
      case '--runs':
        opts.runsPerPrompt = parseInt(args[++i], 10);
        break;
      case '--rpm':
        opts.rpmLimit = parseInt(args[++i], 10);
        break;
      case '--prompts':
        opts.promptLibraryPath = resolve(args[++i]);
        break;
      case '--resume-from':
        opts.resumeFrom = args[++i];
        break;
      case '--output':
        opts.outputDir = resolve(args[++i]);
        break;
      default:
        console.warn(`Unknown argument: ${args[i]}`);
    }
  }

  // Generate output directory with timestamp if not explicitly set
  if (!opts.outputDir) {
    opts.outputDir = join(DEFAULT_OUTPUT_BASE, safeTimestamp());
  }

  return opts;
}

// ── Main Collection Loop ──────────────────────────────────

async function main() {
  const opts = parseArgs();

  // ── Validate API Key ──
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey && !opts.dryRun) {
    console.error('✘  Missing PERPLEXITY_API_KEY environment variable.');
    console.error('   Set it:  export PERPLEXITY_API_KEY=pplx-...');
    process.exit(1);
  }

  // ── Load Prompt Library ──
  if (!existsSync(opts.promptLibraryPath)) {
    console.error(`✘  Prompt library not found: ${opts.promptLibraryPath}`);
    process.exit(1);
  }

  const library = loadPromptLibrary(opts.promptLibraryPath);
  const allPrompts = flattenPrompts(library);

  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   AISO Collection Engine                     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Client:       ${library.client.name}`);
  console.log(`  Model:        ${opts.model}`);
  console.log(`  Prompts:      ${allPrompts.length}`);
  console.log(`  Runs/prompt:  ${opts.runsPerPrompt}`);
  console.log(`  Total calls:  ${allPrompts.length * opts.runsPerPrompt}`);
  console.log(`  RPM limit:    ${opts.rpmLimit}`);
  console.log(`  Output:       ${opts.outputDir}`);
  console.log(`  Dry run:      ${opts.dryRun}`);
  if (opts.resumeFrom) {
    console.log(`  Resume from:  ${opts.resumeFrom}`);
  }
  console.log('');

  // ── Setup ──
  ensureDir(opts.outputDir);
  const client = opts.dryRun ? null : new PerplexityClient(apiKey!, opts.model, opts.rpmLimit);

  const manifest: CollectionManifest = {
    client: library.client,
    competitors: library.competitors,
    timestamp: new Date().toISOString(),
    model: opts.model,
    runsPerPrompt: opts.runsPerPrompt,
    totalPrompts: allPrompts.length,
    totalApiCalls: allPrompts.length * opts.runsPerPrompt,
    completedApiCalls: 0,
    failedApiCalls: 0,
    durationMs: 0,
    promptLibraryPath: opts.promptLibraryPath,
  };

  const startTime = Date.now();
  let skipUntilFound = !!opts.resumeFrom;
  let promptIdx = 0;

  for (const prompt of allPrompts) {
    promptIdx++;

    // ── Resume support ──
    if (skipUntilFound) {
      if (prompt.promptId === opts.resumeFrom) {
        skipUntilFound = false;
        console.log(`  ⟳  Resuming from ${prompt.promptId}`);
      } else {
        // Check if result already exists on disk
        const resultPath = join(opts.outputDir, `${prompt.promptId}.json`);
        if (existsSync(resultPath)) {
          manifest.completedApiCalls += opts.runsPerPrompt;
        }
        continue;
      }
    }

    // ── Check if already collected (crash recovery) ──
    const resultPath = join(opts.outputDir, `${prompt.promptId}.json`);
    const existing = readJSONIfExists<PromptResult>(resultPath);
    if (existing && existing.runs.length >= opts.runsPerPrompt) {
      console.log(`  ✓  ${prompt.promptId} — already collected, skipping`);
      manifest.completedApiCalls += opts.runsPerPrompt;
      continue;
    }

    console.log(`\n${progressBar(promptIdx, allPrompts.length)}`);
    console.log(`  → ${prompt.topicName} / ${prompt.isotope}`);
    console.log(`    "${prompt.promptText.slice(0, 80)}${prompt.promptText.length > 80 ? '...' : ''}"`);

    const runs: RunResult[] = existing?.runs ?? [];
    const startRun = runs.length + 1;

    for (let run = startRun; run <= opts.runsPerPrompt; run++) {
      const runStart = Date.now();

      if (opts.dryRun) {
        console.log(`    Run ${run}/${opts.runsPerPrompt}: [DRY RUN] — skipped`);
        manifest.completedApiCalls++;
        runs.push({
          runId: run,
          timestamp: new Date().toISOString(),
          response: {
            id: 'dry-run',
            model: opts.model,
            created: Date.now(),
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            citations: [],
            choices: [{
              index: 0,
              finish_reason: 'stop',
              message: { role: 'assistant', content: '[DRY RUN — no API call made]' },
            }],
          },
          durationMs: 0,
        });
        continue;
      }

      try {
        const response = await client!.query(prompt.promptText);
        const durationMs = Date.now() - runStart;

        runs.push({
          runId: run,
          timestamp: new Date().toISOString(),
          response,
          durationMs,
        });

        const citationCount = response.citations?.length ?? 0;
        const tokens = response.usage?.total_tokens ?? 0;
        console.log(`    Run ${run}/${opts.runsPerPrompt}: ${citationCount} citations, ${tokens} tokens (${formatDuration(durationMs)})`);

        manifest.completedApiCalls++;
      } catch (err) {
        const error = err as Error;
        console.error(`    ✘  Run ${run}/${opts.runsPerPrompt} FAILED: ${error.message}`);
        manifest.failedApiCalls++;

        // Push a partial run with error info so we know it failed
        runs.push({
          runId: run,
          timestamp: new Date().toISOString(),
          response: {
            id: 'error',
            model: opts.model,
            created: Date.now(),
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            citations: [],
            choices: [{
              index: 0,
              finish_reason: 'error',
              message: { role: 'assistant', content: `ERROR: ${error.message}` },
            }],
          },
          durationMs: Date.now() - runStart,
        });
      }

      // ── Persist after each run (crash-safe) ──
      const promptResult: PromptResult = {
        promptId: prompt.promptId,
        promptText: prompt.promptText,
        topicId: prompt.topicId,
        topicName: prompt.topicName,
        category: prompt.category,
        isotope: prompt.isotope,
        platform: 'perplexity',
        model: opts.model,
        collectionTimestamp: manifest.timestamp,
        runs,
      };

      writeJSON(resultPath, promptResult);
    }

    // ── Also persist after all runs complete (covers dry-run path) ──
    if (runs.length > 0) {
      const promptResult: PromptResult = {
        promptId: prompt.promptId,
        promptText: prompt.promptText,
        topicId: prompt.topicId,
        topicName: prompt.topicName,
        category: prompt.category,
        isotope: prompt.isotope,
        platform: 'perplexity',
        model: opts.model,
        collectionTimestamp: manifest.timestamp,
        runs,
      };

      writeJSON(resultPath, promptResult);
    }
  }

  // ── Write manifest ──
  manifest.durationMs = Date.now() - startTime;
  writeJSON(join(opts.outputDir, '_manifest.json'), manifest);

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Collection complete!');
  console.log(`  Duration:    ${formatDuration(manifest.durationMs)}`);
  console.log(`  Completed:   ${manifest.completedApiCalls}/${manifest.totalApiCalls} API calls`);
  console.log(`  Failed:      ${manifest.failedApiCalls}`);
  console.log(`  Output:      ${opts.outputDir}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
