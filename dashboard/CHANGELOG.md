# Changelog

All notable changes to this project will be documented in this file.

## [0.7.1.0] - 2026-04-03

### Fixed
- Biggest gap computation in getOverviewStats: was using broken self-increment (`compBest + 1`) and `(1 - clientRate)` instead of actual competitor-vs-client comparison per topic
- Now properly tracks per-topic per-competitor mention counts and finds the topic where the best competitor leads by the most
- Fallback: if no competitor beats client on any topic, shows the topic with lowest client mention rate as an opportunity
- PillarCard icon prop removed to fix Server/Client component boundary error (icons now resolved internally by title)
- Sample responses now pick one per platform for diversity instead of all from the same platform
- Formula callouts now show plain English metric definitions instead of composite weight formulas

## [0.7.0.0] - 2026-04-03

### Changed
- Overview/Dashboard tab now leads with four AISO pillar cards (Visibility, Trust, Acquisition, Recommendation) merged from the former Metrics tab
- Metrics tab replaced with redirect to /dashboard (preserves URL params)
- Removed Metrics nav item from sidebar (7 tabs instead of 8)
- Dashboard page now fetches enriched results for pillar computation alongside overview stats

### Removed
- Standalone Metrics page (content merged into Overview)
- BarChart3 icon import from Sidebar (unused after Metrics removal)

## [0.6.0.0] - 2026-04-03

### Added
- Cross-tab enrichment filters (sentiment, isotope, conversion intent) on all 8 dashboard pages via URL params
- `QueryFilters` interface in db.ts, all query functions accept sentiment/isotope/conversionIntent filters
- `EnrichmentFilters` shared component with pill-style filter UI (same pattern as platform filter)
- Automated client onboarding script (`scripts/onboard-client.js`) chains all pipeline steps with resume support
- Per-prompt response viewer on Metrics pillar cards (expandable sample responses with sentiment labels)
- `SampleResponse` type and expandable response list in PillarCard component

### Changed
- `getAllResultsForClient` signature changed from `(clientId, platform?)` to `(clientId, filters?: QueryFilters)`
- All downstream query functions (getPlatformComparison, getOverviewStats, getTopicIsotopeStats, getCompetitorOverview, getGapAnalysis, getTopicPlatformStats) accept QueryFilters
- All 6 Supabase-backed pages read sentiment/isotope/intent from searchParams and pass to queries
- PillarCard accepts optional `sampleResponses` prop for click-to-expand response previews

## [0.5.0.0] - 2026-04-01

### Added
- URL citation source classifier (`src/lib/url-classifier.ts`) with ~150 known domain lookup table and heuristic fallback
- Citation source enrichment script (`scripts/enrich-citation-sources.js`) classifies citation URLs into 10 source types (owned, earned_editorial, earned_blog, earned_news, earned_review, community, retail, competitor, reference, other)
- VADER sentiment enrichment script (`scripts/enrich-sentiment-vader.js`) replaces Claude API with deterministic rule-based sentiment at $0 cost
- `CitationSourceBreakdown` type and computation in Trust pillar
- Trust pillar now shows owned/earned/community source breakdown when classified citations available
- 25 new URL classifier tests (60 total across 2 test files)

### Changed
- `EnrichedResult` type now includes `classified_citations` field
- `TrustScore` interface includes `citationSources: CitationSourceBreakdown`
- `getTrustScore()` computes citation source distribution from `classified_citations` JSONB
- `vader-sentiment` npm package added (replaces @anthropic-ai/sdk for sentiment)

## [0.4.0.0] - 2026-04-01

### Added
- Archetype-aware composite score weights for 5 archetypes (transactional-commerce, trust-based-advisory, b2b, digital-media, local-experiences)
- `getWeightsForArchetype()` function and `ARCHETYPE_WEIGHTS` config in metrics.ts
- Citation rate display on Visibility pillar card (informational, not in composite)
- Isotope breakdown on Customer Acquisition pillar (mention rate per isotope type)
- Expandable "How is this calculated?" formula callout on each pillar card
- 12 new tests: archetype weight lookup, weight sum validation, composite differences, isotope breakdown, citation rate (35 total)

### Changed
- All 4 score functions (getVisibilityScore, getTrustScore, getAcquisitionScore, getRecommendationScore) accept optional `weights` parameter
- PillarCard now accepts optional `formula` prop for expandable formula section
- Metrics page reads client archetype and passes weights to score functions
- Metrics page shows archetype name in results count line

## [0.3.0.0] - 2026-04-01

### Added
- Phase 2 Supabase migration: Topics, Competitors, Gap Analysis, Prompt Detail pages now read from Supabase
- db.ts query functions: getTopicIsotopeStats, getCompetitorOverview, getGapAnalysis, getPromptResults
- All 8 dashboard tabs now render as Dynamic Server Components (no more static fixture-only pages)
- Loading skeletons with Suspense for all 4 newly migrated pages
- Client selector support on Topics, Competitors, Gap Analysis, and Prompt Detail pages

### Changed
- Topics page rewritten as Server Component, IsotopeHeatmap accepts serverTopicData prop
- Competitors page rewritten as Server Component, ShareOfVoice/TopicCompetition/CompetitorCard accept server props
- Gap Analysis page rewritten as Server Component, all 4 gap components accept serverGapData prop
- Prompt Detail page passes serverData to PromptTable from Supabase query
- CompetitorCard builds compatible fixture object from serverData when fixture prop not provided

## [0.2.0.0] - 2026-04-01

### Added
- Supabase data layer: db.ts with getAllResultsForClient, getPlatformComparison, getOverviewStats, getTopicPlatformStats
- Metrics tab with four AISO pillars (Visibility, Trust, Acquisition, Recommendation)
- Sentiment enrichment pipeline (Claude API for sentiment, regex for recommendation/CTA/winner)
- Competitor mentions enrichment script (scans response_text for competitor brand names)
- Platform spread metric with multi-platform coverage calculation
- Client selector in Header (reads from getClients, switches via URL params)
- Trends tab with time-series data from Supabase
- Compare Platforms and Overview pages migrated to Supabase Server Components
- PillarCard, SentimentBar, MetricsFilter components
- vitest test suite with 23 tests for regex classifiers and metrics computation
- Loading skeletons with Suspense for all Supabase-backed pages

### Changed
- Overview page now fetches from Supabase (Server Component) with fixture fallback
- Compare Platforms page now fetches from Supabase (Server Component) with fixture fallback
- PlatformComparison and TopicComparisonTable accept server-provided data as props
- ExecutiveSummary and PlatformOverview accept Supabase data as props
- Header wrapped ClientSelector in Suspense for SSR compatibility
- PageContainer accepts optional clients and currentClientId props
- Sidebar updated with Metrics nav item
