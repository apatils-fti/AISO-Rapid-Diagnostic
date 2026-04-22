'use client';

import { Building, Trophy, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GapRow } from '@/lib/db';

interface LayerComparisonProps {
  serverGapData?: GapRow[];
}

// Old version compared parametricMentionRate vs robustnessScore from the
// J.Crew fixture. Both fields are unique to that snapshot. New framing:
// per-topic side-by-side bars showing your brand's mention rate vs the top
// competitor's mention rate. Same shape, different (real) data.

export function LayerComparison({ serverGapData }: LayerComparisonProps) {
  const rows = serverGapData ?? [];

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <p className="text-sm text-[#9CA3AF]">No per-topic data to compare.</p>
      </div>
    );
  }

  // Sort by widest gap so the most-visible topics on the left panel are also
  // the most-visible on the right (and the rows align across panels).
  const topicData = [...rows]
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .map((r) => ({
      id: r.topicId,
      name: r.topicName,
      client: r.clientRate * 100,
      competitor: r.competitorRate * 100,
      competitorName: r.topCompetitor,
    }));

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Your mention rate */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building className="h-5 w-5 text-[#00D4AA]" />
          <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
            Your Mention Rate
          </h3>
        </div>
        <p className="text-sm text-[#6B7280] mb-4">
          How often your brand is mentioned in AI responses, per topic.
        </p>
        <div className="space-y-3">
          {topicData.map((topic) => (
            <div key={topic.id} className="flex items-center gap-3">
              <div className="w-32 text-sm text-[#9CA3AF] truncate" title={topic.name}>
                {topic.name}
              </div>
              <div className="flex-1 h-2 bg-[#22252F] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#00D4AA]"
                  style={{ width: `${topic.client}%` }}
                />
              </div>
              <div className="w-12 text-right text-sm text-[#00D4AA]">
                {topic.client.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top competitor mention rate */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="h-5 w-5 text-amber-400" />
          <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
            Top Competitor Mention Rate
          </h3>
        </div>
        <p className="text-sm text-[#6B7280] mb-4">
          The strongest competitor on each topic and how often they're mentioned.
        </p>
        <div className="space-y-3">
          {topicData.map((topic) => (
            <div key={topic.id} className="flex items-center gap-3">
              <div className="w-32 text-sm text-[#9CA3AF] truncate" title={topic.name}>
                {topic.name}
              </div>
              <div className="flex-1 h-2 bg-[#22252F] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${topic.competitor}%` }}
                />
              </div>
              <div className="w-12 text-right text-sm text-amber-400">
                {topic.competitor.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// GapBridges visualises the distance between client and top competitor per
// topic. Originally compared parametric vs RAG; now compares you vs the
// strongest competitor. The bar shows the gap; the two dots mark the rates.
export function GapBridges({ serverGapData }: { serverGapData?: GapRow[] }) {
  const rows = serverGapData ?? [];

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <p className="text-sm text-[#9CA3AF]">No gap data to visualise.</p>
      </div>
    );
  }

  const topicData = [...rows]
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .map((r) => ({
      id: r.topicId,
      name: r.topicName,
      client: r.clientRate * 100,
      competitor: r.competitorRate * 100,
      competitorName: r.topCompetitor,
      gap: r.gap * 100,
    }));

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-2">
        Per-Topic Gap
      </h3>
      <p className="text-sm text-[#6B7280] mb-6">
        Distance between your mention rate and the strongest competitor's, per
        topic. Sorted by gap size.
      </p>
      <div className="space-y-3">
        {topicData.map((topic) => {
          // Bar runs from the smaller of the two values to the larger.
          const left = Math.min(topic.client, topic.competitor);
          const width = Math.abs(topic.competitor - topic.client);
          const competitorAhead = topic.competitor > topic.client;

          return (
            <div key={topic.id} className="flex items-center gap-4">
              <div className="w-36 text-sm text-[#9CA3AF] truncate" title={topic.name}>
                {topic.name}
              </div>
              <div className="flex-1 relative h-6">
                {/* Track */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-[#2A2D37]" />

                {/* Gap bar */}
                {width > 0 && (
                  <div
                    className={cn(
                      'absolute top-1/2 -translate-y-1/2 h-3 rounded',
                      competitorAhead ? 'bg-amber-400/40' : 'bg-emerald-400/40'
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                )}

                {/* Client dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[#00D4AA] border-2 border-[#1A1D27]"
                  style={{ left: `calc(${topic.client}% - 0.375rem)` }}
                  title={`You: ${topic.client.toFixed(0)}%`}
                />
                {/* Competitor dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-amber-400 border-2 border-[#1A1D27]"
                  style={{ left: `calc(${topic.competitor}% - 0.375rem)` }}
                  title={`${topic.competitorName}: ${topic.competitor.toFixed(0)}%`}
                />
              </div>
              <div className="w-20 text-right text-xs">
                <span
                  className={cn(
                    'font-medium',
                    competitorAhead ? 'text-amber-400' : 'text-emerald-400'
                  )}
                >
                  {competitorAhead ? '+' : ''}
                  {(topic.competitor - topic.client).toFixed(0)}pt
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-[#2A2D37] flex items-center justify-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#00D4AA]" />
          <span className="text-[#9CA3AF]">You</span>
        </div>
        <ArrowRight className="h-3 w-3 text-[#6B7280]" />
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="text-[#9CA3AF]">Top competitor</span>
        </div>
      </div>
    </div>
  );
}
