'use client';

import { useState, useMemo } from 'react';
import { analyzedMetrics, getTopicCategories } from '@/lib/fixtures';
import { FilterBar, FilterDropdown, SearchInput } from '@/components/shared';
import { IsotopeLegend, IsotopeHeaders } from './IsotopeLegend';
import { TopicRow } from './TopicRow';

export function IsotopeHeatmap() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = getTopicCategories();
  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map(c => ({ value: c, label: c })),
  ];

  const filteredTopics = useMemo(() => {
    return analyzedMetrics.topicResults.filter(topic => {
      const matchesSearch = topic.topicName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || topic.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, categoryFilter]);

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
            This heatmap shows your citation presence across 15 topics and 6 query types (isotopes).
            Each cell represents how consistently you appear in AI search results for that specific query type.
            Click on a topic row to see detailed breakdown.
          </p>
        </div>
        <FilterBar>
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
      <IsotopeLegend />

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
                    <TopicRow key={topic.topicId} topic={topic} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            // Show flat list
            filteredTopics.map(topic => (
              <TopicRow key={topic.topicId} topic={topic} />
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
