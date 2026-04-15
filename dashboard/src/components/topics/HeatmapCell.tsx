'use client';

import { cn } from '@/lib/utils';
import { getHeatmapBgClass, getHeatmapTextClass } from '@/lib/colors';
import { Tooltip } from '@/components/shared';
import type { IsotopeResult } from '@/lib/types';
import type { HeatmapMode } from './IsotopeHeatmap';
import type { TopicIsotopeStats } from '@/lib/platform-data';

interface HeatmapCellProps {
  result: IsotopeResult;
  isotope: string;
  topicId: string;
  mode: HeatmapMode;
  batchStats?: TopicIsotopeStats;
}

export function HeatmapCell({ result, isotope, topicId, mode, batchStats }: HeatmapCellProps) {
  // Prefer batch-computed stats; fall back to fixture data
  const citationRate = batchStats?.citationRate ?? result.consistency;
  const mentionRate = batchStats?.mentionRate ?? 0;
  const totalPrompts = batchStats?.totalPrompts ?? result.runs;
  const citedCount = batchStats?.promptsWithCitation ?? result.runsWithCitation;
  const mentionedCount = batchStats?.promptsWithMention ?? 0;

  const displayValue = mode === 'citations' ? citationRate : mentionRate;

  const displayText = mode === 'citations'
    ? `${citedCount}/${totalPrompts}`
    : `${Math.round(mentionRate * 100)}%`;

  const tooltipContent = (
    <div className="space-y-1 text-sm">
      <div className="font-medium">{isotope}</div>
      {mode === 'citations' ? (
        <>
          <div className="text-[#9CA3AF]">
            Client cited in {citedCount}/{totalPrompts} prompts
          </div>
        </>
      ) : (
        <>
          <div className="text-[#9CA3AF]">
            Brand mentioned in {mentionedCount}/{totalPrompts} prompts ({(mentionRate * 100).toFixed(1)}%)
          </div>
        </>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} side="top">
      <div
        className={cn(
          'heatmap-cell flex h-12 w-full cursor-pointer items-center justify-center rounded border',
          getHeatmapBgClass(displayValue)
        )}
      >
        <span className={cn('text-sm font-medium', getHeatmapTextClass(displayValue))}>
          {displayText}
        </span>
      </div>
    </Tooltip>
  );
}
