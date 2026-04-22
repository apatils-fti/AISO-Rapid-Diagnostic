'use client';

import { Badge, LinearScore } from '@/components/shared';
import { COMPETITOR_COLORS } from '@/lib/colors';
import { cn, slugToTitle } from '@/lib/utils';
import type { CompetitorOverviewRow } from '@/lib/db';

interface CompetitorCardProps {
  serverData?: CompetitorOverviewRow;
  // Display label for the active client. Used in the "vs <client>" gap line
  // and falls back to "client" if not provided so we never emit a hardcoded
  // brand name.
  clientName?: string;
}

export function CompetitorCard({ serverData, clientName }: CompetitorCardProps) {
  if (!serverData) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <p className="text-sm text-[#9CA3AF]">No competitor data.</p>
      </div>
    );
  }

  const competitor = {
    name: serverData.name || 'Unknown',
    isClient: serverData.isClient ?? false,
    mentionRate: serverData.mentionRate ?? 0,
    totalMentions: serverData.totalMentions ?? 0,
    totalResults: serverData.totalResults ?? 0,
    strongestTopics: serverData.topTopics ?? [],
    weakestTopics: serverData.weakTopics ?? [],
  };

  const color = COMPETITOR_COLORS[competitor.name] || COMPETITOR_COLORS.Other;

  // Gap-vs-client is only meaningful for the non-client cards. Wired to the
  // gapVsClient field if we add it to CompetitorOverviewRow later — for now
  // the card omits the gap line entirely (it was previously computed against
  // a hardcoded J.Crew lookup in the fixture).
  const displayLabel = clientName || 'client';

  return (
    <div
      className={cn(
        'rounded-lg border bg-[#1A1D27] p-6',
        competitor.isClient ? 'border-[#00D4AA]/30' : 'border-[#2A2D37]'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {competitor.name[0] ?? '?'}
          </div>
          <div>
            <h4 className="font-medium text-[#E5E7EB]">
              {competitor.name}
              {competitor.isClient && (
                <span className="ml-2 text-xs text-[#00D4AA]">(You)</span>
              )}
            </h4>
            <p className="text-sm text-[#6B7280]">
              Mentioned in {(competitor.mentionRate * 100).toFixed(1)}% of responses
            </p>
            {!competitor.isClient && clientName && (
              <p className="text-xs font-medium mt-1 text-[#6B7280]">
                vs {displayLabel}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-data font-bold" style={{ color }}>
            {competitor.totalMentions.toLocaleString()}
          </div>
          <div className="text-xs text-[#6B7280]">Total Mentions</div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-4 mb-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[#6B7280]">Mention Rate</span>
            <span className="text-sm font-medium text-[#E5E7EB]">
              {(competitor.mentionRate * 100).toFixed(1)}%
            </span>
          </div>
          <LinearScore score={competitor.mentionRate * 100} size="sm" showValue={false} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[#6B7280]">Total Responses Scored</span>
            <span className="text-sm font-medium text-[#E5E7EB]">
              {competitor.totalResults.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Strongest topics */}
      {competitor.strongestTopics.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-2">
            Strongest Topics
          </div>
          <div className="flex flex-wrap gap-1">
            {competitor.strongestTopics.slice(0, 3).map((topic) => (
              <Badge key={topic} variant="success" size="sm">
                {slugToTitle(topic)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Weakest topics */}
      {competitor.weakestTopics.length > 0 && (
        <div>
          <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-2">
            Weakest Topics
          </div>
          <div className="flex flex-wrap gap-1">
            {competitor.weakestTopics.slice(0, 3).map((topic) => (
              <Badge key={topic} variant="error" size="sm">
                {slugToTitle(topic)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
