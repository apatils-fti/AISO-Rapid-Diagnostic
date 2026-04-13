# TODOS

## Prompt Library Generator

- [x] Remove duplicate outer SKILL.md (keep inner skills/aiso-prompt-library/SKILL.md only)
  **Priority:** P1 — done as part of the 5×5 taxonomy refactor
- [ ] Fix sizing formula/table mismatch: ceil(250/6)=42 but table says 45 topics
  **Priority:** P2
- [ ] Specify slugification algorithm in validate-prompts skill (lowercase, hyphens, strip special chars)
  **Priority:** P2
- [ ] Add input sanitization guidance for template variable values (JSON-breaking chars, prompt injection)
  **Priority:** P2
- [ ] Add agent retry cap: stop after 2 consecutive generator failures instead of looping to maxTurns
  **Priority:** P2
- [ ] Namespace deployment target: `{client}-top-250-prompts.json` instead of overwriting shared file
  **Priority:** P2
- [ ] Review 300-char prompt length upper bound (persona/specific prompts may exceed)
  **Priority:** P3
- [ ] Consider removing redundant isotope distribution check (even by construction)
  **Priority:** P4

## Dashboard

- [ ] Add detailed metric breakdowns to /metrics page (v2 scope): sentiment distribution chart, topic dominance table, high vs low intent comparison, CTA examples, recommendation strength distribution, comparative win/loss analysis
  **Priority:** P2
- [ ] Phase 2 Supabase migration: Topics, Competitors, Gap Analysis, Prompt Detail pages. Phase 1 (Compare Platforms + Overview + client selector) ships first. Requires competitor_mentions JSONB column to be backfilled. Each page swaps fixture imports for db.ts query functions.
  **Priority:** P2
- [ ] PDF Report Export: Download button on executive view generating branded PDF with four-pillar scores, sentiment, competitor comparison. Consulting clients expect deliverables. Depends on combined Overview/Metrics view.
  **Priority:** P2
- [ ] Competitive Gap Alerts: Post-batch-run summary showing biggest competitive gaps. Console output + optional webhook. Turns passive dashboard into proactive intelligence.
  **Priority:** P3

## Collector

## Completed
