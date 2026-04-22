'use client';

import { AlertTriangle, ArrowRight, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { COMPETITOR_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { GapRow } from '@/lib/db';

const SEVERITY_STYLES = {
  critical: {
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-400',
    label: 'Critical',
  },
  high: {
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-400',
    label: 'High',
  },
  medium: {
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-400',
    label: 'Medium',
  },
};

function severityFor(gap: number): keyof typeof SEVERITY_STYLES {
  if (gap > 0.15) return 'critical';
  if (gap > 0.08) return 'high';
  return 'medium';
}

interface TopGapPrioritiesProps {
  serverGapData?: GapRow[];
  clientName?: string;
}

export function TopGapPriorities({ serverGapData, clientName }: TopGapPrioritiesProps) {
  const gaps = (serverGapData ?? []).slice(0, 10);
  const youLabel = clientName || 'You';

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
              Top {gaps.length} Priority Gaps
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Topics where competitors outperform {youLabel} in AI brand mentions —
              sorted by gap size
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {gaps.map((gap, idx) => {
          const severity = severityFor(gap.gap);
          const styles = SEVERITY_STYLES[severity];
          const compColor = COMPETITOR_COLORS[gap.topCompetitor] || '#6B7280';

          return (
            <Link
              key={gap.topicId}
              href={`/topics/${gap.topicId}`}
              className={cn(
                'flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-[#22252F]/80 bg-[#22252F]',
                styles.border
              )}
            >
              {/* Rank */}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1D27] text-sm font-bold text-[#E5E7EB] flex-shrink-0">
                {idx + 1}
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
                  {youLabel}: {(gap.clientRate * 100).toFixed(0)}%{' · '}
                  <span style={{ color: compColor }}>
                    {gap.topCompetitor}: {(gap.competitorRate * 100).toFixed(0)}%
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
