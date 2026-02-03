'use client';

import { analyzedMetrics } from '@/lib/fixtures';
import { COMPETITOR_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';

export function ShareOfVoice() {
  const competitors = analyzedMetrics.competitorOverview
    .sort((a, b) => b.overallCitationShare - a.overallCitationShare);

  // Calculate "Other" share
  const totalTracked = competitors.reduce((sum, c) => sum + c.overallCitationShare, 0);
  const otherShare = Math.max(0, 1 - totalTracked);

  const segments = [
    ...competitors.map(c => ({
      name: c.name,
      share: c.overallCitationShare,
      color: COMPETITOR_COLORS[c.name] || COMPETITOR_COLORS.Other,
      isClient: c.isClient,
    })),
    ...(otherShare > 0.01 ? [{
      name: 'Other',
      share: otherShare,
      color: COMPETITOR_COLORS.Other,
      isClient: false,
    }] : []),
  ];

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-6">
        Overall Share of Voice
      </h3>

      {/* Stacked bar */}
      <div className="h-12 w-full flex rounded-lg overflow-hidden mb-6">
        {segments.map((segment, index) => (
          <div
            key={segment.name}
            className={cn(
              'relative flex items-center justify-center transition-all hover:opacity-90',
              segment.isClient && 'ring-2 ring-[#00D4AA] ring-inset'
            )}
            style={{
              width: `${segment.share * 100}%`,
              backgroundColor: segment.color,
            }}
          >
            {segment.share >= 0.08 && (
              <span className="text-xs font-medium text-white drop-shadow-sm">
                {(segment.share * 100).toFixed(0)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {segments.map(segment => (
          <div key={segment.name} className="flex items-center gap-2">
            <div
              className={cn(
                'h-3 w-3 rounded',
                segment.isClient && 'ring-1 ring-[#00D4AA]'
              )}
              style={{ backgroundColor: segment.color }}
            />
            <span className={cn(
              'text-sm',
              segment.isClient ? 'text-[#00D4AA] font-medium' : 'text-[#9CA3AF]'
            )}>
              {segment.name}
              {segment.isClient && ' (You)'}
            </span>
            <span className="text-sm text-[#6B7280]">
              {(segment.share * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
