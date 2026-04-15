'use client';

import { Badge, LinearScore } from '@/components/shared';
import { COMPETITOR_COLORS } from '@/lib/colors';
import { ISOTOPE_TYPES, ISOTOPE_LABELS, analyzedMetrics, getFilteredBrandMetrics } from '@/lib/fixtures';
import { cn, slugToTitle } from '@/lib/utils';
import type { CompetitorOverview } from '@/lib/types';
import type { CompetitorOverviewRow } from '@/lib/db';

interface CompetitorCardProps {
  competitor?: CompetitorOverview;
  mode?: string;
  selectedPlatforms?: string[];
  serverData?: CompetitorOverviewRow;
}

export function CompetitorCard({ competitor: competitorProp, mode = 'mentions', selectedPlatforms, serverData }: CompetitorCardProps) {
  // Build a compatible competitor object from server data if fixture prop not provided
  const competitor: CompetitorOverview = competitorProp ?? {
    name: serverData?.name ?? 'Unknown',
    isClient: serverData?.isClient ?? false,
    overallCitationShare: 0,
    topicShares: {},
    strongestTopics: serverData?.topTopics ?? [],
    weakestTopics: serverData?.weakTopics ?? [],
    avgCitationPosition: 0,
    parametricMentionRate: serverData?.mentionRate ?? 0,
  };

  const color = COMPETITOR_COLORS[competitor.name] || COMPETITOR_COLORS.Other;

  // Get filtered mention metrics based on selected platforms
  const filteredBrandMetrics = getFilteredBrandMetrics(selectedPlatforms);
  const brandMetrics = filteredBrandMetrics[competitor.name];
  const mentionRate = brandMetrics?.mentionRate || 0;
  const firstMentionRate = brandMetrics?.firstMentionRate || 0;
  const totalMentions = brandMetrics?.totalMentions || 0;
  const avgMentionCount = brandMetrics?.avgMentionCount || 0;

  // Compute gap vs client
  const clientMetrics = filteredBrandMetrics['J.Crew'];
  const clientMentionRate = clientMetrics?.mentionRate || 0;
  const gapVsClient = mentionRate - clientMentionRate;

  const displayShare = mode === 'citations' ? competitor.overallCitationShare : mentionRate;

  return (
    <div
      className={cn(
        'rounded-lg border bg-[#1A1D27] p-6',
        competitor.isClient
          ? 'border-[#00D4AA]/30'
          : 'border-[#2A2D37]'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {competitor.name[0]}
          </div>
          <div>
            <h4 className="font-medium text-[#E5E7EB]">
              {competitor.name}
              {competitor.isClient && (
                <span className="ml-2 text-xs text-[#00D4AA]">(You)</span>
              )}
            </h4>
            <p className="text-sm text-[#6B7280]">
              {mode === 'citations'
                ? `${(displayShare * 100).toFixed(1)}% citation share`
                : `Mentioned in ${(mentionRate * 100).toFixed(1)}% of responses`}
            </p>
            {mode === 'mentions' && !competitor.isClient && (
              <p className={cn(
                'text-xs font-medium mt-1',
                gapVsClient > 0 ? 'text-red-400' : gapVsClient < -0.01 ? 'text-[#10B981]' : 'text-[#6B7280]'
              )}>
                {gapVsClient > 0 ? '+' : ''}{(gapVsClient * 100).toFixed(0)}pt vs J.Crew
              </p>
            )}
          </div>
        </div>
        {mode === 'mentions' && (
          <div className="text-right">
            <div className="text-2xl font-data font-bold" style={{ color }}>
              {totalMentions.toLocaleString()}
            </div>
            <div className="text-xs text-[#6B7280]">Total Mentions</div>
          </div>
        )}
      </div>

      {/* Stats */}
      {mode === 'mentions' ? (
        <div className="space-y-4 mb-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#6B7280]">Mention Rate</span>
              <span className="text-sm font-medium text-[#E5E7EB]">{(mentionRate * 100).toFixed(1)}%</span>
            </div>
            <LinearScore
              score={mentionRate * 100}
              size="sm"
              showValue={false}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#6B7280]">First Mention Rate</span>
              <span className="text-sm font-medium text-[#E5E7EB]">{(firstMentionRate * 100).toFixed(1)}%</span>
            </div>
            <LinearScore
              score={firstMentionRate * 100}
              size="sm"
              showValue={false}
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Mentioned first in {(firstMentionRate * 100).toFixed(0)}% of responses
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#6B7280]">Avg Mentions Per Response</span>
              <span className="text-sm font-medium text-[#E5E7EB]">{avgMentionCount.toFixed(1)}x</span>
            </div>
            <LinearScore
              score={Math.min(avgMentionCount * 20, 100)}
              size="sm"
              showValue={false}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#6B7280]">Parametric Knowledge</span>
              <span className="text-sm font-medium text-[#E5E7EB]">{(competitor.parametricMentionRate * 100).toFixed(1)}%</span>
            </div>
            <LinearScore
              score={competitor.parametricMentionRate * 100}
              size="sm"
              showValue={false}
            />
            <p className="text-xs text-[#6B7280] mt-1">
              Brand presence in AI training data
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-[#6B7280] mb-1">Citation Share</div>
            <LinearScore
              score={displayShare * 100}
              size="sm"
              showValue={false}
            />
          </div>
          <div>
            <div className="text-sm text-[#6B7280] mb-1">Avg Position</div>
            <LinearScore
              score={competitor.avgCitationPosition > 0 ? Math.max(0, 100 - competitor.avgCitationPosition) : 0}
              size="sm"
              showValue={false}
            />
          </div>
        </div>
      )}

      {/* Strongest topics */}
      <div className="mb-3">
        <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-2">
          Strongest Topics
        </div>
        <div className="flex flex-wrap gap-1">
          {competitor.strongestTopics.slice(0, 3).map(topic => (
            <Badge key={topic} variant="success" size="sm">
              {slugToTitle(topic)}
            </Badge>
          ))}
        </div>
      </div>

      {/* Weakest topics */}
      <div>
        <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-2">
          Weakest Topics
        </div>
        <div className="flex flex-wrap gap-1">
          {competitor.weakestTopics.slice(0, 3).map(topic => (
            <Badge key={topic} variant="error" size="sm">
              {slugToTitle(topic)}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CompetitorGrid() {
  return null; // Placeholder - will be used in competitors page
}
