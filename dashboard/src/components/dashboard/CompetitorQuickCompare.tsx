'use client';

import { analyzedMetrics } from '@/lib/fixtures';
import { COMPETITOR_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';

export function CompetitorQuickCompare() {
  const competitors = analyzedMetrics.competitorOverview
    .sort((a, b) => b.overallCitationShare - a.overallCitationShare);

  const maxShare = Math.max(...competitors.map(c => c.overallCitationShare));

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-6">
        Competitor Benchmark
      </h3>
      <div className="space-y-4">
        {competitors.map((competitor) => {
          const barWidth = (competitor.overallCitationShare / maxShare) * 100;
          const color = COMPETITOR_COLORS[competitor.name] || COMPETITOR_COLORS.Other;

          return (
            <div key={competitor.name} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      competitor.isClient ? 'text-[#00D4AA]' : 'text-[#E5E7EB]'
                    )}
                  >
                    {competitor.name}
                    {competitor.isClient && (
                      <span className="ml-2 text-xs text-[#6B7280]">(You)</span>
                    )}
                  </span>
                </div>
                <span className="text-sm font-medium text-[#9CA3AF]">
                  {(competitor.overallCitationShare * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-[#22252F] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: color,
                    opacity: competitor.isClient ? 1 : 0.7,
                  }}
                />
              </div>
              <div className="mt-1 text-xs text-[#6B7280] opacity-0 group-hover:opacity-100 transition-opacity">
                Avg. position: #{competitor.avgCitationPosition.toFixed(1)} |
                Parametric: {(competitor.parametricMentionRate * 100).toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
