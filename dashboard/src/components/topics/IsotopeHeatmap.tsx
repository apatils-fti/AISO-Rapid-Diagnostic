'use client';

import { useState, useEffect, useMemo } from 'react';
import { Link2, MessageSquare } from 'lucide-react';
import {
  getTopicIsotopeStatsMap,
  getTopicStatsMap,
  type TopicIsotopeStats,
} from '@/lib/platform-data';
import type { TopicIsotopeRow } from '@/lib/db';
import type { TopicResult, IsotopeType, IsotopeResult } from '@/lib/types';
import { FilterBar, FilterDropdown, SearchInput } from '@/components/shared';
import { IsotopeLegend, IsotopeHeaders } from './IsotopeLegend';
import { TopicRow } from './TopicRow';
import { ISOTOPE_TYPES } from '@/lib/taxonomy';
import { cn } from '@/lib/utils';

export type HeatmapMode = 'citations' | 'mentions';

interface IsotopeHeatmapProps {
  selectedPlatforms?: string[];
  serverTopicData?: TopicIsotopeRow[];
}

// Empty IsotopeResult used as a placeholder when rendering Supabase topics
// through the legacy TopicRow / HeatmapCell components. Both components fall
// back to fixture fields only when batchStats is missing — and we always pass
// batchStats for Supabase topics — so these zeroes never reach the screen.
const EMPTY_ISOTOPE_RESULT: IsotopeResult = {
  cited: false,
  citationCount: 0,
  avgPosition: null,
  consistency: 0,
  runs: 0,
  runsWithCitation: 0,
  competitorCitations: {},
};

function emptyIsotopeResults(): Record<IsotopeType, IsotopeResult> {
  const out = {} as Record<IsotopeType, IsotopeResult>;
  for (const iso of ISOTOPE_TYPES) out[iso] = EMPTY_ISOTOPE_RESULT;
  return out;
}

export function IsotopeHeatmap({ selectedPlatforms, serverTopicData }: IsotopeHeatmapProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [mode, setMode] = useState<HeatmapMode>('citations');
  const [isotopeStatsMap, setIsotopeStatsMap] = useState<
    Record<string, Record<string, TopicIsotopeStats>>
  >({});
  const [topicStatsMap, setTopicStatsMap] = useState<
    Record<string, TopicIsotopeStats>
  >({});

  // Load batch-computed stats (re-fetches when platform selection changes)
  useEffect(() => {
    getTopicIsotopeStatsMap(selectedPlatforms).then(setIsotopeStatsMap);
    getTopicStatsMap(selectedPlatforms).then(setTopicStatsMap);
  }, [selectedPlatforms]);

  // Categories from the server data. Currently always empty string because
  // results table has no topic_category column (see TopicComparisonTable for
  // the same constraint). Filter dropdown will collapse to just "All" until
  // category is denormalised into results or surfaced via a topics table.
  const categories = useMemo(() => {
    if (!serverTopicData) return [];
    const set = new Set<string>();
    for (const t of serverTopicData) {
      if (t.category) set.add(t.category);
    }
    return [...set].sort();
  }, [serverTopicData]);

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  // Build a TopicResult-shaped list from serverTopicData so the existing
  // TopicRow / HeatmapCell components keep working. Sort by gap to the
  // strongest competitor — was previously hardcoded against J.Crew via
  // analyzedMetrics + a literal CLIENT_NAME string.
  const filteredTopics: TopicResult[] = useMemo(() => {
    if (!serverTopicData) return [];

    const filtered = serverTopicData.filter((t) => {
      const matchesSearch = t.topicName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aMaxComp = Math.max(0, ...Object.values(a.competitorRates ?? {}));
      const bMaxComp = Math.max(0, ...Object.values(b.competitorRates ?? {}));
      const aGap = aMaxComp - a.overallMentionRate;
      const bGap = bMaxComp - b.overallMentionRate;
      return bGap - aGap; // biggest gap first
    });

    // Adapt shape to TopicResult so we can keep using the existing TopicRow.
    // robustnessScore is set from overallMentionRate as a sane default; the
    // value is only used when topicStats fallback fires (it doesn't, since
    // we always pass batchStats below). overallScore + parametricPresence
    // are unused by TopicRow but required by the type.
    return sorted.map((t): TopicResult => ({
      topicId: t.topicId,
      topicName: t.topicName,
      category: t.category,
      overallScore: 0,
      robustnessScore: t.overallMentionRate,
      isotopeResults: emptyIsotopeResults(),
      parametricPresence: {
        mentioned: false,
        mentionRate: 0,
        sentiment: 'neutral',
        position: 'absent',
      },
    }));
  }, [serverTopicData, searchQuery, categoryFilter]);

  // Group topics by category — when category data is empty, everything bucket
  // into the empty group, which we render under a "Topics" header instead of
  // an empty pill.
  const groupedTopics = useMemo(() => {
    const groups: Record<string, TopicResult[]> = {};
    for (const topic of filteredTopics) {
      const key = topic.category || 'Topics';
      if (!groups[key]) groups[key] = [];
      groups[key].push(topic);
    }
    return groups;
  }, [filteredTopics]);

  const hasCategories = categories.length > 0;

  return (
    <div className="space-y-6">
      {/* Intro text and filters */}
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-[#9CA3AF]">
            {mode === 'citations'
              ? 'This heatmap shows your URL citation presence across topics and query types. Each cell shows how often your domain appears in citation lists.'
              : 'This heatmap shows your brand mention rate across topics and query types. Each cell shows how often your brand is mentioned in response text.'}
            Click on a topic row to see detailed breakdown.
          </p>
        </div>
        <FilterBar>
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-1">
            <button
              onClick={() => setMode('citations')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'citations'
                  ? 'bg-[#00D4AA]/10 text-[#00D4AA]'
                  : 'text-[#9CA3AF] hover:text-[#E5E7EB]'
              )}
            >
              <Link2 className="h-4 w-4" />
              Citations
            </button>
            <button
              onClick={() => setMode('mentions')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'mentions'
                  ? 'bg-[#00D4AA]/10 text-[#00D4AA]'
                  : 'text-[#9CA3AF] hover:text-[#E5E7EB]'
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Mentions
            </button>
          </div>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search topics..."
            className="w-48"
          />
          {hasCategories && (
            <FilterDropdown
              label="Category"
              options={categoryOptions}
              value={categoryFilter}
              onChange={setCategoryFilter}
            />
          )}
        </FilterBar>
      </div>

      {/* Legend */}
      <IsotopeLegend mode={mode} />

      {/* Heatmap */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] overflow-hidden">
        {/* Headers */}
        <div className="border-b border-[#2A2D37] bg-[#22252F]">
          <IsotopeHeaders />
        </div>

        {/* Body */}
        <div className="divide-y divide-[#2A2D37]">
          {hasCategories && categoryFilter === 'all' ? (
            // Show grouped by category
            Object.entries(groupedTopics).map(([category, topics]) => (
              <div key={category}>
                <div className="bg-[#22252F] px-4 py-2">
                  <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    {category}
                  </span>
                </div>
                <div>
                  {topics.map((topic) => (
                    <TopicRow
                      key={topic.topicId}
                      topic={topic}
                      mode={mode}
                      isotopeStats={isotopeStatsMap[topic.topicId]}
                      topicStats={topicStatsMap[topic.topicId]}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            filteredTopics.map((topic) => (
              <TopicRow
                key={topic.topicId}
                topic={topic}
                mode={mode}
                isotopeStats={isotopeStatsMap[topic.topicId]}
                topicStats={topicStatsMap[topic.topicId]}
              />
            ))
          )}
        </div>
      </div>

      {filteredTopics.length === 0 && (
        <div className="text-center py-12 text-[#6B7280]">
          {serverTopicData && serverTopicData.length > 0
            ? 'No topics found matching your criteria.'
            : 'No topic data available for this client.'}
        </div>
      )}
    </div>
  );
}
