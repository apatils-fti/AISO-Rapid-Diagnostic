'use client';

import { cn } from '@/lib/utils';
import { getHeatmapBgClass, getHeatmapTextClass } from '@/lib/colors';
import { Tooltip } from '@/components/shared';
import type { IsotopeResult } from '@/lib/types';

interface HeatmapCellProps {
  result: IsotopeResult;
  isotope: string;
}

export function HeatmapCell({ result, isotope }: HeatmapCellProps) {
  const { consistency, runs, runsWithCitation, citationCount, avgPosition } = result;

  const tooltipContent = (
    <div className="space-y-1 text-sm">
      <div className="font-medium">{isotope}</div>
      <div className="text-[#9CA3AF]">
        Cited in {runsWithCitation}/{runs} runs
      </div>
      {citationCount > 0 && (
        <>
          <div className="text-[#9CA3AF]">
            Total citations: {citationCount}
          </div>
          {avgPosition && (
            <div className="text-[#9CA3AF]">
              Avg position: #{avgPosition.toFixed(1)}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} side="top">
      <div
        className={cn(
          'heatmap-cell flex h-12 w-full cursor-pointer items-center justify-center rounded border',
          getHeatmapBgClass(consistency)
        )}
      >
        <span className={cn('text-sm font-medium', getHeatmapTextClass(consistency))}>
          {runsWithCitation}/{runs}
        </span>
      </div>
    </Tooltip>
  );
}
