# Changelog

All notable changes to this project will be documented in this file.

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
