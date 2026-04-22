'use client';

import { TrendingUp, TrendingDown, Zap, Users, BarChart3, Layers } from 'lucide-react';
import type { OverviewStats } from '@/lib/db';
import { cn } from '@/lib/utils';
import { getScoreColor, getScoreTextClass } from '@/lib/colors';

interface ExecutiveSummaryProps {
  overviewData?: OverviewStats | null;
  clientName?: string;
}

export function ExecutiveSummary({ overviewData, clientName }: ExecutiveSummaryProps) {
  if (!overviewData) return null;

  const mentionPct = (overviewData.mentionRate * 100).toFixed(0);
  const topCompPct = (overviewData.topCompetitorRate * 100).toFixed(0);
  const gapPct = (overviewData.biggestGapDelta * 100).toFixed(0);
  const isLeading = overviewData.rank === 1;
  const visScore = Math.round(overviewData.mentionRate * 100);
  const totalCompetitors = overviewData.competitorStats.length + 1;
  const platformCount = overviewData.platformCount;
  const displayClientName = clientName ?? '';

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
              {displayClientName && (
                <>
                  <span className="font-semibold text-[#00D4AA]">{displayClientName}</span>
                  {' is mentioned in '}
                </>
              )}
              {!displayClientName && 'Mentioned in '}
              <span className="font-semibold text-[#00D4AA]">{mentionPct}%</span>{' '}
              of AI responses across{' '}
              <span className="font-medium text-[#E5E7EB]">
                {platformCount} platform{platformCount !== 1 ? 's' : ''}
              </span>
              {' — '}
              {isLeading ? (
                <span className="text-[#10B981] font-medium">
                  leading all {totalCompetitors} tracked competitors
                </span>
              ) : (
                <>
                  ranked{' '}
                  <span className="font-semibold text-[#E5E7EB]">
                    #{overviewData.rank}
                  </span>{' '}
                  of {totalCompetitors} competitors
                </>
              )}
              .
            </p>
            {overviewData.biggestGapTopic && overviewData.biggestGapDelta > 0 && (
              <p className="text-[#9CA3AF] text-sm mt-2">
                <TrendingDown className="inline h-3.5 w-3.5 text-amber-400 mr-1 -mt-0.5" />
                Biggest opportunity:{' '}
                <span className="text-[#E5E7EB] font-medium">
                  {overviewData.biggestGapTopic}
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
            value={`#${overviewData.rank}`}
            sublabel={`of ${totalCompetitors}`}
            color={isLeading ? '#10B981' : '#F59E0B'}
          />
          <StatPill
            icon={Layers}
            label="Platforms"
            value={`${platformCount}`}
            sublabel="with data"
            color="#3B82F6"
          />
          <StatPill
            icon={Users}
            label="Top Competitor"
            value={overviewData.topCompetitor || '—'}
            sublabel={overviewData.topCompetitor ? `${topCompPct}% mention rate` : ''}
            color="#8B5CF6"
          />
          <StatPill
            icon={Zap}
            label="Biggest Gap"
            value={overviewData.biggestGapTopic ? `${gapPct}pt` : '—'}
            sublabel={overviewData.biggestGapTopic || ''}
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
