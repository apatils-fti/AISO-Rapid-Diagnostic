---
description: "Validate an existing prompt library for quality and two-axis (intent × isotope) coverage. Usage: /aiso-prompt-library:validate-prompts <library-json-path>"
---

Validate an AISO prompt library file against quality standards.

## Instructions

1. Read the prompt library JSON file (the generator's flat output: `{ tier, totalPrompts, prompts, ... }`).

2. Run these validation checks:

### Structural checks
- [ ] File parses as valid JSON
- [ ] Has top-level fields: `tier`, `totalPrompts`, `prompts`
- [ ] Every prompt has fields `{promptId, topicId, topicName, category, promptText, isotope, intent_stage}`
- [ ] Every prompt has a non-empty `promptText` (min 10 characters)
- [ ] Every prompt has a valid `isotope`: one of `declarative`, `comparative`, `situated`, `constrained`, `adversarial`
- [ ] Every prompt has a valid `intent_stage`: one of `learning`, `discovery`, `evaluation`, `validation`, `acquisition`

### Two-axis distribution checks (flat allocation)
- [ ] All 5 isotopes present
- [ ] All 5 intent stages present
- [ ] No intent share exceeds **0.22** (flat expected: 0.20)
- [ ] No isotope share exceeds **0.22** (flat expected: 0.20)
- [ ] **Flat invariant:** `max(cells) - min(cells) <= 1`. Any larger spread is a bug in allocation or downstream filtering.
- [ ] No cell count deviates from `ceil(target/25)` by more than 1

### Quality checks
- [ ] Comparative prompts mention at least one brand name
- [ ] Situated prompts contain a role reference (e.g., "As a...", "for a...")
- [ ] Constrained prompts reference at least 2 attributes or a price point
- [ ] Adversarial prompts use skeptical framing (probing, challenging, "why shouldn't I", "what's the catch")
- [ ] No two prompts have Jaccard word similarity > 0.85
- [ ] No placeholder variables remain (no literal `{brand}`, `{competitor}`, etc.)

3. Output a report:

```
Validation Report: {filename}
Tier: {full|quick|exploratory}

Total prompts: {count}

Intent distribution (actual / expected 20% / delta from 20%):
  learning     {n}/{pct%}  /  20.0%  /  {delta}
  discovery    ...
  evaluation   ...
  validation   ...
  acquisition  ...

Isotope distribution (actual / expected 20% / delta from 20%):
  declarative  {n}/{pct%}  /  20.0%  /  {delta}
  comparative  ...
  situated     ...
  constrained  ...
  adversarial  ...

Cell coverage (5×5 matrix, count per cell):
               dec  cmp  sit  cst  adv
  learning     {n}  {n}  {n}  {n}  {n}
  discovery    ...
  evaluation   ...
  validation   ...
  acquisition  ...

Passed: {count} checks
Failed: {count} checks

{details with prompt IDs and suggested fixes}
```

### Coverage bias checks

- [ ] **Two-axis coverage** — No intent or isotope share exceeds 0.22. Flat invariant holds (`max(cells) - min(cells) <= 1`).
- [ ] **Topic concentration** — Flag any topic >15% of total as HIGH. 2–5% as LOW. <2% as CRITICAL.
- [ ] **Key topic coverage** — Read `topics` from the client config. Flag topics with <5 prompts as UNDER-REPRESENTED, 0 as MISSING.
- [ ] **Cell coverage per topic** — For topic-heavy runs, verify each topic has prompts spanning at least 3 intent stages.

4. If all checks pass, confirm the library is ready for deployment. If any fail, do not deploy — show the user what's wrong and suggest raising `targetPromptCount` to a multiple of 25 or adding more topics.
