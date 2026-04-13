---
name: validate-prompts
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

### Two-axis distribution checks
- [ ] All 5 isotopes present
- [ ] All 5 intent stages present
- [ ] No intent share exceeds `(template.weights.intents[intent] + 0.10)`
- [ ] No isotope share exceeds `(template.weights.isotopes[isotope] + 0.10)`
- [ ] Every `(intent, isotope)` cell has at least `minPerCell` prompts for the declared tier (2 for `full`, 1 for `quick`, 0 for `exploratory`)

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

Intent distribution (actual / weight / delta):
  learning     {n}/{pct%}  /  {weight%}  /  {delta}
  discovery    ...
  evaluation   ...
  validation   ...
  acquisition  ...

Isotope distribution (actual / weight / delta):
  declarative  {n}/{pct%}  /  {weight%}  /  {delta}
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

- [ ] **Two-axis coverage** — No intent or isotope exceeds `(weight + 0.10)`. Every cell has ≥ tier-appropriate `minPerCell`.
- [ ] **Topic concentration** — Flag any topic >15% of total as HIGH. 2–5% as LOW. <2% as CRITICAL.
- [ ] **Key topic coverage** — Read `topics` from the client config. Flag topics with <5 prompts as UNDER-REPRESENTED, 0 as MISSING.
- [ ] **Cell coverage per topic** — For topic-heavy runs, verify each topic has prompts spanning at least 3 intent stages.

4. If all checks pass, confirm the library is ready for deployment. If any fail, do not deploy — show the user what's wrong and suggest raising `targetPromptCount`, adjusting weights, or adding topics.
