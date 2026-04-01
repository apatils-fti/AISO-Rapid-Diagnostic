'use client';

import { useState, useEffect, useMemo } from 'react';
import { Link2, MessageSquare } from 'lucide-react';
import { analyzedMetrics, getTopicCategories, getFilteredTopicBrandMetrics } from '@/lib/fixtures';
import {
  getTopicIsotopeStatsMap,
  getTopicStatsMap,
  type TopicIsotopeStats,
} from '@/lib/platform-data';
import type { TopicIsotopeRow } from '@/lib/db';
import { FilterBar, FilterDropdown, SearchInput } from '@/components/shared';
import { IsotopeLegend, IsotopeHeaders } from './IsotopeLegend';
import { TopicRow } from './TopicRow';
import { cn } from '@/lib/utils';

export type HeatmapMode = 'citations' | 'mentions';

interface IsotopeHeatmapProps {
  selectedPlatforms?: string[];
  serverTopicData?: TopicIsotopeRow[];
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

  const categories = getTopicCategories();
  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map(c => ({ value: c, label: c })),
  ];

  const filteredTopics = useMemo(() => {
    const CLIENT_NAME = 'J.Crew';

    const filtered = analyzedMetrics.topicResults.filter(topic => {
      const matchesSearch = topic.topicName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || topic.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    // Sort by biggest gap/opportunity using platform-filtered metrics
    return filtered.sort((a, b) => {
      const aMetrics = getFilteredTopicBrandMetrics(a.topicId, selectedPlatforms);
      const bMetrics = getFilteredTopicBrandMetrics(b.topicId, selectedPlatforms);
      const aClientRate = aMetrics[CLIENT_NAME]?.mentionRate ?? 0;
      const bClientRate = bMetrics[CLIENT_NAME]?.mentionRate ?? 0;

      const aMaxComp = Math.max(
        0,
        ...Object.entries(aMetrics)
          .filter(([name]) => name !== CLIENT_NAME)
          .map(([, m]) => m.mentionRate)
      );
      const bMaxComp = Math.max(
        0,
        ...Object.entries(bMetrics)
          .filter(([name]) => name !== CLIENT_NAME)
          .map(([, m]) => m.mentionRate)
      );

      const aGap = aMaxComp - aClientRate;
      const bGap = bMaxComp - bClientRate;

      return bGap - aGap; // Biggest gap first
    });
  }, [searchQuery, categoryFilter, selectedPlatforms]);

  // Group topics by category
  const groupedTopics = useMemo(() => {
    const groups: Record<string, typeof filteredTopics> = {};
    for (const topic of filteredTopics) {
      if (!groups[topic.category]) {
        groups[topic.category] = [];
      }
      groups[topic.category].push(topic);
    }
    return groups;
  }, [filteredTopics]);

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
          <FilterDropdown
            label="Category"
            options={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
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
          {categoryFilter === 'all' ? (
            // Show grouped by category
            Object.entries(groupedTopics).map(([category, topics]) => (
              <div key={category}>
                <div className="bg-[#22252F] px-4 py-2">
                  <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                    {category}
                  </span>
                </div>
                <div>
                  {topics.map(topic => (
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
            // Show flat list
            filteredTopics.map(topic => (
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
          No topics found matching your criteria.
        </div>
      )}
    </div>
  );
}
