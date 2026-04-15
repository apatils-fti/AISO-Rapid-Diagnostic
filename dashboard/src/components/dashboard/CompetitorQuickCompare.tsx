'use client';

import { useState, useEffect } from 'react';
import { analyzedMetrics } from '@/lib/fixtures';
import { getOverallBrandMetrics, type OverallBrandMetrics } from '@/lib/platform-data';
import { COMPETITOR_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';

export function CompetitorQuickCompare() {
  const [batchMetrics, setBatchMetrics] = useState<OverallBrandMetrics | null>(null);

  useEffect(() => {
    getOverallBrandMetrics().then(setBatchMetrics);
  }, []);

  const textMetrics = analyzedMetrics.textMetrics?.overall.brandMetrics ?? {};

  // Get mention rate for each competitor, preferring batch data
  const competitorsWithMentions = analyzedMetrics.competitorOverview.map(c => ({
    ...c,
    mentionRate: batchMetrics?.competitorRates[c.name]?.mentionRate
      ?? textMetrics[c.name]?.mentionRate
      ?? c.parametricMentionRate,
    firstMentionRate: batchMetrics?.competitorRates[c.name]?.firstMentionRate
      ?? textMetrics[c.name]?.firstMentionRate
      ?? 0,
  }));

  // Override client mention rate with batch data
  const competitors = competitorsWithMentions
    .map(c => c.isClient ? { ...c, mentionRate: batchMetrics?.brandMentionRate ?? c.mentionRate, firstMentionRate: batchMetrics?.firstMentionRate ?? c.firstMentionRate } : c)
    .sort((a, b) => b.mentionRate - a.mentionRate);

  const maxShare = Math.max(...competitors.map(c => c.mentionRate), 0.01);
  const clientRate = competitors.find(c => c.isClient)?.mentionRate ?? 0;

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-2">
        Competitor Benchmark
      </h3>
      <p className="text-xs text-[#6B7280] mb-6">Brand mention rate in AI responses — gap vs you</p>
      <div className="space-y-4">
        {competitors.map((competitor) => {
          const barWidth = (competitor.mentionRate / maxShare) * 100;
          const color = COMPETITOR_COLORS[competitor.name] || COMPETITOR_COLORS.Other;
          const gap = competitor.mentionRate - clientRate;
          const gapPct = (gap * 100).toFixed(0);

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
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[#9CA3AF]">
                    {(competitor.mentionRate * 100).toFixed(1)}%
                  </span>
                  {!competitor.isClient && (
                    <span
                      className={cn(
                        'text-xs font-medium px-1.5 py-0.5 rounded',
                        gap > 0
                          ? 'text-red-400 bg-red-400/10'
                          : gap < 0
                          ? 'text-[#10B981] bg-[#10B981]/10'
                          : 'text-[#6B7280] bg-[#22252F]'
                      )}
                    >
                      {gap > 0 ? '+' : ''}{gapPct}pt
                    </span>
                  )}
                </div>
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
                First mention: {(competitor.firstMentionRate * 100).toFixed(0)}% |
                Citation share: {(competitor.overallCitationShare * 100).toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
