# AISO Prompt Library Plugin

Claude Code plugin for generating, validating, and deploying AISO prompt libraries for AI search optimization diagnostics.

## Installation

```bash
claude plugin add /path/to/aiso-prompt-library
```

Or symlink into your project:
```bash
ln -s /path/to/aiso-prompt-library .claude/plugins/aiso-prompt-library
```

## Components

### Skill: `aiso-prompt-library`
Auto-invoked when you ask Claude to generate prompts, create a client config, or work with archetype templates. Contains the full reference for the generator pipeline, config schema, archetype catalog, and Supabase integration.

### Command: `/generate-prompts`
Interactive prompt library generation. Validates your config, runs the generator, and shows results.

```
/aiso-prompt-library:generate-prompts configs/acme.json
```

### Command: `/validate-prompts`
Quality validation for existing prompt libraries. Checks structure, distribution, duplicates, and template variable resolution.

```
/aiso-prompt-library:validate-prompts output/acme-top-250.json
```

### Agent: `prompt-library-generator`
Autonomous end-to-end pipeline. Give it a client brief and it builds the config, generates prompts, validates output, and deploys.

## Archetypes

| ID | Sectors | Focus |
|----|---------|-------|
| `transactional-commerce` | Retail, eCommerce, DTC | Product recs, purchase intent |
| `digital-media` | News, Publishing, Streaming | Content visibility, source credibility |
| `trust-based-advisory` | Finance, Healthcare, Legal | Domain authority, trust signals |
| `b2b` | Enterprise SW, Manufacturing | Vendor evaluation, category leadership |
| `local-experiences` | Hospitality, Restaurants | Local discovery, bookings |

## Isotope Types

Each prompt is classified into one of 6 isotopes:

1. **informational** — educational "what is X" queries
2. **commercial** — "best X" evaluation intent
3. **comparative** — "X vs Y" head-to-head
4. **persona** — "as a [role]" targeted queries
5. **specific** — narrow multi-constraint queries
6. **conversational** — casual natural-language style

## Requirements

- Node.js 18+
- `ANTHROPIC_API_KEY` environment variable
- Optional: Supabase credentials in `dashboard/.env.local` for persistence
