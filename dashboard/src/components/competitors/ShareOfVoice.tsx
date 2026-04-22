'use client';

import { COMPETITOR_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { CompetitorOverviewRow } from '@/lib/db';

interface ShareOfVoiceProps {
  serverData?: CompetitorOverviewRow[];
}

export function ShareOfVoice({ serverData }: ShareOfVoiceProps) {
  const rows = serverData ?? [];

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-2">
          Brand Mention Share
        </h3>
        <p className="text-sm text-[#9CA3AF]">No competitor data available.</p>
      </div>
    );
  }

  // Each row already represents a brand with a mentionRate scoped to the
  // current client's runs. Sort by share, biggest first.
  const total = rows.reduce((sum, r) => sum + r.mentionRate, 0);
  const segments = rows
    .map((r) => ({
      name: r.name || 'Unknown',
      share: r.mentionRate,
      color: COMPETITOR_COLORS[r.name] || COMPETITOR_COLORS.Other,
      isClient: r.isClient,
    }))
    .sort((a, b) => b.share - a.share);

  // Surface "Other" share if the listed brands don't cover everything (e.g.
  // when responses mention brands outside the configured competitor list).
  const otherShare = Math.max(0, 1 - total);
  if (otherShare > 0.01) {
    segments.push({
      name: 'Other',
      share: otherShare,
      color: COMPETITOR_COLORS.Other,
      isClient: false,
    });
  }

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <div className="mb-6">
        <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-2">
          Brand Mention Share
        </h3>
        <p className="text-sm text-[#9CA3AF]">
          How often each brand is mentioned in AI responses across all topics
        </p>
      </div>

      {/* Stacked bar */}
      <div className="h-12 w-full flex rounded-lg overflow-hidden mb-6">
        {segments.map((segment) => (
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
        {segments.map((segment) => (
          <div key={segment.name} className="flex items-center gap-2">
            <div
              className={cn(
                'h-3 w-3 rounded',
                segment.isClient && 'ring-1 ring-[#00D4AA]'
              )}
              style={{ backgroundColor: segment.color }}
            />
            <span
              className={cn(
                'text-sm',
                segment.isClient ? 'text-[#00D4AA] font-medium' : 'text-[#9CA3AF]'
              )}
            >
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
