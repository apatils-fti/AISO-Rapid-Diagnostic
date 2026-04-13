# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0.0] - 2026-04-13

### Added
- **New 5×5 intent × isotope taxonomy** for AISO prompt generation. Intents: learning, discovery, evaluation, validation, acquisition. Isotopes: declarative, comparative, situated, constrained, adversarial.
- **`generator/` workspace** — standalone TypeScript subsystem with `package.json`, `tsconfig.json`, and vitest. Zod schema validation, ceiling-based stratified allocation, two-axis coverage bias checking, Jaccard deduplication.
- **625 hand-written seed prompts** across 5 archetype templates (125 seeds each: 25 cells × 5 seeds). Every seed tuned to its archetype's buyer voice, intent stage, and isotope style.
- **Per-archetype run tiers** — `full` (≥ minPromptCount, strict coverage check), `quick` (≥ quickRunMinimum, warn-only, output labeled indicative), `exploratory` (below floor, no coverage claim).
- **67 unit tests** across `validate.test.ts`, `generate.test.ts`, `utils.test.ts`, and `seeds.test.ts` covering weight sums, cell allocation, distribution constraints, dedup, and coverage bias.
- **`dashboard/scripts/backfill-intent.js`** — best-effort classifier that labels existing Supabase prompts with `intent_stage` using Claude. Dry-run mode, idempotent writes, high-confidence-only gating.
- **CLI entry point** at `generator/bin/generate.ts` — reads a client config, emits a validated library JSON with tier-aware coverage stats.

### Changed
- **Rewrote `skills/aiso-prompt-library/` files** — `SKILL.md`, `generate-prompts/SKILL.md`, `validate-prompts/SKILL.md`, and `agents/prompt-library-generator.md` all updated to the 5×5 taxonomy and the run-tier model.
- Replaced the old 6-isotope axis (informational/commercial/comparative/persona/specific/conversational) with the new 5-isotope axis in all generator-side artifacts. Dashboard, fixtures, and existing Supabase isotope data are deliberately untouched — those migrate in a future sprint.

### Removed
- **Duplicate outer `skills/aiso-prompt-library/SKILL.md`** — resolves TODOS.md P1. Single source of truth is now `skills/aiso-prompt-library/skills/aiso-prompt-library/SKILL.md`.

### Migration notes
- New Supabase column (nullable, non-destructive): `ALTER TABLE prompts ADD COLUMN IF NOT EXISTS intent_stage text;` and same for `results`. Run manually before invoking the backfill script.
- Dashboard components, fixtures, and `IsotopeType` union remain on the legacy 6-isotope taxonomy. A future sprint will migrate them and remap existing `results.isotope` values.

## [0.1.0.0] - 2026-03-27

### Added
- AISO Prompt Library plugin with 3 skills: reference (`aiso-prompt-library`), interactive generation (`generate-prompts`), and quality validation (`validate-prompts`)
- Autonomous prompt library generator agent for end-to-end pipeline execution
- 5 archetype templates: transactional-commerce, digital-media, trust-based-advisory, b2b, local-experiences
- 6 isotope types per prompt: informational, commercial, comparative, persona, specific, conversational
- Tier 4 coverage bias validation: topic concentration bias, key topic coverage gaps, isotope coverage per topic
- Plugin README with installation instructions, component overview, and archetype catalog
