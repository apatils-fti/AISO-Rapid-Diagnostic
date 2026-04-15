# GitHub Actions Secrets

Secrets required by the workflows in `.github/workflows/`. Add these in the repo
settings at **Settings → Secrets and variables → Actions → New repository secret**.

## Currently used by `daily-collection.yml`

These six secrets are required for the nightly collection workflow. Missing
any of them will cause the workflow to fail loudly.

| Secret | Required | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | [console.anthropic.com → API Keys](https://console.anthropic.com/settings/keys). Used by `dashboard/src/app/api/claude/route.ts` when the batch runner POSTs to `/api/claude`. |
| `GEMINI_API_KEY` | yes | [aistudio.google.com → Get API key](https://aistudio.google.com/app/apikey). Used by `dashboard/src/app/api/gemini/route.ts`. |
| `PERPLEXITY_API_KEY` | yes | [perplexity.ai → API Settings](https://www.perplexity.ai/settings/api). Used by `dashboard/scripts/batch-perplexity-check.js` which calls Perplexity's `/chat/completions` endpoint directly (no localhost route). Free-tier accounts work; runner uses 3500ms delay between requests. |
| `OPENAI_API_KEY` | yes | [platform.openai.com → API keys](https://platform.openai.com/api-keys). Used by `dashboard/scripts/batch-chatgpt-check.js` which calls OpenAI's `/v1/chat/completions` endpoint directly (no localhost route). Runner uses `gpt-4o-mini` for cost efficiency (~$0.30/month vs ~$9/month with `gpt-4o`). |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project → Settings → API → Project URL. `onboard-client.js` uses it to look up the `clients` row and verify run results. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase project → Settings → API → `service_role` key. Server-side write access; never expose this client-side. |

## Stored but not yet used (future work)

These secrets are already added to the GitHub repo but the workflow does not
reference them yet. They exist to unblock future sprints — see `TODOS.md`.

| Secret | Intended use |
|---|---|
| `SERPAPI_KEY` | Reserved for Google AI Overviews via SerpAPI. `batch-google-check.js` exists but is not chained into `onboard-client.js`. P2 TODO. |

When that sprint lands, add the corresponding key to the workflow `env:` block
and update the "Currently used" table above.

## How the workflow uses these

The workflow starts a Next.js dev server in the background (see
`daily-collection.yml`), then runs `node scripts/onboard-client.js`. The Next.js
server reads the Anthropic/Gemini keys directly from `process.env`. The Supabase
values are used both by the Next.js server (for future server-side writes) and
by `onboard-client.js` itself for verification lookups.

## Security caveats

- **Never commit these values to the repo.** Only add them through the GitHub
  Secrets UI. This file documents them by name and description only.
- **Service role keys bypass Row Level Security.** Only use
  `SUPABASE_SERVICE_ROLE_KEY` in trusted server contexts — never in client-side
  code or log it.
- **Rotate keys periodically.** The Anthropic and Gemini keys in particular
  should be rotated every 90 days as a baseline practice.

## Local development

For local runs (`npm run dev` in `dashboard/` and running
`node scripts/onboard-client.js` on your laptop), put the same values in
`dashboard/.env.local`. The script loads `.env.local` if present, and falls
through to `process.env` if not, so the same code path works in both CI and dev.

## Caveats about `configs/fti.json`

The nightly workflow passes `--config configs/fti.json --skip-generate`. The
`configs/fti.json` file in this repo is the **old-format** client config (with
`generation.topicsPerCategory` funnel stages and 6-isotope assumptions). The
new 5×5 generator at `generator/bin/generate.ts` would not parse this file
as-is.

This is deliberately tolerated because `--skip-generate` means the generator
is never invoked. `onboard-client.js` only reads `client.name` from this file
(at line ~135) to look up the Supabase client row. That one field exists in
both the old and new formats.

When a future sprint migrates the generator to the new schema end-to-end,
this config file needs to be rewritten to the new shape. Tracked as a TODO.
