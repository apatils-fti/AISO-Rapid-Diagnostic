# TODOS

## Prompt Library Generator

- [ ] Remove duplicate outer SKILL.md (keep inner skills/aiso-prompt-library/SKILL.md only)
  **Priority:** P1
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

## Collector

## Completed
