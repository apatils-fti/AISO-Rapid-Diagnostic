# @aiso/prompt-generator

Generates AISO prompt libraries from archetype templates using a 5×5 intent × isotope taxonomy.

## Taxonomy

**Intents (5):** `learning`, `discovery`, `evaluation`, `validation`, `acquisition`

**Isotopes (5):** `declarative`, `comparative`, `situated`, `constrained`, `adversarial`

Each archetype template defines weights over both axes. The generator fills a 5×5 matrix per topic using ceiling-based stratified allocation, then emits flat prompt objects with both `isotope` and `intent_stage` fields.

## Run tiers

| Tier | Prompt count | minPerCell | Coverage check |
|---|---|---|---|
| `full` | ≥ `minPromptCount` | 2 | strict (error on violation) |
| `quick` | ≥ `quickRunMinimum`, < `minPromptCount` | 1 | warn-only |
| `exploratory` | < `quickRunMinimum` | 0 | no check, output labeled `exploratory` |

## Commands

```bash
bun install
bun run test
bun run generate -- --config path/to/client.json --archetype transactional-commerce
```
