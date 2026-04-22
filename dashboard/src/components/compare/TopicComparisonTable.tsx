'use client';

import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import type { TopicPlatformStat, PlatformComparisonStats } from '@/lib/db';
import { cn } from '@/lib/utils';
import { PLATFORM_COLORS } from '@/lib/colors';

type SortKey = 'topic' | 'perplexity' | 'chatgpt' | 'gemini' | 'claude' | 'delta';
type SortDirection = 'asc' | 'desc';

interface TopicComparison {
  topicId: string;
  topicName: string;
  category: string;
  perplexityRate: number;
  chatgptRate: number;
  geminiRate: number;
  claudeRate: number;
  delta: number;
}

function DeltaCell({ value }: { value: number }) {
  if (Math.abs(value) < 1) {
    return (
      <div className="flex items-center justify-center gap-1 text-[#6B7280]">
        <Minus className="h-3 w-3" />
        <span className="text-sm">0</span>
      </div>
    );
  }

  const isPositive = value > 0;
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1',
        isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
      )}
    >
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      <span className="text-sm font-medium">
        {isPositive ? '+' : ''}
        {value.toFixed(0)}
      </span>
    </div>
  );
}

function ScoreBar({
  score,
  color,
  maxScore = 100,
}: {
  score: number;
  color: string;
  maxScore?: number;
}) {
  const percentage = Math.min((score / maxScore) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[#22252F] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="text-sm font-medium text-[#E5E7EB] w-8 text-right">
        {score.toFixed(0)}
      </span>
    </div>
  );
}

interface TopicComparisonTableProps {
  selectedPlatforms?: string[];
  topicData?: TopicPlatformStat[];
  platformData?: PlatformComparisonStats[];
}

export function TopicComparisonTable({ selectedPlatforms, topicData }: TopicComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('delta');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Build comparisons directly from server-provided Supabase data. Category
  // is intentionally blank — `results` table doesn't have a topic_category
  // column, and there's no separate `topics` table to join. The category
  // badge below is conditional, so an empty string just means "no badge."
  const comparisons: TopicComparison[] = useMemo(() => {
    if (!topicData || topicData.length === 0) return [];

    return topicData.map((topic) => {
      const perplexityRate = (topic.platforms['perplexity'] ?? 0) * 100;
      const chatgptRate = (topic.platforms['chatgpt_search'] ?? 0) * 100;
      const geminiRate = (topic.platforms['gemini'] ?? 0) * 100;
      const claudeRate = (topic.platforms['claude'] ?? 0) * 100;

      const rates = [perplexityRate, chatgptRate, geminiRate, claudeRate].filter((r) => r > 0);

      return {
        topicId: topic.topicId,
        topicName: topic.topicName,
        category: '',
        perplexityRate: Math.round(perplexityRate),
        chatgptRate: Math.round(chatgptRate),
        geminiRate: Math.round(geminiRate),
        claudeRate: Math.round(claudeRate),
        delta: rates.length > 1 ? Math.round(Math.max(...rates) - Math.min(...rates)) : 0,
      };
    });
  }, [topicData]);

  // Sort comparisons
  const sortedComparisons = useMemo(() => {
    return [...comparisons].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'topic':
          comparison = a.topicName.localeCompare(b.topicName);
          break;
        case 'perplexity':
          comparison = a.perplexityRate - b.perplexityRate;
          break;
        case 'chatgpt':
          comparison = a.chatgptRate - b.chatgptRate;
          break;
        case 'gemini':
          comparison = a.geminiRate - b.geminiRate;
          break;
        case 'claude':
          comparison = a.claudeRate - b.claudeRate;
          break;
        case 'delta':
          comparison = Math.abs(a.delta) - Math.abs(b.delta);
          break;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }, [comparisons, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const SortHeader = ({
    label,
    sortKeyValue,
  }: {
    label: string;
    sortKeyValue: SortKey;
  }) => (
    <button
      onClick={() => handleSort(sortKeyValue)}
      className={cn(
        'flex items-center gap-1 text-sm font-medium transition-colors',
        sortKey === sortKeyValue
          ? 'text-[#00D4AA]'
          : 'text-[#6B7280] hover:text-[#E5E7EB]'
      )}
    >
      {label}
      {sortKey === sortKeyValue &&
        (sortDirection === 'desc' ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        ))}
    </button>
  );

  // Platform column config — filter by selectedPlatforms
  const platformColumns: { key: SortKey; label: string; color: string; rateKey: keyof TopicComparison }[] = [
    { key: 'perplexity', label: 'Perplexity', color: PLATFORM_COLORS.perplexity, rateKey: 'perplexityRate' },
    { key: 'chatgpt', label: 'ChatGPT', color: PLATFORM_COLORS.chatgpt_search, rateKey: 'chatgptRate' },
    { key: 'gemini', label: 'Gemini', color: PLATFORM_COLORS.gemini, rateKey: 'geminiRate' },
    { key: 'claude', label: 'Claude', color: PLATFORM_COLORS.claude, rateKey: 'claudeRate' },
  ];

  // Map sort keys to platform-data keys for filtering
  const sortKeyToPlatform: Record<string, string> = {
    perplexity: 'perplexity',
    chatgpt: 'chatgpt_search',
    gemini: 'gemini',
    claude: 'claude',
  };

  const visibleColumns = selectedPlatforms
    ? platformColumns.filter((col) => {
        const platformKey = sortKeyToPlatform[col.key] ?? col.key;
        return selectedPlatforms.includes(platformKey);
      })
    : platformColumns;

  if (comparisons.length === 0) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-12 text-center">
        <p className="text-sm text-[#9CA3AF]">No topic data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] overflow-hidden">
      <div className="p-4 border-b border-[#2A2D37]">
        <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
          Brand Mention Rate by Topic
        </h3>
        <p className="text-sm text-[#6B7280] mt-1">
          Compare brand mention rates across platforms by topic
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2A2D37] bg-[#22252F]">
              <th className="text-left p-4">
                <SortHeader label="Topic" sortKeyValue="topic" />
              </th>
              {visibleColumns.map((col) => (
                <th key={col.key} className="text-left p-4 w-40">
                  <SortHeader label={col.label} sortKeyValue={col.key} />
                </th>
              ))}
              <th className="text-center p-4 w-24">
                <SortHeader label="Spread" sortKeyValue="delta" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedComparisons.map((comparison) => (
              <tr
                key={comparison.topicId}
                className="border-b border-[#2A2D37] hover:bg-[#22252F]/50 transition-colors"
              >
                <td className="p-4 align-middle">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-[#E5E7EB]">
                      {comparison.topicName}
                    </span>
                    {comparison.category && (
                      <span className="ml-2 text-xs text-[#6B7280] bg-[#22252F] px-2 py-0.5 rounded">
                        {comparison.category}
                      </span>
                    )}
                  </div>
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.key} className="p-4 align-middle">
                    <ScoreBar score={comparison[col.rateKey] as number} color={col.color} />
                  </td>
                ))}
                <td className="p-4 align-middle">
                  <DeltaCell value={comparison.delta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-[#2A2D37] bg-[#22252F]">
        <div className="flex items-center justify-between text-sm text-[#6B7280]">
          <span>
            Showing {comparisons.length} topics — sorted by brand mention rate
          </span>
          <div className="flex items-center gap-4">
            {visibleColumns.map((col) => (
              <div key={col.key} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                <span>{col.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
