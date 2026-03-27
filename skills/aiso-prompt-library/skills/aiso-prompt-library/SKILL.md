---
description: "Generate, validate, and deploy AISO prompt libraries for AI search optimization diagnostics. Trigger when: user asks to create a prompt library, generate prompts for a new client, add an archetype, or validate prompt quality."
---

# AISO Prompt Library Generator

Generates prompt libraries for the AISO Rapid Diagnostic using archetype templates + Claude API enrichment.

## Quick Start

```bash
cd generator
npm install
npx tsx src/generate.ts --config configs/jcrew.json
```

Output files appear in `generator/output/`:
- `{client}-prompt-library.json` — nested format for the collector
- `{client}-top-250.json` — flat format for dashboard batch scripts

## Setup

Requires `ANTHROPIC_API_KEY`. Set it as an env var or ensure it exists in `dashboard/.env.local`.

```bash
cd generator && npm install
```

## Generating a Prompt Library for a New Client

### Step 1: Create a client config

Create `generator/configs/{client-slug}.json`. All fields are validated by Zod at runtime.

**Required fields:**

| Field | Type | Constraint |
|-------|------|-----------|
| `client.name` | string | Non-empty |
| `client.domains` | string[] | Min 1 |
| `client.industry` | string | Non-empty |
| `competitors` | {name, domains}[] | Min 2 |
| `archetype` | string | Must match a template filename in `generator/templates/` |
| `generation.targetPromptCount` | integer | Min 10, default 250 |
| `generation.topicsPerCategory` | {Awareness, Consideration, Conversion} | All 3 required, each >= 1 |
| `keyTopics` | string[] | Min 5 |
| `personas` | string[] | Min 2 |
| `pricePoints` | string[] | Min 1 |
| `contexts` | string[] | Min 1 |
| `attributes` | string[] | Min 1 |

**Example config:**

```json
{
  "client": { "name": "Acme Corp", "domains": ["acme.com"], "industry": "saas-software" },
  "competitors": [
    { "name": "Competitor A", "domains": ["compa.com"] },
    { "name": "Competitor B", "domains": ["compb.com"] }
  ],
  "archetype": "b2b",
  "generation": {
    "targetPromptCount": 250,
    "topicsPerCategory": { "Awareness": 15, "Consideration": 12, "Conversion": 18 }
  },
  "keyTopics": ["Cloud Security", "DevOps Automation", "API Gateway", "Observability", "CI/CD"],
  "personas": ["CTO", "DevOps engineer", "security analyst"],
  "pricePoints": ["500", "1000", "5000"],
  "contexts": ["enterprise deployment", "startup scaling"],
  "attributes": ["SOC2 compliant", "self-hosted", "API-first"]
}
```

### Step 2: Choose an archetype

Available templates in `generator/templates/`:

| Template | Sectors | Focus |
|----------|---------|-------|
| `transactional-commerce` | Retail, eCommerce, DTC | Product recommendations, purchase intent |
| `digital-media` | News, Publishing, Streaming | Content visibility, source credibility |
| `trust-based-advisory` | Finance, Healthcare, Legal | Domain authority, trust signals |
| `b2b` | Enterprise SW, Manufacturing | Vendor evaluation, category leadership |
| `local-experiences` | Hospitality, Restaurants | Local discovery, bookings |

Each template provides seed prompts for 6 isotope types:
- **informational** — "What is X" educational queries
- **commercial** — "Best X" buying/evaluation intent
- **comparative** — "X vs Y" head-to-head comparisons
- **persona** — "As a [role]..." targeted queries
- **specific** — Narrow 2-3 constraint queries (price, feature, context)
- **conversational** — Casual, natural-language style

### Step 3: Optimal sizing

Use this formula for `topicsPerCategory` based on target prompt count:

```
topics_needed = ceil(targetPromptCount / 6)
```

Since each topic generates 6 prompts (one per isotope), distribute `topics_needed` across funnel stages. Recommended ratios:

| Target | Awareness | Consideration | Conversion | Total Topics |
|--------|-----------|---------------|------------|-------------|
| 150 | 10 | 8 | 7 | 25 |
| 250 | 15 | 12 | 18 | 45 |
| 350 | 20 | 17 | 22 | 59 |
| 500 | 28 | 25 | 32 | 85 |

After generation, deduplication removes ~2-5% and stratified sampling trims to `targetPromptCount`.

### Step 4: Run the generator

```bash
cd generator
npx tsx src/generate.ts --config configs/your-client.json
```

**Pipeline steps:**
1. Validate config and load archetype template
2. Expand seed topics via Claude API -> full topic list
3. Generate 6 prompts per topic (one per isotope) via Claude API
4. Assemble nested library, deduplicate (Jaccard > 0.85)
5. Convert to flat format, stratified sample to target count
6. Write local JSON files (backup)
7. Write to Supabase (if configured — fail-safe)

### Step 5: Deploy the output

```bash
# Copy to collector (for Perplexity/ChatGPT collection)
cp generator/output/{client}-prompt-library.json collector/prompts/

# Copy to dashboard (for batch scripts)
cp generator/output/{client}-top-250.json dashboard/scripts/top-250-prompts.json
```

Run batch scripts with Supabase persistence:
```bash
cd dashboard/scripts
node batch-claude-check.js --client-id <id> --library-id <id>
node batch-gemini-check.js --client-id <id> --library-id <id>
```

## Supabase Integration

The generator writes to Supabase automatically when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `dashboard/.env.local`. This is fail-safe — if Supabase is unavailable, local JSON files still work.

**Tables used:**
- `clients` — client records (upserted by name)
- `archetype_templates` — template definitions (upserted by archetype_id)
- `prompt_libraries` — library metadata per generation run
- `prompts` — individual prompts linked to a library
- `runs` — batch collection runs per platform
- `results` — individual prompt results per run

## Adding a New Archetype

1. Create `generator/templates/{archetype-id}.json`:

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
  "seeds": {
    "informational": ["seed with {variables}...", ...],
    "commercial": [...],
    "comparative": [...],
    "persona": [...],
    "specific": [...],
    "conversational": [...]
  }
}
```

2. Seeds use placeholders: `{brand}`, `{competitor}`, `{persona}`, `{topicName}`, `{currentYear}`, `{pricePoint}`, `{context}`, `{attribute1}`, `{attribute2}`.

3. Minimum 3 seeds per isotope (5+ recommended for diversity).

4. All 6 isotopes must be present: informational, commercial, comparative, persona, specific, conversational.

5. Reference the archetype ID in client configs via the `archetype` field.

## Quality Validation Checklist

After generating a library, verify:

1. **Prompt count** — flat output has exactly `targetPromptCount` entries
2. **Isotope distribution** — all 6 types present, roughly even
3. **Topic coverage** — all 3 funnel stages (Awareness, Consideration, Conversion) represented
4. **Brand mentions** — comparative prompts include client name + competitor
5. **No duplicates** — deduplication should keep Jaccard similarity < 0.85
6. **Format match** — flat output matches `FlatPrompt` schema: `{promptId, topicId, topicName, category, promptText, isotope}`
7. **Coverage bias** — Run `/validate-prompts` with Tier 4 coverage bias check to confirm all keyTopics from the client config have at least 5 prompts. Flag and regenerate if any topic is missing or under-represented.
