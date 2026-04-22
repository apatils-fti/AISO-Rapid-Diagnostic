'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { HeatmapCell } from './HeatmapCell';
import { LinearScore } from '@/components/shared';
import { ISOTOPE_TYPES } from '@/lib/taxonomy';
import type { TopicResult } from '@/lib/types';
import type { HeatmapMode } from './IsotopeHeatmap';
import type { TopicIsotopeStats } from '@/lib/platform-data';

interface TopicRowProps {
  topic: TopicResult;
  mode: HeatmapMode;
  isotopeStats?: Record<string, TopicIsotopeStats>;
  topicStats?: TopicIsotopeStats;
}

export function TopicRow({ topic, mode, isotopeStats, topicStats }: TopicRowProps) {
  // Robustness = topic-level rate from batch data
  const robustnessPercent = topicStats
    ? Math.round((mode === 'citations' ? topicStats.citationRate : topicStats.mentionRate) * 100)
    : Math.round(topic.robustnessScore * 100);

  // Preserve ?client= across the drill-down so the detail page stays scoped
  // to the currently selected client. The enclosing page (topics/page.tsx)
  // already wraps this subtree in a Suspense boundary, which is what
  // useSearchParams needs in the App Router.
  const searchParams = useSearchParams();
  const clientParam = searchParams.get('client');
  const href = clientParam
    ? `/topics/${topic.topicId}?client=${clientParam}`
    : `/topics/${topic.topicId}`;

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-lg border border-transparent p-3 hover:border-[#2A2D37] hover:bg-[#1A1D27] transition-all"
    >
      {/* Topic name */}
      <div className="w-48 flex-shrink-0">
        <div className="font-medium text-[#E5E7EB] group-hover:text-[#00D4AA] transition-colors">
          {topic.topicName}
        </div>
        <div className="text-xs text-[#6B7280]">{topic.category}</div>
      </div>

      {/* Isotope cells */}
      <div className="flex flex-1 gap-2">
        {ISOTOPE_TYPES.map((isotope) => (
          <div key={isotope} className="flex-1">
            <HeatmapCell
              result={topic.isotopeResults[isotope]}
              isotope={isotope}
              topicId={topic.topicId}
              mode={mode}
              batchStats={isotopeStats?.[isotope]}
            />
          </div>
        ))}
      </div>

      {/* Robustness score */}
      <div className="w-32 flex-shrink-0">
        <LinearScore
          score={robustnessPercent}
          size="sm"
          showValue={true}
        />
      </div>

      {/* Arrow */}
      <ChevronRight className="h-5 w-5 text-[#6B7280] group-hover:text-[#00D4AA] transition-colors flex-shrink-0" />
    </Link>
  );
}
