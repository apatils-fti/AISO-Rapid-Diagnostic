'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { analyzedMetrics } from '@/lib/fixtures';
import { cn } from '@/lib/utils';

type SortKey = 'topic' | 'perplexity' | 'chatgpt' | 'delta';
type SortDirection = 'asc' | 'desc';

interface TopicComparison {
  topicId: string;
  topicName: string;
  category: string;
  perplexityScore: number;
  chatgptScore: number;
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

function ScoreBar({ score, color, maxScore = 100 }: { score: number; color: string; maxScore?: number }) {
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

export function TopicComparisonTable() {
  const [sortKey, setSortKey] = useState<SortKey>('delta');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Build comparison data from topic results
  // For now, we'll simulate ChatGPT scores based on Perplexity data with some variation
  const comparisons: TopicComparison[] = analyzedMetrics.topicResults.map((topic) => {
    const perplexityScore = topic.overallScore;
    // Simulate ChatGPT scores with realistic variation
    const chatgptScore = Math.max(0, Math.min(100, perplexityScore + (Math.random() - 0.5) * 30));

    return {
      topicId: topic.topicId,
      topicName: topic.topicName,
      category: topic.category,
      perplexityScore,
      chatgptScore: Math.round(chatgptScore),
      delta: Math.round(perplexityScore - chatgptScore),
    };
  });

  // Sort comparisons
  const sortedComparisons = [...comparisons].sort((a, b) => {
    let comparison = 0;

    switch (sortKey) {
      case 'topic':
        comparison = a.topicName.localeCompare(b.topicName);
        break;
      case 'perplexity':
        comparison = a.perplexityScore - b.perplexityScore;
        break;
      case 'chatgpt':
        comparison = a.chatgptScore - b.chatgptScore;
        break;
      case 'delta':
        comparison = Math.abs(a.delta) - Math.abs(b.delta);
        break;
    }

    return sortDirection === 'desc' ? -comparison : comparison;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const SortHeader = ({ label, sortKeyValue }: { label: string; sortKeyValue: SortKey }) => (
    <button
      onClick={() => handleSort(sortKeyValue)}
      className={cn(
        'flex items-center gap-1 text-sm font-medium transition-colors',
        sortKey === sortKeyValue ? 'text-[#00D4AA]' : 'text-[#6B7280] hover:text-[#E5E7EB]'
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

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] overflow-hidden">
      <div className="p-4 border-b border-[#2A2D37]">
        <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
          Topic Comparison
        </h3>
        <p className="text-sm text-[#6B7280] mt-1">
          Compare visibility scores across platforms by topic
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2A2D37] bg-[#22252F]">
              <th className="text-left p-4">
                <SortHeader label="Topic" sortKeyValue="topic" />
              </th>
              <th className="text-left p-4 w-40">
                <SortHeader label="Perplexity" sortKeyValue="perplexity" />
              </th>
              <th className="text-left p-4 w-40">
                <SortHeader label="ChatGPT" sortKeyValue="chatgpt" />
              </th>
              <th className="text-center p-4 w-24">
                <SortHeader label="Delta" sortKeyValue="delta" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedComparisons.map((comparison) => (
              <tr
                key={comparison.topicId}
                className="border-b border-[#2A2D37] hover:bg-[#22252F]/50 transition-colors"
              >
                <td className="p-4">
                  <div>
                    <span className="text-sm font-medium text-[#E5E7EB]">
                      {comparison.topicName}
                    </span>
                    <span className="ml-2 text-xs text-[#6B7280] bg-[#22252F] px-2 py-0.5 rounded">
                      {comparison.category}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <ScoreBar score={comparison.perplexityScore} color="#20B8CD" />
                </td>
                <td className="p-4">
                  <ScoreBar score={comparison.chatgptScore} color="#10A37F" />
                </td>
                <td className="p-4">
                  <DeltaCell value={comparison.delta} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-[#2A2D37] bg-[#22252F]">
        <div className="flex items-center justify-between text-sm text-[#6B7280]">
          <span>Showing {comparisons.length} topics</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#20B8CD]" />
              <span>Perplexity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#10A37F]" />
              <span>ChatGPT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
