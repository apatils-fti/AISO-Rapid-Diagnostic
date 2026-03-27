'use client';

import { Badge, LinearScore } from '@/components/shared';
import { COMPETITOR_COLORS } from '@/lib/colors';
import { ISOTOPE_TYPES, ISOTOPE_LABELS } from '@/lib/fixtures';
import { cn, slugToTitle } from '@/lib/utils';
import type { CompetitorOverview } from '@/lib/types';

interface CompetitorCardProps {
  competitor: CompetitorOverview;
}

export function CompetitorCard({ competitor }: CompetitorCardProps) {
  const color = COMPETITOR_COLORS[competitor.name] || COMPETITOR_COLORS.Other;

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
              {(competitor.overallCitationShare * 100).toFixed(1)}% citation share
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-heading font-bold" style={{ color }}>
            #{competitor.avgCitationPosition.toFixed(1)}
          </div>
          <div className="text-xs text-[#6B7280]">Avg Position</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-sm text-[#6B7280] mb-1">Citation Share</div>
          <LinearScore
            score={competitor.overallCitationShare * 100}
            size="sm"
            showValue={false}
          />
        </div>
        <div>
          <div className="text-sm text-[#6B7280] mb-1">Parametric Presence</div>
          <LinearScore
            score={competitor.parametricMentionRate * 100}
            size="sm"
            showValue={false}
          />
        </div>
      </div>

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
