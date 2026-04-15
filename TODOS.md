# AISO Rapid Diagnostic — V2 Roadmap & Deferred Work

**Version**: 1.0.0
**Status**: V1 shipped, V2 planning
**Last Updated**: 2026-03-16

---

## 🎯 V1 Status: SHIPPED ✅

See `V1_SHIPPING_READINESS.md` for complete shipping documentation.

**What shipped in V1**:
- ✅ Data collection pipeline (Perplexity + ChatGPT Search)
- ✅ Analysis engine (citation + mention metrics)
- ✅ Dashboard with 5 views (Executive, Topics, Competitors, Gap Analysis, Prompts)
- ✅ 1,313-prompt library for fashion/apparel
- ✅ Citations/Mentions toggle across all views
- ✅ Client configuration system (J.Crew + 5 competitors)

---

## 🔮 V2 Roadmap — Deferred Features

### Priority 1: Browser Automation (Fara-7B)

**Problem**: API responses ≠ what users actually see in web UI
- Perplexity API returns structured citation lists
- Perplexity web UI shows featured snippets, image results, visual ranking
- API may miss "Related" sections, answer box content, sponsored results

**Solution**: Use Fara-7B (vision-language model) + Ollama for browser automation

**Technical Approach**:
1. **Install Ollama** on collection machine
2. **Pull Fara-7B model**: `ollama pull fara-7b`
3. **Add Playwright** to collector for headless browsing
4. **Capture screenshots** of Perplexity.ai results page for each prompt
5. **Use Fara-7B** to parse screenshots:
   - Extract brand mentions from visual content
   - Identify positioning (answer box, citation #1, "Related", etc.)
   - Capture image results, featured snippets
6. **Compare API vs UI**:
   - Citation lists (API) vs visual prominence (UI)
   - Structured data vs user experience
   - Document discrepancies

**Implementation Files**:
- `collector/src/platforms/perplexity-browser.ts` (new)
- `collector/src/vision-parser.ts` (new — Fara-7B integration)
- `dashboard/src/components/compare/ApiVsUiComparison.tsx` (new view)

**Complexity**: High
**Estimated Effort**: 2-3 weeks
**Dependencies**: Ollama, Playwright, Fara-7B model, screenshot storage

**Blocked by**: PMF validation — need to prove API-only data is insufficient first

---

### Priority 2: Additional AI Platforms

**Currently supported**:
- ✅ Perplexity Sonar
- ✅ ChatGPT Search

**To add**:

#### 2.1 Google AI Overviews
**Status**: No public API available yet
**Workaround**: Browser automation required (Fara-7B dependency)
**Complexity**: High
**Effort**: 1-2 weeks after Fara-7B implemented

**Implementation**:
- `collector/src/platforms/google-ai-overview.ts`
- Selenium/Playwright to search Google
- Fara-7B to parse AI Overview snippet
- Extract citations, brand mentions, positioning

#### 2.2 Claude Search (Anthropic)
**Status**: In beta, API coming soon
**Effort**: 1 week (if API available)

**Implementation**:
- `collector/src/platforms/claude-search.ts`
- Similar to Perplexity adapter
- Depends on Anthropic releasing search API

#### 2.3 Bing Copilot
**Status**: API available via Azure
**Effort**: 1 week

**Implementation**:
- `collector/src/platforms/bing-copilot.ts`
- Use Azure Bing Search API with Copilot mode
- Parse citation format (different from Perplexity)

**Files to modify**:
- `collector/src/platforms/index.ts` (add platform registry)
- `dashboard/src/lib/types.ts` (add platform types)
- `dashboard/src/components/dashboard/PlatformOverview.tsx` (add new cards)

---

### Priority 3: Historical Tracking

**Problem**: V1 only shows point-in-time snapshot
**Need**: Track changes over time, show trends

**Implementation**:

#### 3.1 Data Storage
- Store multiple collection runs in database (PostgreSQL/Supabase)
- Schema:
  ```sql
  runs (id, client_id, timestamp, platform, status)
  prompt_results (run_id, prompt_id, citations, mentions, ...)
  metrics_snapshots (run_id, overall_score, citation_share, ...)
  ```

#### 3.2 Dashboard Changes
- Add date range selector to all views
- Show trend lines on metric cards (↑ 5% vs last month)
- New view: `/trends` showing historical charts
- Compare two snapshots side-by-side

**New Components**:
- `dashboard/src/components/trends/TrendChart.tsx`
- `dashboard/src/components/trends/SnapshotComparison.tsx`
- `dashboard/src/components/shared/DateRangePicker.tsx`

**Backend Required**: Yes (can't use static JSON anymore)
**Complexity**: Medium
**Effort**: 2-3 weeks

---

### Priority 4: Automated Recommendations

**Problem**: Dashboard shows data, but users need actionable next steps
**Need**: AI-generated content strategy recommendations

**Implementation**:

#### 4.1 Recommendation Engine
Use Claude Opus 4.5 to analyze diagnostic results and generate:
- Top 3-5 priority actions ranked by impact
- Specific content to create ("Write comparison page: J.Crew vs Banana Republic for business casual blazers")
- SEO improvements ("Add structured data to product pages")
- Content gaps ("Create guide: 'What is business casual?' targeting informational queries")

**Prompt template**:
```
You are an AI search visibility strategist analyzing diagnostic results.

Client: {clientName}
Industry: {industry}
Overall Score: {overallScore}/100

Citation Share: {citationShare}% (vs competitor avg {competitorAvg}%)
Mention Rate: {mentionRate}%

Top Gaps:
- {topic1}: 0/3 citations, competitor {competitorName} dominates
- {topic2}: Low mention rate (15% vs 60% for competitor)

Based on this data, provide 5 actionable recommendations...
```

#### 4.2 Dashboard Integration
- Add "Recommendations" tab to Executive Summary
- Show recommendations on Topic Detail pages
- "Fix This Gap" button triggering content brief generation
- Export recommendations to PDF

**New Files**:
- `dashboard/src/lib/recommendations.ts` (Claude API integration)
- `dashboard/src/components/recommendations/RecommendationCard.tsx`
- `dashboard/src/components/recommendations/ContentBrief.tsx`

**Complexity**: Medium
**Effort**: 1-2 weeks
**Dependencies**: Anthropic API key, backend (for caching)

---

### Priority 5: Workflow Integrations

**Goal**: Make AISO Rapid Diagnostic part of content/SEO workflow

#### 5.1 Notifications
- Slack/Teams integration
- Send weekly digest: "Your AI visibility score changed by +3 points"
- Alert on competitor movements: "Competitor X now dominates {topic}"

**Implementation**:
- Webhook support in collector
- `collector/src/notifications.ts`

#### 5.2 CMS Integrations
- WordPress plugin to fetch recommendations
- Shopify app for e-commerce brands
- HubSpot/Contentful connectors

#### 5.3 SEO Tool Connectors
- Import keywords from Ahrefs/Semrush
- Cross-reference: Which keywords trigger AI citations?
- Export prompts to rank tracking tools

**Complexity**: High (varies by integration)
**Effort**: 2-4 weeks per integration

---

### Priority 6: Multi-Client Dashboard

**Problem**: V1 requires redeploying dashboard for each client
**Need**: Single deployment serving multiple clients

**Implementation**:

#### 6.1 Authentication
- Add login (Clerk, Auth0, or Supabase Auth)
- Role-based access: admin, client viewer

#### 6.2 Data Isolation
- Database with multi-tenancy
- Client selector in header (not just display, actual switching)
- API routes to fetch client-specific data

#### 6.3 Admin Panel
- Create/manage clients
- Upload prompt libraries
- Trigger collection runs
- Download reports

**New Routes**:
- `/admin/clients` — Client management
- `/admin/runs` — Collection run history
- `/api/clients/[id]/metrics` — Client data API

**Complexity**: High
**Effort**: 3-4 weeks

---

## 🐛 Known Issues & Technical Debt

### Issue 1: Large Fixture Files
**Problem**: `analyzedMetrics.json` is 160KB, loads on every page
**Impact**: Slower initial page load
**Solution**: Code-split fixtures, load per-page
**Effort**: 2-3 days

### Issue 2: No Error Handling in Collector
**Problem**: If API call fails, collector crashes
**Impact**: Must manually resume collection
**Solution**: Add retry logic, graceful degradation
**Files**: `collector/src/collect.ts`, `collector/src/platforms/*.ts`
**Effort**: 1 week

### Issue 3: Hard-Coded Client Detection
**Problem**: Citation detection checks for `url.includes('jcrew.com')`
**Impact**: Must modify code for each new client
**Solution**: Use `clientConfig.clientDomains` dynamically
**Files**: All analysis code
**Effort**: 2-3 days

### Issue 4: No Rate Limit Backoff
**Problem**: Collector hits rate limits, fails silently
**Impact**: Incomplete data collection
**Solution**: Exponential backoff, queue system
**Effort**: 3-4 days

### Issue 5: Excel Converter Not Documented
**Problem**: `npm run convert-excel` exists but no usage guide
**Solution**: Add README in `collector/prompts/`
**Effort**: 1 hour

---

## 💡 Ideas for Future Exploration

### 1. Prompt Optimization Lab
- A/B test different prompt phrasings
- Which isotope variations get more citations?
- Generate optimized prompts automatically

### 2. Content ROI Tracker
- Client publishes new content
- Re-run diagnostic 30 days later
- Show attribution: "This page increased citations by 15%"

### 3. AI Search Simulator
- Predict citation probability before publishing
- Score content before it goes live
- "Your draft scores 42/100 for AI visibility"

### 4. Competitive Alerts
- Monitor competitor domains
- Alert when competitor launches high-citation content
- "Competitor published comparison page, now ranks #1 for {topic}"

### 5. Industry Benchmarks
- Aggregate data across clients (anonymized)
- Show "Fashion brands average 38/100 AI visibility"
- Percentile ranking vs industry

---

## 📋 V2 Planning Checklist

Before starting V2 work:

### Validate V1 Success
- [ ] Run 3+ client diagnostics
- [ ] Gather user feedback on metrics shown
- [ ] Identify most-requested features
- [ ] Validate pricing model ($5-10K per report?)

### Prioritize Features
- [ ] Survey clients: which V2 feature is most valuable?
- [ ] Estimate ROI per feature (revenue potential vs effort)
- [ ] Create V2 roadmap with phases

### Technical Decisions
- [ ] Backend: Supabase vs custom Node.js API?
- [ ] Database: PostgreSQL vs MongoDB?
- [ ] Authentication: Clerk vs Auth0 vs Supabase?
- [ ] Hosting: Vercel (frontend) + Railway (backend)?

### Resource Planning
- [ ] Solo dev or hire contractor for browser automation?
- [ ] Outsource integrations (CMS plugins)?
- [ ] Budget for API costs (Claude, additional platforms)

---

## 🎯 V2 Success Metrics

**Ship V2 when**:
- ✅ Browser automation working for 1+ platform
- ✅ Historical tracking stores 3+ months of data
- ✅ Automated recommendations generate useful action plans
- ✅ Multi-client dashboard supports 5+ clients
- ✅ 1+ workflow integration live (Slack or CMS)

**V2 Goal**: $50K ARR from 5-10 clients on monthly monitoring contracts

---

## 📝 Notes from Scope Reduction Decision

**Date**: 2026-03-16
**Decision**: Ship V1 without browser automation, defer Fara-7B to V2

**Rationale**:
1. **Speed to market** > perfection
2. **Validate PMF first** with API-only data
3. **Browser automation adds complexity** (Ollama setup, screenshot storage, Fara-7B integration)
4. **Unknown if API ≠ UI is a real problem** — need client feedback first
5. **V1 is already valuable** — no competitor doing AI search diagnostics at this depth

**Next decision point**: After 3 client engagements
- If clients say "API data is fine" → skip browser automation
- If clients say "We need to see actual UI" → prioritize Fara-7B for V2

---

**Status**: V1 shipped, V2 planning in progress
**Owner**: Development team
**Review cadence**: Monthly (after each client diagnostic)

---

## 🤖 CI / Collection Infrastructure

Added during the nightly GitHub Actions sprint (2026-04-14). These items
unblock or improve the scheduled collection pipeline described in
`.github/workflows/daily-collection.yml` and `.github/SECRETS.md`.

### P1: Refactor API routes to remove localhost dependency

**Problem**: `batch-claude-check.js` and `batch-gemini-check.js` POST to
`http://localhost:3000/api/claude` and `http://localhost:3000/api/gemini`
respectively. The API routes at `dashboard/src/app/api/{claude,gemini}/route.ts`
hold the actual LLM SDK calls, model selection, and rate limiting. In CI
this forces the workflow to start `next dev` in the background for every
run, wait 60 seconds for port 3000 to open, and kill the server afterward.

**Why P1**: The nightly workflow is brittle because of this. If Next.js
fails to start in 60 seconds (slow npm install, missing env var, port
conflict), the whole run fails. A direct path would also cut cold-start
cost and simplify local runs.

**Solution**: Extract the model-calling code into a shared
`dashboard/src/lib/llm/{claude,gemini}.ts` module. Both the API routes AND
the batch runners import from the module. Batch runners in CI call the
module directly; the dev-server path remains for local interactive use.

**Files to change**:
- Create `dashboard/src/lib/llm/claude.ts` (move model call + rate limiting here)
- Create `dashboard/src/lib/llm/gemini.ts` (same)
- `dashboard/src/app/api/claude/route.ts` — thin wrapper over the lib
- `dashboard/src/app/api/gemini/route.ts` — thin wrapper over the lib
- `dashboard/scripts/batch-claude-check.js` — add `--direct` mode that
  imports the lib (or always direct)
- `dashboard/scripts/batch-gemini-check.js` — same
- `.github/workflows/daily-collection.yml` — drop the `next dev` step

**Blocked by**: The API route files are currently untracked dirty-tree
work. Must be committed or reviewed before refactoring.

**Effort**: 2-3 days

---

### P2: Model-tier / validation model support

**Problem**: Nightly runs against production Claude Sonnet and Gemini 2.5
Flash cost real money. For smoke testing the collection pipeline (e.g.
after a schema change), cheaper models would be fine.

**Solution**: Add a `--model-tier {production|validation}` flag to
`onboard-client.js` and the batch runners. Validation tier uses:
- Claude: `claude-haiku-4-5-20251001` (instead of `claude-sonnet-4-6`)
- Gemini: `gemini-2.0-flash` (instead of `gemini-2.5-flash`)

Requires the P1 API route refactor first — without it, the model name
is locked inside `dashboard/src/app/api/*/route.ts` and cannot be
overridden from the script layer.

**Files to change**:
- `dashboard/scripts/model-config.js` — new, exports `{production, validation}` config objects
- `dashboard/scripts/onboard-client.js` — accept `--model-tier` flag, pass to batch runners
- `dashboard/scripts/batch-claude-check.js` — read `MODEL_TIER` env var, pick model
- `dashboard/scripts/batch-gemini-check.js` — same
- `.github/workflows/daily-collection.yml` — document/add a `validation` variant

**Blocked by**: P1 above

**Effort**: 1 day after P1 lands

---

### P2: Perplexity batch runner + pipeline integration

**Problem**: `onboard-client.js` chains Claude and Gemini but not
Perplexity. The plan for the nightly workflow originally called for
Perplexity coverage (using `sonar` / `sonar-small` models) but no
runner exists.

**Solution**: Create `dashboard/scripts/batch-perplexity-check.js`
following the same shape as `batch-claude-check.js`. Requires a
corresponding `dashboard/src/app/api/perplexity/route.ts` — or
direct SDK calls per P1.

**Files to create**:
- `dashboard/scripts/batch-perplexity-check.js`
- `dashboard/src/app/api/perplexity/route.ts` (or `dashboard/src/lib/llm/perplexity.ts` per P1)

**Files to change**:
- `dashboard/scripts/onboard-client.js` — chain Perplexity after Gemini
- `.github/workflows/daily-collection.yml` — add `PERPLEXITY_API_KEY` to env block
- `.github/SECRETS.md` — move `PERPLEXITY_API_KEY` from "future use" to "used"

**Effort**: 1-2 days

---

### P2: OpenAI/ChatGPT batch runner + pipeline integration

**Problem**: Same as Perplexity — planned for nightly coverage (using
`gpt-4o` / `gpt-4o-mini` models) but no runner and no pipeline slot.

**Solution**: Create `dashboard/scripts/batch-openai-check.js`. Pipeline
integration identical to Perplexity TODO above.

**Files to create**:
- `dashboard/scripts/batch-openai-check.js`
- `dashboard/src/app/api/openai/route.ts` (or `dashboard/src/lib/llm/openai.ts` per P1)

**Files to change**:
- `dashboard/scripts/onboard-client.js` — chain OpenAI
- `.github/workflows/daily-collection.yml` — add `OPENAI_API_KEY` to env block
- `.github/SECRETS.md` — move `OPENAI_API_KEY` from "future use" to "used"

**Effort**: 1-2 days

---

### P2: Google AI Overviews nightly integration

**Problem**: `dashboard/scripts/batch-google-check.js` exists and calls
SerpAPI directly (no localhost dependency — would work in CI as-is), but
it is not chained into `onboard-client.js` and therefore not part of the
nightly run.

**Solution**: Add a step to `onboard-client.js` that runs
`batch-google-check.js` after the Gemini step. Unlike Claude/Gemini,
this one does NOT need the Next.js server — it calls SerpAPI directly.

**Files to change**:
- `dashboard/scripts/onboard-client.js` — add Google step between Gemini
  and enrichment steps
- `.github/workflows/daily-collection.yml` — add `SERPAPI_KEY` to env block
- `.github/SECRETS.md` — move `SERPAPI_KEY` from "future use" to "used"

**Blocked by**: `batch-google-check.js` is currently untracked dirty-tree
work. Must be committed first.

**Effort**: 0.5 days (mostly pipeline wiring) after `batch-google-check.js`
is committed.

---

### Known gap: `configs/fti.json` uses old schema

Not a TODO per se, but worth capturing: `generator/configs/fti.json` is
in the old 6-isotope format (`generation.topicsPerCategory` with Awareness/
Consideration/Conversion funnel stages). The new 5×5 generator at
`generator/bin/generate.ts` will not parse it. The nightly workflow tolerates
this because it runs with `--skip-generate` — `onboard-client.js` only
reads `client.name` from the config. When the generator migration is
applied to production runs, this config needs to be rewritten to the new
shape (`brand`, `competitor`, `topics[]`, `targetPromptCount`, etc.).

Track this when the P1 refactor lands or when a non-`--skip-generate`
nightly variant is needed.
