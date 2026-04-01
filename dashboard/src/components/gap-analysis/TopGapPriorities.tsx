'use client';

import { AlertTriangle, ArrowRight, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { analyzedMetrics, getFilteredTopicBrandMetrics } from '@/lib/fixtures';
import { COMPETITOR_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';

interface PriorityGap {
  rank: number;
  topicId: string;
  topicName: string;
  category: string;
  clientRate: number;
  topCompetitor: string;
  topCompetitorRate: number;
  gap: number;
  severity: 'critical' | 'high' | 'medium';
}

const CLIENT_NAME = 'J.Crew';

function computePriorityGaps(selectedPlatforms?: string[]): PriorityGap[] {
  if (!analyzedMetrics.textMetrics) return [];

  const gaps: Omit<PriorityGap, 'rank' | 'severity'>[] = [];

  for (const topic of analyzedMetrics.topicResults) {
    const brandMetrics = getFilteredTopicBrandMetrics(topic.topicId, selectedPlatforms);
    if (!brandMetrics || Object.keys(brandMetrics).length === 0) continue;

    const clientRate = brandMetrics[CLIENT_NAME]?.mentionRate ?? 0;

    let topCompetitor = '';
    let topCompetitorRate = 0;

    for (const [brand, metrics] of Object.entries(brandMetrics)) {
      if (brand === CLIENT_NAME) continue;
      if (metrics.mentionRate > topCompetitorRate) {
        topCompetitor = brand;
        topCompetitorRate = metrics.mentionRate;
      }
    }

    const gap = topCompetitorRate - clientRate;
    if (gap > 0) {
      gaps.push({
        topicId: topic.topicId,
        topicName: topic.topicName,
        category: topic.category,
        clientRate,
        topCompetitor,
        topCompetitorRate,
        gap,
      });
    }
  }

  return gaps
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 10)
    .map((g, idx) => ({
      ...g,
      rank: idx + 1,
      severity:
        g.gap > 0.15 ? 'critical' : g.gap > 0.08 ? 'high' : 'medium',
    }));
}

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-400',
    label: 'Critical',
  },
  high: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-400',
    label: 'High',
  },
  medium: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-400',
    label: 'Medium',
  },
};

interface TopGapPrioritiesProps {
  selectedPlatforms?: string[];
  serverGapData?: import('@/lib/db').GapRow[];
}

export function TopGapPriorities({ selectedPlatforms, serverGapData }: TopGapPrioritiesProps) {
  const gaps = computePriorityGaps(selectedPlatforms);

  if (gaps.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-500/20 p-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
              Top 10 Priority Gaps
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Topics where competitors outperform you in AI brand mentions — sorted by gap size
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {gaps.map((gap) => {
          const styles = SEVERITY_STYLES[gap.severity];
          const compColor =
            COMPETITOR_COLORS[gap.topCompetitor] || '#6B7280';

          return (
            <Link
              key={gap.topicId}
              href={`/topics/${gap.topicId}`}
              className={cn(
                'flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-[#22252F]/80',
                styles.border,
                'bg-[#22252F]'
              )}
            >
              {/* Rank */}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1D27] text-sm font-bold text-[#E5E7EB] flex-shrink-0">
                {gap.rank}
              </div>

              {/* Topic info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-[#E5E7EB] truncate">
                    {gap.topicName}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                      styles.badge
                    )}
                  >
                    {styles.label}
                  </span>
                </div>
                <div className="text-xs text-[#6B7280]">
                  You: {(gap.clientRate * 100).toFixed(0)}%{' · '}
                  <span style={{ color: compColor }}>
                    {gap.topCompetitor}: {(gap.topCompetitorRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Gap indicator */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-red-400">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span className="text-lg font-bold">
                      {(gap.gap * 100).toFixed(0)}
                    </span>
                  </div>
                  <div className="text-xs text-[#6B7280]">pt gap</div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#6B7280]" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
