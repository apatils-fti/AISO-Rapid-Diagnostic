# AI Search Presence Diagnostic — Sprint 0 Wireframe Spec

## Project Overview

Build a **non-functional wireframe dashboard** for an AI Search Presence Diagnostic tool. This product gives clients a point-in-time snapshot of how visible their brand/content is across AI-powered search platforms (Perplexity, Google AI Overviews, ChatGPT Search, Claude). It measures citation presence across different topics and prompt variations ("information isotopes"), compares against competitors, and diagnoses gaps between what AI models inherently know about the brand (parametric knowledge) vs. what they surface when actively searching (RAG/citation layer).

This is a **clickable mockup with static fixture data** — no API calls, no backend. It should look and feel like a real analytics dashboard that a strategist could walk a client through. All data comes from JSON fixture files that mirror the shape of real Perplexity API responses and computed metrics.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Charts/Visualization**: Recharts for standard charts, custom Tailwind components for the heatmap
- **Icons**: Lucide React
- **Data**: Static JSON fixture files in `/fixtures`
- **Type Safety**: TypeScript throughout

## Design Direction

**Aesthetic**: Clean, editorial, data-dense but breathable. Think Bloomberg Terminal meets a modern SaaS analytics product. Dark-mode primary with a sophisticated color palette.

**Color system**:
- Background: Deep charcoal/near-black (`#0F1117` or similar)
- Cards/surfaces: Slightly lighter (`#1A1D27`)
- Borders: Subtle (`#2A2D37`)
- Primary accent: A distinctive teal/cyan (`#00D4AA` or similar — not the typical SaaS blue)
- Secondary accent: Warm amber for warnings/gaps (`#F59E0B`)
- Negative/red: For low scores or missing presence (`#EF4444`)
- Positive/green: For strong presence (`#10B981`)
- Text primary: Near-white (`#E5E7EB`)
- Text secondary: Muted (`#9CA3AF`)

**Typography**: Use a distinctive monospace or geometric sans-serif for headings (e.g., JetBrains Mono, Space Grotesk, or similar from Google Fonts). Clean sans-serif for body text.

**Key design principles**:
- Data density is a feature, not a bug — this is a professional tool
- Use color purposefully to draw attention to gaps and opportunities
- Every number should feel meaningful and clickable
- The dashboard should tell a story top-to-bottom without requiring explanation

## Repository Structure

```
/
├── app/
│   ├── layout.tsx              # Root layout with sidebar navigation
│   ├── page.tsx                # Redirects to /dashboard
│   ├── dashboard/
│   │   └── page.tsx            # View 1: Executive Summary
│   ├── topics/
│   │   ├── page.tsx            # View 2: Topic Landscape (isotope heatmap)
│   │   └── [topicId]/
│   │       └── page.tsx        # Topic drill-down detail
│   ├── competitors/
│   │   └── page.tsx            # View 3: Competitive Intelligence
│   ├── gap-analysis/
│   │   └── page.tsx            # View 4: Parametric vs RAG Gap Analysis
│   └── prompts/
│       └── page.tsx            # View 5: Prompt-Level Detail
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # Left sidebar navigation
│   │   ├── Header.tsx          # Top header with client selector
│   │   └── PageContainer.tsx   # Consistent page wrapper
│   ├── dashboard/
│   │   ├── VisibilityScore.tsx     # Large circular/radial score gauge
│   │   ├── ScoreBreakdown.tsx      # Component metrics under the score
│   │   ├── CompetitorQuickCompare.tsx  # Horizontal bar comparison
│   │   ├── PlatformOverview.tsx    # Platform-by-platform summary cards
│   │   └── TopGapsCard.tsx         # Top 3-5 biggest gaps/opportunities
│   ├── topics/
│   │   ├── IsotopeHeatmap.tsx      # The core heatmap visualization
│   │   ├── TopicRow.tsx            # Single topic row in the heatmap
│   │   ├── HeatmapCell.tsx         # Individual cell with hover state
│   │   ├── IsotopeLegend.tsx       # Legend explaining isotope dimensions
│   │   └── TopicDetail.tsx         # Expanded topic drill-down
│   ├── competitors/
│   │   ├── ShareOfVoice.tsx        # Stacked bar chart by topic
│   │   ├── CompetitorCard.tsx      # Individual competitor summary
│   │   └── DomainBreakdown.tsx     # Which specific URLs are cited
│   ├── gap-analysis/
│   │   ├── LayerComparison.tsx     # Side-by-side parametric vs RAG
│   │   ├── QuadrantChart.tsx       # 2x2 diagnostic quadrant
│   │   └── GapInsightCard.tsx      # Actionable insight from gap data
│   ├── prompts/
│   │   ├── PromptTable.tsx         # Filterable table of all prompts
│   │   ├── PromptRow.tsx           # Expandable row with response detail
│   │   ├── CitationList.tsx        # List of citations for a prompt
│   │   └── ResponsePreview.tsx     # Full LLM response text
│   └── shared/
│       ├── MetricCard.tsx          # Reusable stat card
│       ├── Badge.tsx               # Status badges (cited/not cited/intermittent)
│       ├── ScoreGauge.tsx          # Reusable score display (0-100)
│       ├── PlatformIcon.tsx        # Icons for each AI platform
│       ├── FilterBar.tsx           # Reusable filter/search bar
│       └── Tooltip.tsx             # Consistent tooltip component
├── fixtures/
│   ├── clientConfig.json
│   ├── promptLibrary.json
│   ├── rawResults.json
│   ├── analyzedMetrics.json
│   └── competitorData.json
├── lib/
│   ├── types.ts                # All TypeScript interfaces
│   ├── fixtures.ts             # Fixture data loading utilities
│   ├── scoring.ts              # Score computation helpers (from fixture data)
│   └── colors.ts               # Color scale utilities for heatmap
├── public/
│   └── fonts/                  # Any custom fonts
└── README.md
```

## Fixture Data Schemas

### clientConfig.json

```json
{
  "clientName": "TechFlow",
  "clientDomains": ["techflow.com", "blog.techflow.com", "docs.techflow.com"],
  "industry": "Project Management Software",
  "competitors": [
    {
      "name": "Asana",
      "domains": ["asana.com", "blog.asana.com"]
    },
    {
      "name": "Monday.com",
      "domains": ["monday.com", "blog.monday.com"]
    },
    {
      "name": "ClickUp",
      "domains": ["clickup.com", "blog.clickup.com"]
    },
    {
      "name": "Notion",
      "domains": ["notion.so", "notion.com"]
    }
  ],
  "runDate": "2026-02-03T14:30:00Z",
  "platforms": ["perplexity"],
  "futurePlatforms": ["google_ai_overview", "chatgpt_search", "claude_search"]
}
```

### promptLibrary.json

Create fixture data for **15 topics** with **6 isotopes each** (90 total prompts). Use the project management software vertical. Topics should include things like: task management, team collaboration, project tracking, resource allocation, Gantt charts, agile/scrum tools, time tracking, client reporting, integrations, pricing, small business, enterprise, remote teams, etc.

Isotope dimensions for each topic:
- `informational` — "What is X?"
- `commercial` — "Best X tools/software"
- `comparative` — "X vs Y vs Z"
- `persona` — "As a [role], what X should I use?"
- `specific` — Narrow/detailed version of the query
- `conversational` — Natural, casual phrasing

```json
{
  "topics": [
    {
      "id": "task-management",
      "name": "Task Management",
      "category": "Core Features",
      "prompts": [
        {
          "id": "task-mgmt-informational",
          "text": "What is task management software and how does it work?",
          "isotope": "informational",
          "topic": "task-management"
        },
        {
          "id": "task-mgmt-commercial",
          "text": "Best task management software for teams in 2026",
          "isotope": "commercial",
          "topic": "task-management"
        },
        {
          "id": "task-mgmt-comparative",
          "text": "Asana vs Monday.com vs ClickUp for task management",
          "isotope": "comparative",
          "topic": "task-management"
        },
        {
          "id": "task-mgmt-persona",
          "text": "As a project manager at a mid-size company, what task management tool should I use?",
          "isotope": "persona",
          "topic": "task-management"
        },
        {
          "id": "task-mgmt-specific",
          "text": "Task management software with Kanban boards, time tracking, and Slack integration under $15/user",
          "isotope": "specific",
          "topic": "task-management"
        },
        {
          "id": "task-mgmt-conversational",
          "text": "I'm drowning in tasks across different projects, what tool can help me stay organized?",
          "isotope": "conversational",
          "topic": "task-management"
        }
      ]
    }
  ]
}
```

Generate all 15 topics following this pattern. Make the prompts realistic and varied.

### analyzedMetrics.json

This is the primary data source for the dashboard. It represents the output of the analysis pipeline.

```json
{
  "summary": {
    "overallScore": 34,
    "totalPrompts": 90,
    "totalCitations": 487,
    "clientCitations": 42,
    "citationShare": 0.086,
    "parametricMentionRate": 0.12,
    "ragCitationRate": 0.22,
    "topCompetitor": {
      "name": "Asana",
      "citationShare": 0.28
    },
    "platformBreakdown": {
      "perplexity": {
        "citationShare": 0.086,
        "promptsCited": 18,
        "totalPrompts": 90,
        "avgCitationPosition": 3.2
      },
      "google_ai_overview": {
        "available": false,
        "comingSoon": true
      },
      "chatgpt_search": {
        "available": false,
        "comingSoon": true
      },
      "claude_search": {
        "available": false,
        "comingSoon": true
      }
    }
  },
  "topicResults": [
    {
      "topicId": "task-management",
      "topicName": "Task Management",
      "category": "Core Features",
      "overallScore": 45,
      "isotopeResults": {
        "informational": {
          "cited": true,
          "citationCount": 2,
          "avgPosition": 2.5,
          "consistency": 0.67,
          "runs": 3,
          "runsWithCitation": 2,
          "competitorCitations": {
            "Asana": 3,
            "Monday.com": 2,
            "ClickUp": 1,
            "Notion": 1
          }
        },
        "commercial": {
          "cited": false,
          "citationCount": 0,
          "avgPosition": null,
          "consistency": 0.0,
          "runs": 3,
          "runsWithCitation": 0,
          "competitorCitations": {
            "Asana": 3,
            "Monday.com": 3,
            "ClickUp": 2,
            "Notion": 2
          }
        },
        "comparative": {
          "cited": true,
          "citationCount": 1,
          "avgPosition": 4.0,
          "consistency": 0.33,
          "runs": 3,
          "runsWithCitation": 1,
          "competitorCitations": {
            "Asana": 3,
            "Monday.com": 3,
            "ClickUp": 3,
            "Notion": 0
          }
        },
        "persona": {
          "cited": false,
          "citationCount": 0,
          "avgPosition": null,
          "consistency": 0.0,
          "runs": 3,
          "runsWithCitation": 0,
          "competitorCitations": {
            "Asana": 2,
            "Monday.com": 1,
            "ClickUp": 2,
            "Notion": 1
          }
        },
        "specific": {
          "cited": true,
          "citationCount": 1,
          "avgPosition": 3.0,
          "consistency": 0.33,
          "runs": 3,
          "runsWithCitation": 1,
          "competitorCitations": {
            "Asana": 1,
            "Monday.com": 2,
            "ClickUp": 1,
            "Notion": 0
          }
        },
        "conversational": {
          "cited": false,
          "citationCount": 0,
          "avgPosition": null,
          "consistency": 0.0,
          "runs": 3,
          "runsWithCitation": 0,
          "competitorCitations": {
            "Asana": 2,
            "Monday.com": 2,
            "ClickUp": 1,
            "Notion": 1
          }
        }
      },
      "robustnessScore": 0.33,
      "parametricPresence": {
        "mentioned": true,
        "mentionRate": 0.33,
        "sentiment": "neutral",
        "position": "secondary"
      }
    }
  ],
  "competitorOverview": [
    {
      "name": "TechFlow",
      "isClient": true,
      "overallCitationShare": 0.086,
      "topicShares": {},
      "strongestTopics": ["integrations", "pricing"],
      "weakestTopics": ["enterprise", "agile-scrum"],
      "avgCitationPosition": 3.2,
      "parametricMentionRate": 0.12
    },
    {
      "name": "Asana",
      "isClient": false,
      "overallCitationShare": 0.28,
      "topicShares": {},
      "strongestTopics": ["task-management", "team-collaboration", "enterprise"],
      "weakestTopics": ["pricing", "small-business"],
      "avgCitationPosition": 1.8,
      "parametricMentionRate": 0.78
    },
    {
      "name": "Monday.com",
      "isClient": false,
      "overallCitationShare": 0.22,
      "topicShares": {},
      "strongestTopics": ["project-tracking", "client-reporting"],
      "weakestTopics": ["agile-scrum", "integrations"],
      "avgCitationPosition": 2.1,
      "parametricMentionRate": 0.65
    },
    {
      "name": "ClickUp",
      "isClient": false,
      "overallCitationShare": 0.18,
      "topicShares": {},
      "strongestTopics": ["agile-scrum", "time-tracking"],
      "weakestTopics": ["enterprise", "client-reporting"],
      "avgCitationPosition": 2.4,
      "parametricMentionRate": 0.45
    },
    {
      "name": "Notion",
      "isClient": false,
      "overallCitationShare": 0.14,
      "topicShares": {},
      "strongestTopics": ["team-collaboration", "small-business"],
      "weakestTopics": ["gantt-charts", "resource-allocation"],
      "avgCitationPosition": 2.8,
      "parametricMentionRate": 0.52
    }
  ],
  "gapAnalysis": {
    "quadrant": "low-parametric-moderate-rag",
    "parametricScore": 12,
    "ragScore": 22,
    "insight": "TechFlow's content performs moderately when retrieved by search, but the brand has very low inherent recognition in AI models. This suggests a content discoverability strength but a fundamental brand awareness gap in training data.",
    "recommendations": [
      "Increase presence on high-authority sites that feed LLM training data (Wikipedia, industry publications, Stack Overflow discussions)",
      "Create more original research and data-driven content that gets widely referenced",
      "Focus commercial-intent content on specific differentiators rather than generic feature pages",
      "Develop comparison pages that directly address head-to-head queries"
    ]
  }
}
```

**IMPORTANT**: Generate complete, realistic fixture data for ALL 15 topics. The data should tell a coherent story: TechFlow is a smaller player competing against established brands. They have some strengths in niche areas (integrations, pricing/value) but are largely invisible on broad commercial queries. Their parametric presence is low (newer brand, less training data). Make the numbers internally consistent and realistic.

### rawResults.json

This contains sample raw API responses for the prompt detail view. Create 5-10 representative entries:

```json
{
  "results": [
    {
      "promptId": "task-mgmt-commercial",
      "platform": "perplexity",
      "model": "sonar",
      "runId": 1,
      "timestamp": "2026-02-03T14:32:15Z",
      "response": {
        "text": "The best task management software for teams in 2026 includes several standout options...[truncated realistic response mentioning Asana, Monday.com, ClickUp, Notion but NOT TechFlow]",
        "citations": [
          "https://www.pcmag.com/picks/the-best-project-management-software",
          "https://asana.com/resources/task-management",
          "https://monday.com/blog/project-management/task-management/",
          "https://clickup.com/blog/task-management-software/",
          "https://www.forbes.com/advisor/business/software/best-task-management-software/"
        ],
        "searchResults": [
          {
            "title": "The Best Project Management Software for 2026 - PCMag",
            "url": "https://www.pcmag.com/picks/the-best-project-management-software",
            "snippet": "We test and rate the top project management apps..."
          }
        ]
      },
      "analysis": {
        "clientCited": false,
        "clientMentionedInText": false,
        "competitorsCited": ["Asana", "Monday.com", "ClickUp"],
        "totalCitations": 5
      }
    }
  ]
}
```

## View Specifications

### View 1: Executive Summary (`/dashboard`)

**Purpose**: The 30-second overview a CMO can understand.

**Layout**:
- Top section: Large visibility score (0-100) displayed as a prominent radial/circular gauge on the left. To its right, a brief text interpretation ("Your AI search visibility is below average. You're being outperformed by 4 tracked competitors."). Below the text, show component metrics as small cards: Citation Share, Citation Frequency, Isotope Robustness, Parametric Presence.

- Middle section: Two cards side by side.
  - Left card: "Competitor Benchmark" — horizontal bar chart showing citation share for the client vs each competitor. Client bar should be visually distinct (use accent color). Sort by share descending.
  - Right card: "Platform Coverage" — show cards for each platform. Perplexity is active with real data. The other three (Google AI Overviews, ChatGPT Search, Claude Search) show as "Coming Soon" with a lock icon and a muted/disabled appearance. This sells the multi-platform vision.

- Bottom section: "Top Opportunities" — 3-5 cards highlighting the biggest gaps. Each card shows: the topic, which isotope dimension is weakest, which competitor dominates, and a one-line actionable insight. Format: "You have zero presence in [Topic] for [isotope type] queries — [Competitor] dominates with [X]% citation share."

### View 2: Topic Landscape (`/topics`)

**Purpose**: The isotope heatmap — the product's signature visualization.

**Layout**:
- Top: Brief explanation text + filter controls (filter by category, search topics)
- Main content: A large heatmap grid.
  - Rows = topics (15 rows), grouped by category. Each row shows the topic name on the left, then 6 cells (one per isotope dimension).
  - Columns = isotope dimensions (informational, commercial, comparative, persona, specific, conversational). Column headers at top with an info icon that shows a tooltip explaining what each isotope tests.
  - Cells: Color-coded by citation presence strength.
    - Dark green: Consistently cited (consistency >= 0.67)
    - Light green: Sometimes cited (consistency 0.33-0.66)
    - Yellow/amber: Cited once or weakly (consistency > 0 but < 0.33)
    - Red: Never cited (consistency = 0)
    - Each cell should show a subtle number or icon on hover (e.g., "2/3 runs" or the citation count)
  - Right side of each row: A mini robustness score bar (what % of isotopes had any citation)
  
- Clicking a topic row navigates to `/topics/[topicId]` for the detail view.

**Topic Detail View** (`/topics/[topicId]`):
- Show the topic name, category, and overall topic score
- Expanded isotope breakdown: for each isotope, show the exact prompt text, whether the client was cited, citation count, consistency score, citation position, and which competitors were cited
- A mini competitive bar chart for this topic specifically
- Link back to the main heatmap

### View 3: Competitive Intelligence (`/competitors`)

**Purpose**: Who's winning where you're losing.

**Layout**:
- Top: Overall share of voice — large stacked horizontal bar or donut chart showing overall citation share across all prompts. Include an "Other/Unbranded" segment for citations that go to none of the tracked entities.

- Middle: Topic-level competition table. Rows are topics. For each topic, show small stacked bars representing each competitor's citation share for that topic. Highlight the leader in each row. The client's column should be visually distinct.

- Bottom: Competitor profile cards. One card per competitor showing:
  - Name and overall citation share
  - Strongest topics (badges)
  - Average citation position
  - Parametric mention rate
  - A mini radar/spider chart or similar showing their presence across isotope dimensions

### View 4: Gap Analysis (`/gap-analysis`)

**Purpose**: The diagnostic — parametric knowledge vs. RAG presence.

**Layout**:
- Top: The 2x2 quadrant chart. X-axis = Parametric Presence (0-100), Y-axis = RAG Citation Presence (0-100). Plot the client AND competitors as dots on this chart. Each quadrant has a label:
  - Top-right: "Strong Position" (high parametric + high RAG)
  - Top-left: "Content Discoverable, Brand Unknown" (low parametric + high RAG)
  - Bottom-right: "Known Brand, Content Invisible" (high parametric + low RAG)
  - Bottom-left: "Invisible" (low parametric + low RAG)
  - The client's dot should be large and accented. Competitor dots smaller and labeled.

- Middle: Side-by-side comparison panels.
  - Left panel: "What AI Knows Without Searching" — show parametric mention rate per topic as a simple list with small bar indicators.
  - Right panel: "What AI Finds When Searching" — same topics, showing RAG citation rate.
  - The visual gap between the two panels IS the insight. Consider connecting lines or arrows showing the delta for each topic.

- Bottom: Insight + Recommendations card. Show the `gapAnalysis.insight` text and the list of recommendations as actionable items.

### View 5: Prompt Detail (`/prompts`)

**Purpose**: Full transparency — every prompt, every result.

**Layout**:
- Top: Filter bar with dropdowns for: Topic (all/specific), Isotope Type (all/specific), Citation Status (all/cited/not cited), Platform (all/specific).
  
- Main content: A large table with columns:
  - Topic (with category tag)
  - Prompt Text (truncated, expandable)
  - Isotope Type (badge)
  - Platform (icon)
  - Client Cited (green check / red X)
  - Consistency (e.g., "2/3" with a small progress bar)
  - Citations Count
  - Top Competitor Cited

- Clicking/expanding a row reveals:
  - Full prompt text
  - Full response text (the LLM's answer, with citation markers highlighted)
  - Complete citation list with URLs, showing which belong to client (highlighted green) and competitors (highlighted with their color)
  - All run results (run 1, 2, 3) with their individual citation data

## Sidebar Navigation

Left sidebar, fixed, ~240px wide:
- Logo/product name at top: "AI Search Diagnostic" or similar
- Client name + run date below
- Nav items with icons:
  - Overview (dashboard icon) → `/dashboard`
  - Topics (grid icon) → `/topics`
  - Competitors (users icon) → `/competitors`
  - Gap Analysis (layers icon) → `/gap-analysis`
  - Prompt Detail (list icon) → `/prompts`
- Bottom of sidebar: "Export Report" button (non-functional, just styled) and a settings gear icon
- Active page highlighted with accent color

## Header

Top header bar across the content area:
- Left: Page title (dynamic based on current view)
- Right: Client selector dropdown (just shows "TechFlow" in the wireframe, non-functional), a "New Run" button (styled but non-functional), and a date showing when the diagnostic was run

## Key Implementation Notes

1. **Fixture data must be complete and internally consistent**. The dashboard should look like it's showing real analysis. Numbers need to add up. If the overall citation share is 8.6%, the topic-level data should support that aggregate. Competitor shares + client share + "other" should account for 100% of citations.

2. **Make the "Coming Soon" platforms feel intentional**. The wireframe should clearly communicate that multi-platform support is the product roadmap. Use a consistent locked/disabled treatment for Google AI Overviews, ChatGPT Search, and Claude Search wherever platform data is displayed.

3. **Hover states and interactivity matter** even in a wireframe. Heatmap cells should have hover tooltips. Table rows should have hover highlights. Metric cards should feel clickable (even if they don't navigate anywhere yet). This is what separates a wireframe from a mockup.

4. **Responsive design is NOT a priority** for Sprint 0. Optimize for a 1440px+ desktop viewport. This is a professional analytics tool that will be used on desktop.

5. **Performance**: Since all data is static JSON, there should be no loading states needed. But include skeleton/loading component placeholders in the component library for later use.

6. **The isotope heatmap is the hero component**. Spend extra attention on making it visually distinctive and immediately readable. It should be the thing someone remembers from the demo.

## What NOT to Build

- No authentication / login
- No API integration
- No backend / database
- No data collection pipeline
- No export functionality (style the buttons but don't implement)
- No responsive/mobile layout
- No dark/light mode toggle (dark mode only)
- No real-time data or WebSocket connections
- No client configuration forms (show the config as read-only display)

## Deliverable

A working Next.js application that can be run with `npm run dev` and navigated through all 5 views with realistic fixture data. Every view should be visually complete with proper layout, typography, color, and data visualization. The application should feel like a real product demo, not a wireframe sketch.
