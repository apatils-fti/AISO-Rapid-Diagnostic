import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { PromptLibrary } from './types.js';

/** Load the prompt library JSON from disk. */
export function loadPromptLibrary(path: string): PromptLibrary {
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as PromptLibrary;
}

/** Ensure a directory (and all parents) exists. */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Write a JSON file with pretty-printing. */
export function writeJSON(filePath: string, data: unknown): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** Read a JSON file if it exists, otherwise return undefined. */
export function readJSONIfExists<T>(filePath: string): T | undefined {
  if (!existsSync(filePath)) return undefined;
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

/** Generate an ISO 8601 timestamp string safe for directory names. */
export function safeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Human-friendly elapsed time. */
export function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1_000);
  return `${min}m ${sec}s`;
}

/** Flatten all prompts from a library into a sequential list with topic metadata. */
export function flattenPrompts(library: PromptLibrary) {
  const flat: Array<{
    promptId: string;
    promptText: string;
    topicId: string;
    topicName: string;
    category: string;
    isotope: string;
  }> = [];

  for (const topic of library.topics) {
    for (const prompt of topic.prompts) {
      flat.push({
        promptId: prompt.id,
        promptText: prompt.text,
        topicId: topic.id,
        topicName: topic.name,
        category: topic.category,
        isotope: prompt.isotope,
      });
    }
  }

  return flat;
}

/** Simple progress bar for terminal output. */
export function progressBar(current: number, total: number, width = 30): string {
  const pct = current / total;
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${current}/${total} (${(pct * 100).toFixed(1)}%)`;
}
