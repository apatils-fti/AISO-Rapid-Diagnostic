'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeatmapCell } from './HeatmapCell';
import { LinearScore } from '@/components/shared';
import { ISOTOPE_TYPES } from '@/lib/fixtures';
import type { TopicResult } from '@/lib/types';

interface TopicRowProps {
  topic: TopicResult;
}

export function TopicRow({ topic }: TopicRowProps) {
  const robustnessPercent = Math.round(topic.robustnessScore * 100);

  return (
    <Link
      href={`/topics/${topic.topicId}`}
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
