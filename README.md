# AISO Rapid Diagnostic

**AI Search Presence Diagnostic Tool** — Measure your brand's visibility across AI-powered search platforms (Perplexity, ChatGPT Search, Google AI Overviews, Claude).

**Version**: 1.0.0
**Status**: ✅ Production Ready
**Last Updated**: 2026-03-16

---

## 🎯 What Is This?

AISO (AI Search Presence Diagnostic) gives brands a point-in-time snapshot of how visible they are when people search using AI-powered platforms like Perplexity and ChatGPT.

**The Problem**: Traditional SEO measures Google rankings. But AI search platforms (Perplexity, ChatGPT, Claude) work differently — they cite sources in responses, not just rank pages. Brands need to know:
- Are we being cited when users search for our product category?
- How do we compare to competitors?
- What's the gap between what AI knows about us (parametric) vs what it finds when searching (RAG)?

**The Solution**: AISO Rapid Diagnostic runs 1,000+ strategic prompts against AI platforms, analyzes citations and brand mentions, and delivers a comprehensive competitive intelligence dashboard.

---

## 🚀 Quick Start

### For Client Delivery (Using J.Crew Data)

```bash
# 1. Install dependencies
cd dashboard
npm install

# 2. Run development server
npm run dev

# 3. Open browser
open http://localhost:3000
```

**What you'll see**: Complete diagnostic for J.Crew with 1,313 prompts analyzed.

### For New Client Diagnostic

```bash
# 1. Configure client
# Edit: dashboard/src/fixtures/clientConfig.json
# Set: clientName, clientDomains, competitors

# 2. Create prompt library (15 topics × 6 isotopes)
cd collector/prompts
# Option A: Use Excel template (inputs.xlsx)
# Option B: Copy jcrew-prompt-library.json and modify

# 3. Run collection
cd collector
export PERPLEXITY_API_KEY=pplx-...
export OPENAI_API_KEY=sk-...
npm run collect

# 4. Analyze results
npm run analyze -- --input data/raw-results/[TIMESTAMP] --output ../dashboard/src/fixtures

# 5. Build and deploy dashboard
cd ../dashboard
npm run build
vercel deploy --prod
```

**Expected time**: 2-4 hours for full collection (1,313 prompts × 3 runs = 3,939 API calls)

---

## 📊 What's Included

### Collector (`/collector`)
Data collection and analysis pipeline written in TypeScript.

**Scripts**:
- `npm run collect` — Run all prompts against AI platforms
- `npm run analyze` — Process raw results into dashboard metrics
- `npm run dry-run` — Test without API calls

**Platforms supported**:
- ✅ Perplexity Sonar
- ✅ ChatGPT Search
- 🔒 Google AI Overviews (coming soon)
- 🔒 Claude Search (coming soon)

**Output**:
- Raw results: `data/raw-results/[TIMESTAMP]/[prompt-id].json`
- Analyzed metrics: `../dashboard/src/fixtures/analyzedMetrics.json`

### Dashboard (`/dashboard`)
Next.js 16 static site with 5 analytical views.

**Tech stack**:
- Next.js 16.1.6 (App Router + Turbopack)
- React 19, TypeScript, Tailwind CSS
- Recharts (data visualization)
- 100% static generation (no backend)

**5 Views**:

1. **Executive Summary** (`/dashboard`)
   - Overall AI visibility score (0-100)
   - Competitor benchmark
   - Platform coverage
   - Top opportunities

2. **Topic Landscape** (`/topics`)
   - **Isotope heatmap** (core product differentiator)
   - 15 topics × 6 isotope dimensions
   - Citations/Mentions toggle
   - Click topic → drill into detail

3. **Competitive Intelligence** (`/competitors`)
   - Share of voice comparison
   - 4 metrics per competitor (mention rate, first mention, avg mentions, parametric knowledge)
   - Topic-level competition breakdown

4. **Gap Analysis** (`/gap-analysis`)
   - 2×2 quadrant: Parametric vs RAG presence
   - Diagnostic insight (what AI knows vs what it finds)
   - Actionable recommendations

5. **Prompt Detail** (`/prompts`)
   - Filterable table of all 1,313 prompts
   - Expandable rows with full responses + citations
   - Topic-level metrics when raw results unavailable

---

## 📈 Key Metrics Explained

### Citation-Based (SEO/RAG Layer)
Measures whether your **domain** is cited in AI responses.

- **Citation Share**: Your % of all citations (vs competitors)
- **Citation Frequency**: How often you're cited per prompt
- **Citation Position**: Avg position in citation lists (1 = first)
- **Consistency**: How reliably you appear (X/3 runs)
- **Isotope Robustness**: % of isotope dimensions where cited

### Mention-Based (Parametric Knowledge)
Measures whether your **brand name** appears in response text.

- **Mention Rate**: % of responses mentioning your brand
- **First Mention Rate**: % where you're mentioned first
- **Avg Mentions Per Response**: Volume of brand references
- **Share of Voice**: Your % of ALL brand mentions
- **Avg Mention Position**: Where in response text (#1, #2, etc.)

### Why Both Matter
- **High citations, low mentions** = Strong SEO, weak brand awareness
- **High mentions, low citations** = Strong brand, weak content discoverability
- **Low both** = Invisible to AI
- **High both** = Ideal state

---

## 🎨 The Isotope Framework

**What are isotopes?** Different "flavors" of the same query testing how phrasing affects AI responses.

**6 Isotope Dimensions**:
1. **Informational**: "What is business casual?"
2. **Commercial**: "Best business casual brands"
3. **Comparative**: "J.Crew vs Banana Republic for business casual"
4. **Persona**: "As a project manager, what business casual brands should I wear?"
5. **Specific**: "Business casual blazers under $200 with free shipping"
6. **Conversational**: "I need work clothes that aren't too formal, help?"

**Why it matters**: AI responds differently to each isotope. You might dominate informational queries but be invisible on commercial ones.

**The heatmap**: Shows all 15 topics × 6 isotopes in one view, color-coded by performance.

---

## 📚 Documentation

### Core Documents
- **[SPEC.MD](./SPEC.MD)** — Original product specification (TechFlow demo)
- **[V1_SHIPPING_READINESS.md](./V1_SHIPPING_READINESS.md)** — Complete shipping assessment (17KB)
- **[TODOS.md](./TODOS.md)** — V2 roadmap and deferred features (12KB)
- **[SCOPE_REDUCTION_DECISION.md](./SCOPE_REDUCTION_DECISION.md)** — Why we shipped without browser automation (9KB)

### Feature Documentation
- **[FEATURE_TOGGLE_ADDED.md](./FEATURE_TOGGLE_ADDED.md)** — Citations/Mentions toggle implementation
- **[ADDITIONAL_FEATURES_ADDED.md](./ADDITIONAL_FEATURES_ADDED.md)** — Robustness score, competitors tab fixes
- **[COMPETITORS_TAB_REDESIGN.md](./COMPETITORS_TAB_REDESIGN.md)** — High-impact metrics redesign
- **[TOPIC_DETAIL_REDESIGN.md](./TOPIC_DETAIL_REDESIGN.md)** — Topic drill-down with mention metrics
- **[PROMPTS_TABLE_REDESIGN.md](./PROMPTS_TABLE_REDESIGN.md)** — Prompt detail with aggregated metrics
- **[RAW_RESULTS_ADDED.md](./RAW_RESULTS_ADDED.md)** — Populating actual API outputs
- **[TEST_ALL_VIEWS.md](./TEST_ALL_VIEWS.md)** — QA checklist

---

## 🏗️ Architecture

```
AISO-Rapid-Diagnostic/
├── collector/                   # Data collection pipeline
│   ├── src/
│   │   ├── collect.ts          # Main collection script
│   │   ├── analyze.ts          # Analysis pipeline
│   │   ├── platforms/          # Platform adapters
│   │   │   ├── perplexity.ts   # Perplexity Sonar
│   │   │   └── chatgpt.ts      # ChatGPT Search
│   │   ├── text-analysis.ts    # Mention detection
│   │   └── types.ts            # TypeScript types
│   ├── prompts/
│   │   ├── jcrew-prompt-library.json   # 1,313 prompts
│   │   └── inputs.xlsx                 # Excel template
│   └── data/
│       └── raw-results/        # 4,855+ result files
│
├── dashboard/                   # Next.js dashboard
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   │   ├── dashboard/      # Executive summary
│   │   │   ├── topics/         # Isotope heatmap
│   │   │   ├── competitors/    # Competitive intelligence
│   │   │   ├── gap-analysis/   # Parametric vs RAG
│   │   │   └── prompts/        # Prompt detail table
│   │   ├── components/         # React components
│   │   ├── fixtures/           # Static data
│   │   │   ├── clientConfig.json
│   │   │   ├── promptLibrary.json
│   │   │   ├── analyzedMetrics.json
│   │   │   └── rawResults.json
│   │   └── lib/
│   │       ├── types.ts        # TypeScript types
│   │       ├── fixtures.ts     # Data loading
│   │       └── colors.ts       # Heatmap colors
│   └── public/
│
└── Documentation (10 .md files, 79KB total)
```

---

## 🔧 Environment Variables

### Collector
```bash
# Required
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx

# Optional (defaults shown)
RPM_LIMIT=50               # Rate limit
RUNS_PER_PROMPT=3          # Consistency checks
```

### Dashboard
**None required** — Uses static JSON fixtures

---

## 💰 API Costs

**Per full diagnostic run** (1,313 prompts × 3 runs = 3,939 calls):

- **Perplexity Sonar Pro**: ~$50-100
- **ChatGPT Search (gpt-4o)**: ~$40-80
- **Total**: ~$100-200

**Revenue model**: Charge clients $5-10K per diagnostic = 25-100× margin on API costs

---

## 🎯 V1 Capabilities & Limitations

### ✅ What V1 Does
- Runs 1,000+ prompts against Perplexity + ChatGPT
- Analyzes citations (domain URLs) and mentions (brand text)
- Compares client vs 5 competitors
- Provides 5-view dashboard with actionable insights
- Exports to static site (deployable anywhere)

### ⚠️ V1 Limitations
- **API-only data** (doesn't capture actual browser UI)
- **Manual collection** (run on-demand via CLI)
- **Point-in-time snapshot** (no historical tracking)
- **2 platforms active** (Google AI, Claude coming later)
- **Fashion/apparel focused** (prompt library is J.Crew-specific)

### 🔮 V2 Roadmap (Deferred)
See [TODOS.md](./TODOS.md) for complete V2 plan:

1. **Browser automation** (Fara-7B/Ollama) — Capture actual UI
2. **Additional platforms** (Google AI Overviews, Claude Search)
3. **Historical tracking** — Show trends over time
4. **Automated recommendations** — LLM-generated action plans
5. **Workflow integrations** — Slack, CMS plugins, SEO tools

**Decision**: Ship V1 without browser automation, validate PMF first. See [SCOPE_REDUCTION_DECISION.md](./SCOPE_REDUCTION_DECISION.md).

---

## 🚢 Deployment

### Option 1: Vercel (Recommended)
```bash
cd dashboard
vercel deploy --prod
```

### Option 2: Netlify
```bash
cd dashboard
npm run build
netlify deploy --prod --dir=.next
```

### Option 3: Static Export
```bash
cd dashboard
npm run build
# Upload .next folder to any static host
```

**Note**: Dashboard is 100% static after build. No server/database required.

---

## 📖 Usage Guide

### For Strategic Consultants
1. Configure client in `clientConfig.json`
2. Create prompt library (or use Excel template)
3. Run collector: `npm run collect`
4. Deploy dashboard to branded URL
5. Walk client through 5 views
6. Deliver PDF export + raw data files

### For In-House Marketing Teams
1. Run quarterly diagnostics to track progress
2. Monitor competitor movements
3. Identify content gaps (low-performing topics)
4. Validate SEO improvements (citations increasing?)

### For Agencies
1. Offer as premium service ($5-10K per client)
2. Monthly monitoring packages (re-run diagnostics)
3. Content strategy informed by isotope heatmap
4. Competitive intelligence for client pitches

---

## 🏆 Success Metrics

**V1 Goals**:
- ✅ 3+ client diagnostics in first month
- ✅ $10-30K revenue (validate pricing)
- ✅ User feedback collected
- ✅ PMF validated

**V2 Trigger**: After 3 clients, prioritize most-requested features

---

## 🛠️ Development

### Running Locally
```bash
# Collector
cd collector
npm install
npm run collect -- --dry-run    # Test mode

# Dashboard
cd dashboard
npm install
npm run dev                      # http://localhost:3000
npm run build                    # Production build
```

### Code Structure
- **Collector**: TypeScript, Node.js, platform adapters
- **Dashboard**: Next.js 16 (App Router), React 19, TypeScript, Tailwind
- **Data flow**: Collector → raw-results → analyze → fixtures → dashboard

### Testing
```bash
# Build test
cd dashboard
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

---

## 📊 Sample Results (J.Crew)

**Overall Score**: 46/100

**Citation Metrics**:
- Citation Share: 2.1% (vs Banana Republic 8.2%, Everlane 5.4%)
- Prompts Cited: 68/1,313 (5.2%)
- Avg Position: #3.2

**Mention Metrics**:
- Mention Rate: 45.3% (appears in nearly half of responses)
- First Mention Rate: 18.7%
- Share of Voice: 22.1%

**Key Insight**: High brand awareness (45% mention rate), but low citation presence (2%). This is a "Content Invisible, Brand Known" positioning — AI models know J.Crew but don't cite their content when searching.

**Recommendation**: Convert brand awareness into citations via SEO (comparison pages, guides, structured data).

---

## 🤝 Contributing

This is a commercial product. For feature requests or bug reports, contact the development team.

---

## 📄 License

Proprietary. All rights reserved.

---

## 📞 Support

- **Documentation**: See `/docs/*.md` files
- **Issues**: Create GitHub issue (if using internal repo)
- **Questions**: Contact development team

---

**Status**: ✅ V1 Production Ready
**Version**: 1.0.0
**Build**: Passing
**Last Updated**: 2026-03-16

**Ready to ship.** 🚀
