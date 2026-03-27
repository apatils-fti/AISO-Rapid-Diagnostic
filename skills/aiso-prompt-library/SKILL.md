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
npm install
```

## Generating a Prompt Library for a New Client

### 1. Create a client config

Copy `configs/jcrew.json` and modify:

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
  "keyTopics": ["Cloud Security", "DevOps Automation", ...],
  "personas": ["CTO", "DevOps engineer", "security analyst", ...],
  "pricePoints": ["500", "1000", "5000"],
  "contexts": ["enterprise deployment", "startup scaling", ...],
  "attributes": ["SOC2 compliant", "self-hosted", "API-first", ...]
}
```

### 2. Choose an archetype

Available templates in `templates/`:

| Template | Sectors | Focus |
|----------|---------|-------|
| `transactional-commerce` | Retail, eCommerce, DTC | Product recommendations, purchase intent |
| `digital-media` | News, Publishing, Streaming | Content visibility, source credibility |
| `trust-based-advisory` | Finance, Healthcare, Legal | Domain authority, trust signals |
| `b2b` | Enterprise SW, Manufacturing | Vendor evaluation, category leadership |
| `local-experiences` | Hospitality, Restaurants | Local discovery, bookings |

### 3. Run the generator

```bash
npx tsx src/generate.ts --config configs/your-client.json
```

### 4. Deploy the output

```bash
# Copy to collector (for Perplexity/ChatGPT collection)
cp output/{client}-prompt-library.json ../collector/prompts/

# Copy to dashboard (for Claude/Gemini/Google batch scripts)
cp output/{client}-top-250.json ../dashboard/top-250-prompts.json
```

Then run batch scripts as usual:
```bash
cd ../dashboard && node scripts/batch-claude-check.js
```

## Adding a New Archetype

1. Create `templates/{archetype-id}.json` with the structure:

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
    "informational": ["seed template with {variables}...", ...],
    "commercial": [...],
    "comparative": [...],
    "persona": [...],
    "specific": [...],
    "conversational": [...]
  }
}
```

2. Seeds use `{variable}` placeholders: `{brand}`, `{competitor}`, `{persona}`, `{topicName}`, `{currentYear}`, `{pricePoint}`, `{context}`, `{attribute1}`, `{attribute2}`.

3. Provide at least 5 seeds per isotope for good style diversity.

4. Reference the archetype ID in client configs via the `archetype` field.
