---
name: generate-prompts
description: "Generate a prompt library for a client. Usage: /aiso-prompt-library:generate-prompts <client-config-path>"
---

Generate an AISO prompt library from a client configuration file.

## Instructions

1. Read the client config file provided as an argument (or prompt the user for one if not given).

2. Validate the config against the required schema:
   - `client.name`, `client.domains` (min 1), `client.industry` — required
   - `competitors` — at least 2 entries with `{name, domains}`
   - `archetype` — must match a file in `generator/templates/`
   - `generation.targetPromptCount` — integer >= 10
   - `generation.topicsPerCategory` — Awareness, Consideration, Conversion all required
   - `keyTopics` — at least 5
   - `personas` — at least 2
   - `pricePoints`, `contexts`, `attributes` — at least 1 each

3. If validation fails, show the user what's missing and suggest fixes.

4. If validation passes, run the generator:

```bash
cd generator && npx tsx src/generate.ts --config configs/<config-file>.json
```

5. After generation completes, show:
   - Total prompts generated (nested) and final count (flat)
   - Isotope distribution breakdown
   - Topic count per funnel stage
   - Supabase write status (saved / skipped / failed)
   - Sample of 5 prompts across different isotopes

6. Remind the user of deployment steps:
   - Copy nested output to `collector/prompts/`
   - Copy flat output to `dashboard/scripts/top-250-prompts.json`
   - Run batch scripts with `--client-id` and `--library-id` flags if Supabase is configured
