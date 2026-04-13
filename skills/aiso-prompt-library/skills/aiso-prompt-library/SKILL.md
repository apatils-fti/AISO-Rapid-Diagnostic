---
description: "Generate, validate, and deploy AISO prompt libraries using the 5×5 intent × isotope taxonomy. Trigger when: user asks to create a prompt library, generate prompts for a new client, add an archetype, or validate prompt quality."
---

# AISO Prompt Library Generator

Generates prompt libraries for the AISO Rapid Diagnostic using archetype templates + Claude API enrichment. The taxonomy is **5 intent stages × 5 isotopes = 25 cells per topic**.

## Taxonomy

### Intent stages (5) — what the buyer is trying to do

| Stage | Meaning |
|---|---|
| `learning` | Building a mental model, seeking foundational understanding |
| `discovery` | Exploring what options exist, building a consideration set |
| `evaluation` | Comparing alternatives, applying criteria to filter options |
| `validation` | Seeking reassurance, stress-testing a near-decision |
| `acquisition` | Ready to act, seeking the path to purchase or engage |

### Isotopes (5) — how the question is asked

| Isotope | Meaning |
|---|---|
| `declarative` | Direct statement of need. No persona, comparison, or constraint. |
| `comparative` | Two or more options explicitly named; forces the AI to choose. |
| `situated` | Query filtered through a specific role, identity, or context. |
| `constrained` | Multi-attribute query with explicit filters (price, attributes, timing). |
| `adversarial` | Stress-test framing; probes weaknesses, hidden costs, quality decline. |

## Quick Start

```bash
cd generator
npm install
npm run generate -- --config configs/jcrew.json --out output/jcrew-prompt-library.json
```

## Generating a Library for a New Client

### Step 1: Create a client config

Create `generator/configs/{client-slug}.json`.

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `brand` | string | Client brand name, used as `{brand}` |
| `competitor` | string | Primary competitor, used as `{competitor}` |
| `archetype` | string | Must match a file in `generator/templates/` |
| `targetPromptCount` | integer | Total prompts desired |
| `topics` | `{id, name, category}[]` | Min 5 |
| `personas` | string[] | Min 2 |
| `attributes` | string[] | Min 2 |
| `pricePoints` | string[] | Min 1 |
| `contexts` | string[] | Min 1 |

### Step 2: Choose an archetype

Available templates in `generator/templates/`:

| Template | Sectors | Dominant Intent | Dominant Isotopes |
|---|---|---|---|
| `transactional-commerce` | DTC apparel, retail, consumer goods | discovery + acquisition | declarative, comparative |
| `trust-based-advisory` | Financial, legal, wealth, insurance | evaluation + validation | situated |
| `b2b` | Enterprise SaaS, devtools, services | evaluation | constrained |
| `digital-media` | Streaming, publications, podcasts | learning + discovery | declarative |
| `local-experiences` | Restaurants, venues, studios, tours | acquisition | situated + constrained |

Each template defines its own `weights.intents` and `weights.isotopes` that sum to 1.0. The generator uses these weights to determine how many prompts to produce per cell in the 5×5 matrix.

### Step 3: Pick a target prompt count

Three run tiers based on `targetPromptCount` vs the template's floors:

| Tier | Condition | minPerCell | Coverage check | Output label |
|---|---|---|---|---|
| `full` | `targetPromptCount ≥ minPromptCount` | 2 | strict (error on violation) | production |
| `quick` | `quickRunMinimum ≤ targetPromptCount < minPromptCount` | 1 | warn-only | indicative |
| `exploratory` | `targetPromptCount < quickRunMinimum` | 0 | skipped | exploratory |

**Per-archetype floors** (computed as `ceil(2 / (min_intent × min_isotope))`):

| Archetype | `minPromptCount` | `quickRunMinimum` |
|---|---|---|
| transactional-commerce | 134 | 67 |
| trust-based-advisory | 267 | 134 |
| b2b | 267 | 134 |
| digital-media | 267 | 134 |
| local-experiences | 267 | 134 |

If your target is below the full-tier floor, the output is labeled `indicative` or `exploratory` and downstream consumers should treat it as a directional signal, not a production diagnostic.

### Step 4: Run the generator

```bash
cd generator
npm run generate -- --config configs/your-client.json --out output/your-client-library.json
```

**Pipeline:**
1. Zod-validate the archetype template (weights sum to 1.0, all 25 cells populated, minPromptCount consistent with weights).
2. Tag topics with a primary intent stage using ceiling allocation against `weights.intents`.
3. Fill the 5×5 cell matrix per archetype using stratified allocation: `count = max(ceil(intent_w × isotope_w × target), minPerCell)`.
4. For each cell, draw seeds and fill template variables (`{brand}`, `{competitor}`, `{persona}`, `{topicName}`, `{category}`, `{pricePoint}`, `{context}`, `{attribute1}`, `{attribute2}`, `{current_year}`).
5. Deduplicate by Jaccard similarity > 0.85.
6. Run the two-axis coverage bias check.
7. Write JSON output.

## Adding a New Archetype

Create `generator/templates/{archetype-id}.json` with this shape:

```json
{
  "archetype": {
    "id": "your-archetype",
    "name": "Your Archetype Name",
    "description": "...",
    "sectors": ["..."],
    "primaryFocus": ["..."],
    "promptEmphasis": "..."
  },
  "weights": {
    "intents": {
      "learning": 0.10, "discovery": 0.25, "evaluation": 0.20,
      "validation": 0.20, "acquisition": 0.25
    },
    "isotopes": {
      "declarative": 0.25, "comparative": 0.20, "situated": 0.20,
      "constrained": 0.20, "adversarial": 0.15
    }
  },
  "minPromptCount": 134,
  "quickRunMinimum": 67,
  "seeds": {
    "learning":    { "declarative": [...], "comparative": [...], "situated": [...], "constrained": [...], "adversarial": [...] },
    "discovery":   { ... },
    "evaluation":  { ... },
    "validation":  { ... },
    "acquisition": { ... }
  }
}
```

**Requirements:**
- Both weight blocks must sum to 1.0 (±0.001).
- All 25 cells (5 intents × 5 isotopes) must be populated with ≥3 seeds each (5 recommended).
- `minPromptCount` must satisfy `ceil(2 / (min_intent × min_isotope))`.
- `quickRunMinimum < minPromptCount`.
- Seeds use only the approved variables: `{brand}`, `{competitor}`, `{persona}`, `{topicName}`, `{category}`, `{pricePoint}`, `{context}`, `{attribute1}`, `{attribute2}`, `{current_year}`.

## Output Schema

Flat output: `{ tier, totalPrompts, warnings, errors, stats, coverage, prompts: FlatPrompt[] }`.

Each `FlatPrompt`:

```typescript
{
  promptId: string;
  topicId: string;
  topicName: string;
  category: string;
  promptText: string;       // fully filled, no placeholders
  isotope: Isotope;         // new 5-value axis
  intent_stage: IntentStage; // new 5-value axis
}
```

## Quality Validation Checklist

After generating, verify:

1. **Tier label** — matches your target vs template floors.
2. **Total count** — `output.totalPrompts` equals your target (after dedup).
3. **Two-axis coverage** — no intent or isotope exceeds `(weight + 0.10)`. Every cell ≥ minPerCell for the tier.
4. **No unfilled placeholders** — every `promptText` has zero `{...}` patterns for core variables.
5. **Dedup** — Jaccard similarity < 0.85 across all pairs.
6. **Intent + isotope present** — every prompt has both `isotope` and `intent_stage` set.

Run `/validate-prompts` for the full Tier 4 coverage bias audit.
