'use client';

import { Tooltip } from '@/components/shared';
import type { GapRow } from '@/lib/db';

interface QuadrantChartProps {
  serverGapData?: GapRow[];
}

// Topic-Gap Quadrant
//
// X axis = your brand's mention rate for the topic
// Y axis = top competitor's mention rate for the topic
//
// Quadrants (top-right is the origin of the inverted SVG y):
//   ┌──────────────────────────┬───────────────────────────┐
//   │  Top-left                │  Top-right                │
//   │  Competitor Leads        │  Both Compete             │
//   │  (their gap, your loss)  │  (active topic)           │
//   ├──────────────────────────┼───────────────────────────┤
//   │  Bottom-left             │  Bottom-right             │
//   │  Niche Topic             │  You Lead                 │
//   │  (neither shows up)      │  (your win)               │
//   └──────────────────────────┴───────────────────────────┘
//
// Old chart plotted competitors at (parametricMentionRate, mentionRate) —
// J.Crew-only fields with no Supabase equivalent. New chart works for any
// client because both axes come from per-topic mention rates already
// computed by getGapAnalysis().

export function QuadrantChart({ serverGapData }: QuadrantChartProps) {
  const rows = serverGapData ?? [];

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-2">
          Topic Gap Map
        </h3>
        <p className="text-sm text-[#9CA3AF]">No topic-level gap data available.</p>
      </div>
    );
  }

  // Each topic is a point. Coordinates in 0–100 percentage space.
  const points = rows.map((row) => ({
    topicId: row.topicId,
    topicName: row.topicName,
    competitorName: row.topCompetitor,
    x: row.clientRate * 100,
    y: row.competitorRate * 100,
    gap: row.gap,
  }));

  // Hold-out test for label visibility: only show short labels for points with
  // a non-trivial position so the chart doesn't get too cluttered. Truncates
  // to ~14 chars to fit alongside the point.
  function shortLabel(name: string): string {
    if (name.length <= 14) return name;
    return name.slice(0, 13) + '…';
  }

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-1">
        Topic Gap Map
      </h3>
      <p className="text-xs text-[#6B7280] mb-6">
        Each dot is a topic. X = your mention rate. Y = top competitor's mention
        rate. Top-left is where competitors lead — those are the gaps to close.
      </p>

      <div className="relative aspect-square max-w-2xl mx-auto">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Quadrant backgrounds */}
          <rect x="0" y="0" width="50" height="50" fill="#EF4444" opacity="0.08" />
          <rect x="50" y="0" width="50" height="50" fill="#F59E0B" opacity="0.08" />
          <rect x="0" y="50" width="50" height="50" fill="#22252F" opacity="0.5" />
          <rect x="50" y="50" width="50" height="50" fill="#10B981" opacity="0.08" />

          {/* Grid lines */}
          <line x1="50" y1="0" x2="50" y2="100" stroke="#2A2D37" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#2A2D37" strokeWidth="0.5" strokeDasharray="2,2" />

          {/* Axis lines */}
          <line x1="0" y1="100" x2="100" y2="100" stroke="#363944" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2="100" stroke="#363944" strokeWidth="1" />

          {/* Points + labels */}
          {points.map((p) => (
            <g key={p.topicId}>
              <Tooltip
                content={
                  <div className="space-y-0.5 text-xs">
                    <div className="font-medium text-[#E5E7EB]">{p.topicName}</div>
                    <div className="text-[#9CA3AF]">
                      You: {p.x.toFixed(0)}% · {p.competitorName}: {p.y.toFixed(0)}%
                    </div>
                    <div className="text-[#6B7280]">Gap: {(p.gap * 100).toFixed(0)}pt</div>
                  </div>
                }
                side="top"
              >
                <circle
                  cx={p.x}
                  cy={100 - p.y}
                  r={p.gap > 0.15 ? 2.4 : p.gap > 0.08 ? 2 : 1.6}
                  fill={p.gap > 0.15 ? '#EF4444' : p.gap > 0.08 ? '#F59E0B' : '#9CA3AF'}
                  stroke="#1A1D27"
                  strokeWidth="0.4"
                  className="cursor-pointer hover:r-3"
                />
              </Tooltip>
            </g>
          ))}
        </svg>

        {/* Quadrant labels */}
        <div className="absolute top-2 left-2 text-xs text-red-400 font-medium leading-tight">
          Competitor<br />Leads
        </div>
        <div className="absolute top-2 right-2 text-xs text-amber-400 font-medium leading-tight text-right">
          Both<br />Compete
        </div>
        <div className="absolute bottom-2 left-2 text-xs text-[#6B7280] leading-tight">
          Niche
        </div>
        <div className="absolute bottom-2 right-2 text-xs text-emerald-400 font-medium leading-tight text-right">
          You<br />Lead
        </div>

        {/* Axis labels */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-[#6B7280]">
          Your Mention Rate →
        </div>
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-[#6B7280] origin-center whitespace-nowrap">
          Top Competitor Rate →
        </div>
      </div>

      {/* Top-left highlights — the actual gaps that matter most */}
      <div className="mt-10 pt-6 border-t border-[#2A2D37]">
        <div className="text-xs uppercase tracking-wider text-[#6B7280] mb-3">
          Worst gaps (top-left quadrant)
        </div>
        <div className="flex flex-wrap gap-2">
          {points
            .filter((p) => p.gap > 0.05 && p.x < 50)
            .sort((a, b) => b.gap - a.gap)
            .slice(0, 6)
            .map((p) => (
              <span
                key={p.topicId}
                className="rounded-full bg-red-500/10 border border-red-500/30 px-3 py-1 text-xs text-red-300"
                title={`Gap: ${(p.gap * 100).toFixed(0)}pt`}
              >
                {shortLabel(p.topicName)}
              </span>
            ))}
          {points.filter((p) => p.gap > 0.05 && p.x < 50).length === 0 && (
            <span className="text-xs text-[#6B7280]">
              No serious gaps — competitors aren't pulling away on any topic.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
