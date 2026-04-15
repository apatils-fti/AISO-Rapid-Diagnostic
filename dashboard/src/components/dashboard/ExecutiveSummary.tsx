'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, Zap, Users, BarChart3, Layers } from 'lucide-react';
import { getExecutiveSummary, type ExecutiveSummary as ExecSummaryData } from '@/lib/platform-data';
import type { OverviewStats } from '@/lib/db';
import { cn } from '@/lib/utils';
import { getScoreColor, getScoreTextClass } from '@/lib/colors';

interface ExecutiveSummaryProps {
  overviewData?: OverviewStats | null;
  clientName?: string;
}

export function ExecutiveSummary({ overviewData, clientName }: ExecutiveSummaryProps) {
  const [fetchedSummary, setFetchedSummary] = useState<ExecSummaryData | null>(null);

  useEffect(() => {
    if (overviewData) return;
    if (typeof window === 'undefined') return;
    getExecutiveSummary().then(setFetchedSummary);
  }, [overviewData]);

  // Convert overviewData to the shape this component expects
  const summary: ExecSummaryData | null = overviewData
    ? {
        clientName: clientName ?? 'J.Crew',
        overallMentionRate: overviewData.mentionRate,
        rank: overviewData.rank,
        totalCompetitors: overviewData.competitorStats.length + 1,
        topCompetitor: overviewData.topCompetitor,
        topCompetitorRate: overviewData.topCompetitorRate,
        biggestGapTopic: overviewData.biggestGapTopic,
        biggestGapDelta: overviewData.biggestGapDelta,
        platformsWithData: overviewData.platformCount,
        platformCount: 4,
      }
    : fetchedSummary;

  if (!summary) return null;

  const mentionPct = (summary.overallMentionRate * 100).toFixed(0);
  const topCompPct = (summary.topCompetitorRate * 100).toFixed(0);
  const gapPct = (summary.biggestGapDelta * 100).toFixed(0);
  const isLeading = summary.rank === 1;
  // Derive a visibility score (0–100) from mention rate for the hero display
  const visScore = Math.round(summary.overallMentionRate * 100);

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] overflow-hidden mb-6">
      {/* Accent top bar */}
      <div
        className="h-1"
        style={{ background: `linear-gradient(90deg, ${getScoreColor(visScore)}, ${getScoreColor(visScore)}80)` }}
      />

      <div className="p-6 pb-5">
        {/* Top row: large score + narrative */}
        <div className="flex items-start gap-6">
          {/* Score hero */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className={cn('text-5xl font-data font-bold leading-none', getScoreTextClass(visScore))}>
              {mentionPct}
              <span className="text-2xl text-[#6B7280] font-normal">%</span>
            </div>
            <span className="mt-1.5 text-xs text-[#6B7280] uppercase tracking-wider">
              Mention Rate
            </span>
          </div>

          {/* Narrative */}
          <div className="flex-1 pt-1">
            <p className="text-[#E5E7EB] text-base leading-relaxed">
              <span className="font-semibold text-[#00D4AA]">{summary.clientName}</span>{' '}
              is mentioned in{' '}
              <span className="font-semibold text-[#00D4AA]">{mentionPct}%</span>{' '}
              of AI responses across{' '}
              <span className="font-medium text-[#E5E7EB]">
                {summary.platformsWithData} platform{summary.platformsWithData !== 1 ? 's' : ''}
              </span>
              {' — '}
              {isLeading ? (
                <span className="text-[#10B981] font-medium">
                  leading all {summary.totalCompetitors} tracked competitors
                </span>
              ) : (
                <>
                  ranked{' '}
                  <span className="font-semibold text-[#E5E7EB]">
                    #{summary.rank}
                  </span>{' '}
                  of {summary.totalCompetitors} competitors
                </>
              )}
              .
            </p>
            {summary.biggestGapTopic && summary.biggestGapDelta > 0 && (
              <p className="text-[#9CA3AF] text-sm mt-2">
                <TrendingDown className="inline h-3.5 w-3.5 text-amber-400 mr-1 -mt-0.5" />
                Biggest opportunity:{' '}
                <span className="text-[#E5E7EB] font-medium">
                  {summary.biggestGapTopic}
                </span>{' '}
                — trailing by{' '}
                <span className="text-amber-400 font-medium">{gapPct}pt</span>
              </p>
            )}
          </div>
        </div>

        {/* Stat pills row */}
        <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#2A2D37]/60">
          <StatPill
            icon={BarChart3}
            label="Rank"
            value={`#${summary.rank}`}
            sublabel={`of ${summary.totalCompetitors}`}
            color={isLeading ? '#10B981' : '#F59E0B'}
          />
          <StatPill
            icon={Layers}
            label="Platforms"
            value={`${summary.platformsWithData}`}
            sublabel={`of ${summary.platformCount} tracked`}
            color="#3B82F6"
          />
          <StatPill
            icon={Users}
            label="Top Competitor"
            value={summary.topCompetitor || '—'}
            sublabel={summary.topCompetitor ? `${topCompPct}% mention rate` : ''}
            color="#8B5CF6"
          />
          <StatPill
            icon={Zap}
            label="Biggest Gap"
            value={summary.biggestGapTopic ? `${gapPct}pt` : '—'}
            sublabel={summary.biggestGapTopic || ''}
            color="#EF4444"
          />
        </div>
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  sublabel: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#0F1117] border border-[#2A2D37]/60 px-3 py-2.5">
      <div
        className="flex-shrink-0 rounded-md p-1.5"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[#6B7280]">{label}</p>
        <p className="text-sm font-semibold text-[#E5E7EB] truncate">{value}</p>
        {sublabel && (
          <p className="text-[10px] text-[#6B7280] truncate">{sublabel}</p>
        )}
      </div>
    </div>
  );
}
