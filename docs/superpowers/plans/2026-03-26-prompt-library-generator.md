# Prompt Library Generator Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable TypeScript CLI that generates AISO prompt libraries from client configs + archetype templates, enriched by the Claude API.

**Architecture:** A pipeline CLI (`generate.ts`) that: (1) validates a client config with Zod, (2) loads an archetype seed template, (3) expands topics via Claude API, (4) generates 6 prompts per topic (one per isotope) via Claude API, (5) deduplicates by Jaccard similarity, (6) writes nested + flat JSON output files. Each stage is a separate module with a clear interface.

**Tech Stack:** TypeScript, tsx (runner), Zod (validation), @anthropic-ai/sdk (Claude API), commander (CLI args)

---

## File Structure

```
generator/
├── package.json
├── tsconfig.json
├── src/
│   ├── types.ts              # All TypeScript interfaces + Zod schemas
│   ├── config-loader.ts      # Load + validate client config JSON
│   ├── template-engine.ts    # Load archetype template, expand seed variables
│   ├── enricher.ts           # Claude API: topic expansion + prompt generation
│   ├── deduplicator.ts       # Jaccard similarity dedup
│   ├── output-writer.ts      # Write nested + flat JSON files
│   └── generate.ts           # Main CLI entry point (pipeline orchestrator)
├── templates/
│   ├── trust-based-advisory.json
│   └── b2b.json
├── configs/
│   └── fti-consulting.json
└── output/                   # Generated files land here (gitignored)
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `generator/package.json`
- Create: `generator/tsconfig.json`
- Create: `generator/.gitignore`

- [ ] **Step 1: Create generator/package.json**

```json
{
  "name": "aiso-prompt-generator",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "generate": "tsx src/generate.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "commander": "^13.1.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create generator/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "output"]
}
```

- [ ] **Step 3: Create generator/.gitignore**

```
node_modules/
dist/
output/
```

- [ ] **Step 4: Install dependencies**

Run: `cd generator && npm install`
Expected: node_modules created, package-lock.json generated

- [ ] **Step 5: Commit**

```bash
git add generator/package.json generator/tsconfig.json generator/.gitignore generator/package-lock.json
git commit -m "chore: scaffold generator project with deps"
```

---

### Task 2: Types & Zod Schemas

**Files:**
- Create: `generator/src/types.ts`

- [ ] **Step 1: Create types.ts with all interfaces and Zod schemas**

```typescript
import { z } from "zod";

// --- Zod Schemas (source of truth) ---

export const CompetitorSchema = z.object({
  name: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1),
});

export const GenerationConfigSchema = z.object({
  targetPromptCount: z.number().int().min(10).default(250),
  topicsPerCategory: z.object({
    Awareness: z.number().int().min(1),
    Consideration: z.number().int().min(1),
    Conversion: z.number().int().min(1),
  }),
});

export const ClientConfigSchema = z.object({
  client: z.object({
    name: z.string().min(1),
    domains: z.array(z.string().min(1)).min(1),
    industry: z.string().min(1),
  }),
  competitors: z.array(CompetitorSchema).min(2),
  archetype: z.string().min(1),
  generation: GenerationConfigSchema,
  keyTopics: z.array(z.string().min(1)).min(5),
  personas: z.array(z.string().min(1)).min(2),
  pricePoints: z.array(z.string().min(1)).min(1),
  contexts: z.array(z.string().min(1)).min(1),
  attributes: z.array(z.string().min(1)).min(1),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;

// --- Archetype Template ---

export const ArchetypeSchema = z.object({
  archetype: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    sectors: z.array(z.string()),
    primaryFocus: z.array(z.string()),
    promptEmphasis: z.string(),
  }),
  seeds: z.object({
    informational: z.array(z.string()).min(3),
    commercial: z.array(z.string()).min(3),
    comparative: z.array(z.string()).min(3),
    persona: z.array(z.string()).min(3),
    specific: z.array(z.string()).min(3),
    conversational: z.array(z.string()).min(3),
  }),
});

export type ArchetypeTemplate = z.infer<typeof ArchetypeSchema>;

// --- Isotope Types ---

export const ISOTOPE_TYPES = [
  "informational",
  "commercial",
  "comparative",
  "persona",
  "specific",
  "conversational",
] as const;

export type IsotopeType = (typeof ISOTOPE_TYPES)[number];

// --- Funnel Categories ---

export const FUNNEL_CATEGORIES = [
  "Awareness",
  "Consideration",
  "Conversion",
] as const;

export type FunnelCategory = (typeof FUNNEL_CATEGORIES)[number];

// --- Generated Topic ---

export interface GeneratedTopic {
  id: string;
  name: string;
  category: FunnelCategory;
  description: string;
}

// --- Generated Prompt ---

export interface GeneratedPrompt {
  promptId: string;
  topicId: string;
  topicName: string;
  category: FunnelCategory;
  promptText: string;
  isotope: IsotopeType;
}

// --- Nested Output Format (for collector) ---

export interface NestedPromptLibrary {
  client: {
    name: string;
    domains: string[];
    industry: string;
  };
  competitors: Competitor[];
  metadata: {
    generatedAt: string;
    archetype: string;
    totalPrompts: number;
    totalTopics: number;
  };
  topics: Array<{
    id: string;
    name: string;
    category: FunnelCategory;
    prompts: Array<{
      id: string;
      text: string;
      isotope: IsotopeType;
      topic: string;
    }>;
  }>;
}

// --- Flat Output Format (for dashboard batch scripts) ---

export type FlatPrompt = GeneratedPrompt;
```

- [ ] **Step 2: Run typecheck**

Run: `cd generator && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add generator/src/types.ts
git commit -m "feat: add types and Zod schemas for generator pipeline"
```

---

### Task 3: Config Loader

**Files:**
- Create: `generator/src/config-loader.ts`

- [ ] **Step 1: Create config-loader.ts**

```typescript
import { readFileSync } from "fs";
import { resolve } from "path";
import { ClientConfigSchema, type ClientConfig } from "./types.js";

export function loadConfig(configPath: string): ClientConfig {
  const absolutePath = resolve(configPath);
  let raw: string;
  try {
    raw = readFileSync(absolutePath, "utf-8");
  } catch {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config: ${absolutePath}`);
  }

  const result = ClientConfigSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Config validation failed:\n${issues}`);
  }

  return result.data;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd generator && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add generator/src/config-loader.ts
git commit -m "feat: add config loader with Zod validation"
```

---

### Task 4: Template Engine

**Files:**
- Create: `generator/src/template-engine.ts`

- [ ] **Step 1: Create template-engine.ts**

```typescript
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { ArchetypeSchema, type ArchetypeTemplate, type IsotopeType } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, "..", "templates");

export function loadTemplate(archetypeId: string): ArchetypeTemplate {
  const templatePath = resolve(TEMPLATES_DIR, `${archetypeId}.json`);
  let raw: string;
  try {
    raw = readFileSync(templatePath, "utf-8");
  } catch {
    throw new Error(
      `Archetype template not found: ${archetypeId}. Expected file at ${templatePath}`
    );
  }

  const result = ArchetypeSchema.safeParse(JSON.parse(raw));
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid archetype template ${archetypeId}:\n${issues}`);
  }

  return result.data;
}

export interface TemplateVariables {
  brand: string;
  competitor: string;
  persona: string;
  topicName: string;
  currentYear: string;
  pricePoint: string;
  context: string;
  attribute1: string;
  attribute2: string;
}

export function expandSeed(
  seed: string,
  vars: TemplateVariables
): string {
  return seed
    .replace(/\{brand\}/g, vars.brand)
    .replace(/\{competitor\}/g, vars.competitor)
    .replace(/\{persona\}/g, vars.persona)
    .replace(/\{topicName\}/g, vars.topicName)
    .replace(/\{currentYear\}/g, vars.currentYear)
    .replace(/\{pricePoint\}/g, vars.pricePoint)
    .replace(/\{context\}/g, vars.context)
    .replace(/\{attribute1\}/g, vars.attribute1)
    .replace(/\{attribute2\}/g, vars.attribute2);
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getSeeds(
  template: ArchetypeTemplate,
  isotope: IsotopeType
): string[] {
  return template.seeds[isotope];
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd generator && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add generator/src/template-engine.ts
git commit -m "feat: add template engine for seed expansion"
```

---

### Task 5: Claude API Enricher

**Files:**
- Create: `generator/src/enricher.ts`

- [ ] **Step 1: Create enricher.ts**

This is the core module. It uses Claude API for two tasks:
1. **Topic expansion** — take keyTopics + archetype and generate a full categorized topic list
2. **Prompt generation** — for each topic, generate 6 natural prompts (one per isotope), using seed templates as style exemplars

```typescript
import Anthropic from "@anthropic-ai/sdk";
import {
  type ClientConfig,
  type ArchetypeTemplate,
  type GeneratedTopic,
  type GeneratedPrompt,
  type IsotopeType,
  type FunnelCategory,
  ISOTOPE_TYPES,
} from "./types.js";
import { expandSeed, pickRandom, type TemplateVariables } from "./template-engine.js";

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Set it as an environment variable."
    );
  }
  return new Anthropic({ apiKey });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- Topic Expansion ---

export async function expandTopics(
  config: ClientConfig,
  template: ArchetypeTemplate
): Promise<GeneratedTopic[]> {
  const client = getAnthropicClient();
  const totalTopics =
    config.generation.topicsPerCategory.Awareness +
    config.generation.topicsPerCategory.Consideration +
    config.generation.topicsPerCategory.Conversion;

  const prompt = `You are generating topics for an AI search visibility diagnostic for "${config.client.name}" in the "${config.client.industry}" industry.

Archetype: ${template.archetype.name} — ${template.archetype.description}
Focus areas: ${template.archetype.primaryFocus.join(", ")}

The client's key topics to build from: ${config.keyTopics.join(", ")}

Their competitors: ${config.competitors.map((c) => c.name).join(", ")}

Generate exactly ${totalTopics} topics distributed across funnel categories:
- Awareness (${config.generation.topicsPerCategory.Awareness} topics): Educational, "what is" style topics. People learning about the space.
- Consideration (${config.generation.topicsPerCategory.Consideration} topics): Evaluation, comparison, "best" style topics. People comparing options.
- Conversion (${config.generation.topicsPerCategory.Conversion} topics): High-intent, specific decision-making topics. People ready to buy/hire.

Each topic should be a short phrase (2-5 words) representing a search theme.

Respond with ONLY a JSON array of objects, each with:
- "name": the topic phrase
- "category": "Awareness" | "Consideration" | "Conversion"
- "description": one sentence describing what searchers want to know

Example:
[{"name": "Restructuring Advisory", "category": "Awareness", "description": "Understanding what restructuring advisory services entail and when companies need them."}]

Generate exactly ${totalTopics} topics. JSON only, no markdown fences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = JSON.parse(text) as Array<{
    name: string;
    category: FunnelCategory;
    description: string;
  }>;

  return parsed.map((t) => ({
    id: slugify(t.name),
    name: t.name,
    category: t.category,
    description: t.description,
  }));
}

// --- Prompt Generation ---

export async function generatePromptsForTopic(
  topic: GeneratedTopic,
  config: ClientConfig,
  template: ArchetypeTemplate
): Promise<GeneratedPrompt[]> {
  const client = getAnthropicClient();

  // Build seed examples for each isotope as style guides
  const seedExamples = ISOTOPE_TYPES.map((isotope) => {
    const seeds = template.seeds[isotope];
    const seed = pickRandom(seeds);
    const vars: TemplateVariables = {
      brand: config.client.name,
      competitor: pickRandom(config.competitors).name,
      persona: pickRandom(config.personas),
      topicName: topic.name,
      currentYear: new Date().getFullYear().toString(),
      pricePoint: pickRandom(config.pricePoints),
      context: pickRandom(config.contexts),
      attribute1: pickRandom(config.attributes),
      attribute2:
        config.attributes.length > 1
          ? pickRandom(config.attributes.filter((a) => a !== config.attributes[0]))
          : config.attributes[0],
    };
    return { isotope, example: expandSeed(seed, vars) };
  });

  const prompt = `Generate 6 realistic AI search prompts for the topic "${topic.name}" (${topic.description}).

Context:
- Client: ${config.client.name} (${config.client.industry})
- Competitors: ${config.competitors.map((c) => c.name).join(", ")}
- Personas who search: ${config.personas.join(", ")}

Each prompt should be a natural search query someone would type into an AI assistant (Perplexity, ChatGPT, Google AI). Generate one prompt per isotope type, using these style examples as guides:

${seedExamples.map((s) => `- ${s.isotope}: "${s.example}"`).join("\n")}

Rules:
- informational: Educational "what/how/why" query about the topic
- commercial: "Best" or evaluation-intent query, buying/hiring signals
- comparative: Head-to-head comparison mentioning specific firms by name (use real competitor names: ${config.competitors.map((c) => c.name).join(", ")})
- persona: Query from a specific role's perspective (use personas: ${config.personas.join(", ")})
- specific: Narrow query with 2-3 constraints (features, price, context, etc.)
- conversational: Casual, natural language as if talking to a friend

Respond with ONLY a JSON array of 6 objects:
[{"isotope": "informational", "promptText": "..."}, ...]

JSON only, no markdown fences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = JSON.parse(text) as Array<{
    isotope: IsotopeType;
    promptText: string;
  }>;

  return parsed.map((p) => ({
    promptId: `${topic.id}-${p.isotope}`,
    topicId: topic.id,
    topicName: topic.name,
    category: topic.category,
    promptText: p.promptText,
    isotope: p.isotope,
  }));
}

export async function generateAllPrompts(
  topics: GeneratedTopic[],
  config: ClientConfig,
  template: ArchetypeTemplate,
  concurrency: number = 5
): Promise<GeneratedPrompt[]> {
  const allPrompts: GeneratedPrompt[] = [];
  const batches: GeneratedTopic[][] = [];

  for (let i = 0; i < topics.length; i += concurrency) {
    batches.push(topics.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map((topic) =>
        generatePromptsForTopic(topic, config, template).catch((err) => {
          console.error(`Failed to generate prompts for topic "${topic.name}": ${err}`);
          return [] as GeneratedPrompt[];
        })
      )
    );
    for (const prompts of batchResults) {
      allPrompts.push(...prompts);
    }
    console.log(
      `  Generated prompts for ${Math.min(allPrompts.length / 6, topics.length)}/${topics.length} topics...`
    );
  }

  return allPrompts;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd generator && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add generator/src/enricher.ts
git commit -m "feat: add Claude API enricher for topic expansion and prompt generation"
```

---

### Task 6: Deduplicator

**Files:**
- Create: `generator/src/deduplicator.ts`

- [ ] **Step 1: Create deduplicator.ts**

```typescript
import type { GeneratedPrompt } from "./types.js";

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 0)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function deduplicatePrompts(
  prompts: GeneratedPrompt[],
  threshold: number = 0.85
): { kept: GeneratedPrompt[]; removed: GeneratedPrompt[] } {
  const tokenized = prompts.map((p) => ({
    prompt: p,
    tokens: tokenize(p.promptText),
  }));

  const kept: GeneratedPrompt[] = [];
  const removed: GeneratedPrompt[] = [];
  const keptTokens: Set<string>[] = [];

  for (const { prompt, tokens } of tokenized) {
    const isDuplicate = keptTokens.some(
      (existing) => jaccardSimilarity(tokens, existing) > threshold
    );

    if (isDuplicate) {
      removed.push(prompt);
    } else {
      kept.push(prompt);
      keptTokens.push(tokens);
    }
  }

  return { kept, removed };
}

export function stratifiedSample(
  prompts: GeneratedPrompt[],
  targetCount: number
): GeneratedPrompt[] {
  if (prompts.length <= targetCount) return prompts;

  // Group by isotope, then sample proportionally
  const byIsotope = new Map<string, GeneratedPrompt[]>();
  for (const p of prompts) {
    const group = byIsotope.get(p.isotope) ?? [];
    group.push(p);
    byIsotope.set(p.isotope, group);
  }

  const perIsotope = Math.floor(targetCount / byIsotope.size);
  const remainder = targetCount - perIsotope * byIsotope.size;

  const sampled: GeneratedPrompt[] = [];
  let extraBudget = remainder;

  for (const [, group] of byIsotope) {
    const take = Math.min(group.length, perIsotope + (extraBudget > 0 ? 1 : 0));
    if (take > perIsotope) extraBudget--;

    // Shuffle and take
    const shuffled = [...group].sort(() => Math.random() - 0.5);
    sampled.push(...shuffled.slice(0, take));
  }

  return sampled;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd generator && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add generator/src/deduplicator.ts
git commit -m "feat: add Jaccard deduplication and stratified sampling"
```

---

### Task 7: Output Writer

**Files:**
- Create: `generator/src/output-writer.ts`

- [ ] **Step 1: Create output-writer.ts**

```typescript
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  ClientConfig,
  GeneratedPrompt,
  GeneratedTopic,
  NestedPromptLibrary,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "..", "output");

function ensureOutputDir(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

function clientSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function writeNestedLibrary(
  config: ClientConfig,
  topics: GeneratedTopic[],
  prompts: GeneratedPrompt[]
): string {
  ensureOutputDir();

  const promptsByTopic = new Map<string, GeneratedPrompt[]>();
  for (const p of prompts) {
    const group = promptsByTopic.get(p.topicId) ?? [];
    group.push(p);
    promptsByTopic.set(p.topicId, group);
  }

  const library: NestedPromptLibrary = {
    client: config.client,
    competitors: config.competitors,
    metadata: {
      generatedAt: new Date().toISOString(),
      archetype: config.archetype,
      totalPrompts: prompts.length,
      totalTopics: topics.length,
    },
    topics: topics.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      prompts: (promptsByTopic.get(t.id) ?? []).map((p) => ({
        id: p.promptId,
        text: p.promptText,
        isotope: p.isotope,
        topic: p.topicId,
      })),
    })),
  };

  const slug = clientSlug(config.client.name);
  const filePath = resolve(OUTPUT_DIR, `${slug}-prompt-library.json`);
  writeFileSync(filePath, JSON.stringify(library, null, 2));
  return filePath;
}

export function writeFlatLibrary(
  config: ClientConfig,
  prompts: GeneratedPrompt[]
): string {
  ensureOutputDir();

  const slug = clientSlug(config.client.name);
  const filePath = resolve(OUTPUT_DIR, `${slug}-top-250.json`);
  writeFileSync(filePath, JSON.stringify(prompts, null, 2));
  return filePath;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd generator && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add generator/src/output-writer.ts
git commit -m "feat: add output writer for nested and flat JSON formats"
```

---

### Task 8: Trust-Based Advisory Archetype Template

**Files:**
- Create: `generator/templates/trust-based-advisory.json`

- [ ] **Step 1: Create the trust-based-advisory template**

```json
{
  "archetype": {
    "id": "trust-based-advisory",
    "name": "Trust-Based Advisory",
    "description": "Professional services firms where reputation, credentials, and domain authority are the primary purchasing drivers. Engagements are high-stakes, relationship-driven, and often triggered by crisis or regulatory events.",
    "sectors": ["Management Consulting", "Financial Advisory", "Legal Services", "Forensic Consulting", "Economic Consulting", "Strategic Communications"],
    "primaryFocus": ["domain authority", "expert credibility", "trust signals", "track record", "regulatory expertise"],
    "promptEmphasis": "Focus on expertise validation, firm reputation, track record in specific situations, and crisis/event-driven decision-making. Emphasize credentials, case outcomes, and industry recognition over product features."
  },
  "seeds": {
    "informational": [
      "What is {topicName} and when do companies need it?",
      "How does {topicName} work in the context of {context}?",
      "What should companies know about {topicName} before hiring a firm?",
      "Explain the role of {topicName} in {context}",
      "What are the key considerations when evaluating {topicName} services?",
      "How has {topicName} evolved in {currentYear}?"
    ],
    "commercial": [
      "Best {topicName} firms in {currentYear}",
      "Top {topicName} advisory firms for {context}",
      "Leading {topicName} consultants ranked by expertise",
      "Which firms are best known for {topicName}?",
      "Who are the top advisors for {topicName} in complex situations?",
      "Best {topicName} firms with {attribute1} capabilities"
    ],
    "comparative": [
      "{brand} vs {competitor} for {topicName}",
      "How does {brand} compare to {competitor} in {topicName}?",
      "{competitor} vs {brand} {topicName} services comparison",
      "Comparing {brand} and {competitor} for {topicName} in {context}",
      "Which is better for {topicName}: {brand} or {competitor}?"
    ],
    "persona": [
      "As a {persona}, what {topicName} firm should I hire?",
      "I'm a {persona} looking for {topicName} support for {context}, who should I consider?",
      "What should a {persona} look for when hiring a {topicName} advisor?",
      "As a {persona} dealing with {context}, which {topicName} firms are most respected?",
      "Recommendations for a {persona} needing {topicName} expertise"
    ],
    "specific": [
      "{topicName} firm with {attribute1} and {attribute2} experience for {context}",
      "Who provides {topicName} services for {context} with {attribute1} capabilities?",
      "{topicName} advisory firm specializing in {context} with global reach",
      "Need a {topicName} firm that handles {attribute1} matters under {context} conditions",
      "{topicName} experts with {attribute1} credentials for engagements over ${pricePoint}"
    ],
    "conversational": [
      "We're dealing with {context} and need help with {topicName}, any recommendations?",
      "Our company is going through {context} — who are the go-to firms for {topicName}?",
      "I've heard of {brand} for {topicName} but wondering if there are better options",
      "Looking for advice on {topicName}, we're in a {context} situation right now",
      "Can someone recommend a good {topicName} firm? We're facing {context} and need experts fast"
    ]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add generator/templates/trust-based-advisory.json
git commit -m "feat: add trust-based-advisory archetype template"
```

---

### Task 9: FTI Consulting Client Config

**Files:**
- Create: `generator/configs/fti-consulting.json`

- [ ] **Step 1: Create the FTI Consulting config**

```json
{
  "client": {
    "name": "FTI Consulting",
    "domains": ["fticonsulting.com", "ftitechnology.com", "fticommunications.com", "compasslexecon.com"],
    "industry": "professional-services-advisory"
  },
  "competitors": [
    { "name": "AlixPartners", "domains": ["alixpartners.com"] },
    { "name": "Alvarez & Marsal", "domains": ["alvarezandmarsal.com"] },
    { "name": "Kroll", "domains": ["kroll.com"] },
    { "name": "Analysis Group", "domains": ["analysisgroup.com"] },
    { "name": "Brunswick Group", "domains": ["brunswickgroup.com"] }
  ],
  "archetype": "trust-based-advisory",
  "generation": {
    "targetPromptCount": 250,
    "topicsPerCategory": {
      "Awareness": 15,
      "Consideration": 15,
      "Conversion": 15
    }
  },
  "keyTopics": [
    "Corporate Restructuring",
    "Chapter 11 Financial Advisory",
    "Antitrust Economic Consulting",
    "Forensic Investigation",
    "Crisis Communications",
    "E-Discovery Services",
    "Expert Witness Testimony",
    "M&A Due Diligence",
    "Regulatory Compliance",
    "Digital Forensics",
    "Turnaround Management",
    "Shareholder Activism Defense",
    "FCPA Investigation",
    "Valuation Services",
    "Strategic Communications"
  ],
  "personas": [
    "General Counsel",
    "Chief Financial Officer",
    "Board of Directors member",
    "Private Equity partner",
    "AmLaw 100 litigation partner",
    "Chief Communications Officer",
    "Chief Restructuring Officer",
    "CISO"
  ],
  "pricePoints": ["500000", "1000000", "5000000", "10000000"],
  "contexts": [
    "Chapter 11 bankruptcy",
    "hostile takeover defense",
    "SEC investigation",
    "cross-border merger",
    "FCPA enforcement action",
    "data breach incident",
    "shareholder proxy fight",
    "distressed debt situation",
    "antitrust merger review",
    "internal fraud investigation",
    "government monitorship",
    "IPO preparation"
  ],
  "attributes": [
    "global reach across 32 countries",
    "former government regulators on staff",
    "Big Law trusted",
    "multi-disciplinary integrated teams",
    "court-qualified expert witnesses",
    "independent from Big 4 audit conflicts",
    "top-ranked by industry publications",
    "crisis-specialized"
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add generator/configs/fti-consulting.json
git commit -m "feat: add FTI Consulting client config"
```

---

### Task 10: Main CLI Entry Point

**Files:**
- Create: `generator/src/generate.ts`

- [ ] **Step 1: Create generate.ts — the pipeline orchestrator**

```typescript
import { Command } from "commander";
import { loadConfig } from "./config-loader.js";
import { loadTemplate } from "./template-engine.js";
import { expandTopics, generateAllPrompts } from "./enricher.js";
import { deduplicatePrompts, stratifiedSample } from "./deduplicator.js";
import { writeNestedLibrary, writeFlatLibrary } from "./output-writer.js";
import { ISOTOPE_TYPES, type FunnelCategory } from "./types.js";

const program = new Command();

program
  .name("aiso-generate")
  .description("Generate an AISO prompt library from a client config")
  .requiredOption("--config <path>", "Path to client config JSON file")
  .option("--concurrency <n>", "API call concurrency", "5")
  .parse();

const opts = program.opts<{ config: string; concurrency: string }>();

async function main() {
  const startTime = Date.now();

  // Step 1: Load and validate config
  console.log("Step 1/6: Loading config...");
  const config = loadConfig(opts.config);
  console.log(`  Client: ${config.client.name}`);
  console.log(`  Archetype: ${config.archetype}`);
  console.log(`  Target prompts: ${config.generation.targetPromptCount}`);

  // Step 2: Load archetype template
  console.log("\nStep 2/6: Loading archetype template...");
  const template = loadTemplate(config.archetype);
  console.log(`  Template: ${template.archetype.name}`);
  console.log(`  Seeds per isotope: ${template.seeds.informational.length}`);

  // Step 3: Expand topics via Claude API
  console.log("\nStep 3/6: Expanding topics via Claude API...");
  const topics = await expandTopics(config, template);
  console.log(`  Generated ${topics.length} topics:`);
  const categoryCount: Record<string, number> = {};
  for (const t of topics) {
    categoryCount[t.category] = (categoryCount[t.category] ?? 0) + 1;
  }
  for (const [cat, count] of Object.entries(categoryCount)) {
    console.log(`    ${cat}: ${count}`);
  }

  // Step 4: Generate prompts via Claude API
  console.log("\nStep 4/6: Generating prompts...");
  const rawPrompts = await generateAllPrompts(
    topics,
    config,
    template,
    parseInt(opts.concurrency)
  );
  console.log(`  Generated ${rawPrompts.length} raw prompts`);

  // Step 5: Deduplicate
  console.log("\nStep 5/6: Deduplicating...");
  const { kept, removed } = deduplicatePrompts(rawPrompts);
  console.log(`  Kept: ${kept.length}, Removed: ${removed.length} duplicates`);

  // Stratified sample to target count
  const finalPrompts = stratifiedSample(
    kept,
    config.generation.targetPromptCount
  );
  console.log(`  Final count after sampling: ${finalPrompts.length}`);

  // Step 6: Write output
  console.log("\nStep 6/6: Writing output files...");
  const nestedPath = writeNestedLibrary(config, topics, finalPrompts);
  const flatPath = writeFlatLibrary(config, finalPrompts);
  console.log(`  Nested: ${nestedPath}`);
  console.log(`  Flat:   ${flatPath}`);

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n--- Generation Complete ---");
  console.log(`  Client: ${config.client.name}`);
  console.log(`  Topics: ${topics.length}`);
  console.log(`  Prompts: ${finalPrompts.length}`);
  console.log(`  Time: ${elapsed}s`);

  // Isotope distribution
  console.log("\n  Isotope distribution:");
  for (const isotope of ISOTOPE_TYPES) {
    const count = finalPrompts.filter((p) => p.isotope === isotope).length;
    console.log(`    ${isotope}: ${count}`);
  }

  // Category distribution
  console.log("\n  Category distribution:");
  const categories: FunnelCategory[] = ["Awareness", "Consideration", "Conversion"];
  for (const cat of categories) {
    const count = finalPrompts.filter((p) => p.category === cat).length;
    console.log(`    ${cat}: ${count}`);
  }

  // Sample prompts
  console.log("\n  Sample prompts:");
  const sampleIsotopes = [...ISOTOPE_TYPES];
  for (const isotope of sampleIsotopes.slice(0, 5)) {
    const sample = finalPrompts.find((p) => p.isotope === isotope);
    if (sample) {
      console.log(`    [${isotope}] ${sample.promptText}`);
    }
  }
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run typecheck**

Run: `cd generator && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run the generator for FTI Consulting**

Run: `cd generator && npx tsx src/generate.ts --config configs/fti-consulting.json`
Expected: Full pipeline runs, outputs to `generator/output/fti-consulting-prompt-library.json` and `generator/output/fti-consulting-top-250.json`

- [ ] **Step 4: Verify output files exist and look correct**

Run: `ls -la generator/output/`
Expected: Two JSON files for FTI Consulting

- [ ] **Step 5: Commit**

```bash
git add generator/src/generate.ts
git commit -m "feat: add main CLI entry point for prompt generation pipeline"
```

---

### Task 11: Run and Validate for FTI Consulting

**Files:**
- Read: `generator/output/fti-consulting-top-250.json`
- Read: `generator/output/fti-consulting-prompt-library.json`

- [ ] **Step 1: Run the generator**

Run: `cd generator && npx tsx src/generate.ts --config configs/fti-consulting.json`
Expected: Successful generation with ~250 prompts

- [ ] **Step 2: Validate the flat output**

Manually check:
- All 6 isotopes present
- All 3 funnel categories present
- No unresolved `{variable}` placeholders
- Comparative prompts mention competitor names
- No near-duplicate prompts
- Prompt count is close to 250

- [ ] **Step 3: Commit all output (if desired by user)**

```bash
git add generator/output/
git commit -m "feat: generate FTI Consulting prompt library (250 prompts)"
```
