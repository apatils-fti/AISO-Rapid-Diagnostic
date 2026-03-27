---
name: validate-prompts
description: "Validate an existing prompt library for quality and completeness. Usage: /aiso-prompt-library:validate-prompts <library-json-path>"
---

Validate an AISO prompt library file against quality standards.

## Instructions

1. Read the prompt library JSON file (either nested `*-prompt-library.json` or flat `*-top-250.json`).

2. Run these validation checks:

### Structural checks
- [ ] File parses as valid JSON
- [ ] Flat format: array of objects with fields `{promptId, topicId, topicName, category, promptText, isotope}`
- [ ] Nested format: has `client`, `competitors`, `topics`, `metadata` top-level keys
- [ ] Every prompt has a non-empty `promptText` (min 10 characters)
- [ ] Every prompt has a valid `isotope` (one of: informational, commercial, comparative, persona, specific, conversational)

### Distribution checks
- [ ] All 6 isotope types present
- [ ] No single isotope accounts for more than 25% of total prompts
- [ ] All 3 funnel categories present (Awareness, Consideration, Conversion)
- [ ] No single category accounts for more than 50% of total topics

### Quality checks
- [ ] Comparative prompts mention at least one brand name
- [ ] Persona prompts contain a role reference (e.g., "As a...", "for a...")
- [ ] No two prompts have Jaccard word similarity > 0.85
- [ ] Prompt texts are between 10 and 300 characters
- [ ] No placeholder variables remain (no literal `{brand}`, `{competitor}`, etc.)

3. Output a report:

```
Validation Report: {filename}
---
Total prompts: {count}
Isotope distribution: informational={n}, commercial={n}, ...
Category distribution: Awareness={n}, Consideration={n}, Conversion={n}

Passed: {count} checks
Failed: {count} checks

{detail of each failure with specific prompt IDs and suggested fixes}
```

### Coverage bias checks

Tier 4 requires the client config to resolve keyTopics. Infer the config path by slugifying the client name from the library metadata and looking for `generator/configs/{slug}.json`. If the config cannot be found, skip Check #2 (Key Topic Coverage Gaps) and note it was skipped in the report.

- [ ] **Topic concentration bias** — Count prompts per `topicId`. Flag any topic with >15% of total prompts as `HIGH`. Flag any topic with 2-5% as `LOW`. Flag any topic with <2% as `CRITICAL`. Flag if top 3 topics combined account for >40% of all prompts.
- [ ] **Key topic coverage gaps** — Read `keyTopics` from the client config. For each key topic, count prompts whose `topicName` references it. Flag key topics with <5 prompts as `UNDER-REPRESENTED`. Flag key topics with 0 prompts as `MISSING`. Output coverage score: `(keyTopics with 5+ prompts) / (total keyTopics) * 100`.
- [ ] **Isotope coverage per topic** — For each topic, verify all 6 isotope types are represented. Flag any topic missing an isotope type entirely.

Append this section to the validation report output:

```
Coverage Bias Report
────────────────────
Key topic coverage: X/Y topics adequately covered (Z%)

Topic prompt distribution:
  Restructuring         ████████████ 47 prompts (18.8%) ⚠ HIGH
  Technology Transform  ████ 18 prompts (7.2%)
  Economic Consulting   ██ 8 prompts (3.2%) ⚠ LOW
  Corp Finance Advisory █ 4 prompts (1.6%) ⚠ CRITICAL

Under-represented topics (< 5 prompts):
  ⚠ Corporate Finance Advisory — 4 prompts
  ✗ Transactions Advisory — 0 prompts (MISSING)

Isotope gaps:
  ⚠ Economic Consulting — missing: conversational

Thresholds:
  - > 15% of prompts on one topic = HIGH (concentration bias)
  - 2-5% of prompts on one topic = LOW
  - < 2% of prompts on one topic = CRITICAL
  - < 5 prompts on a key topic = under-represented
  - 0 prompts on a key topic = missing

Recommendation:
  Add missing topics to keyTopics in client config and regenerate.
  Or run targeted generation for missing topics and merge outputs.
```

4. If all checks pass, confirm the library is ready for deployment.
