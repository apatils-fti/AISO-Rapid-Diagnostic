---
name: generate-prompts
description: "Generate a prompt library for a client using the 5×5 intent × isotope taxonomy. Usage: /aiso-prompt-library:generate-prompts <client-config-path>"
---

Generate an AISO prompt library from a client configuration file.

## Instructions

1. Read the client config file provided as an argument (or prompt the user for one if not given).

2. Validate the config against the required schema:
   - `brand` — non-empty string
   - `competitor` — non-empty string
   - `archetype` — must match a file in `generator/templates/`
   - `targetPromptCount` — integer > 0
   - `topics` — at least 5 entries, each with `{id, name, category}`
   - `personas` — at least 2
   - `attributes` — at least 2
   - `pricePoints` — at least 1
   - `contexts` — at least 1

3. If validation fails, show the user what's missing and suggest fixes.

4. Check the tier against the chosen archetype's `minPromptCount` and `quickRunMinimum`:
   - If `targetPromptCount ≥ minPromptCount`: tier=`full`, production output.
   - If `quickRunMinimum ≤ targetPromptCount < minPromptCount`: tier=`quick`, output labeled `indicative`.
   - If `targetPromptCount < quickRunMinimum`: tier=`exploratory`, coverage claims disabled. Warn the user.

5. Run the generator:

```bash
cd generator && npm run generate -- --config configs/<config-file>.json --out output/<client>-library.json
```

6. After generation completes, show:
   - **Tier label** (full / quick / exploratory)
   - **Total prompts** after dedup
   - **Intent distribution** — 5 stages with actual vs weight
   - **Isotope distribution** — 5 isotopes with actual vs weight
   - **Cell counts** — 5×5 matrix of prompts per `(intent, isotope)` cell
   - **Coverage bias report** — pass/fail with any errors or warnings
   - **Sample prompts** — 5 prompts drawn from different cells

7. If coverage bias check returns errors, do not deploy. Show the user the errors and suggest raising `targetPromptCount` or adjusting archetype weights.
