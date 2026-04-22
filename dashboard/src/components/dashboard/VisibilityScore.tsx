'use client';

import { Building2, Info } from 'lucide-react';
import { ScoreGauge } from '@/components/shared';
import type { OverviewStats } from '@/lib/db';
import { getScoreTextClass } from '@/lib/colors';
import { cn } from '@/lib/utils';

// NOTE: As of 2026-04-22 this component is exported from
// `components/dashboard/index.ts` but not rendered by any page — Executive
// Summary uses <ExecutiveSummary> + <PillarCard> instead. Kept around (and
// kept current) so it's ready if/when reintroduced. Drop or merge with
// ExecutiveSummary if it stays unused after the next dashboard pass.

// Industry display labels matching the archetype IDs stored on clients.
const ARCHETYPE_LABEL: Record<string, string> = {
  'fashion-apparel': 'Fashion & Apparel',
  'saas-software': 'SaaS / Software',
  'finance-banking': 'Finance & Banking',
  'healthcare-pharma': 'Healthcare / Pharma',
  'retail-ecommerce': 'Retail / E-commerce',
  'travel-hospitality': 'Travel & Hospitality',
  'food-beverage': 'Food & Beverage',
};

// Archetypes where citation behaviour is light — surface a tooltip hint
// matching the old fixture-driven copy.
const LOW_CITATION_ARCHETYPES = new Set(['fashion-apparel', 'food-beverage']);

interface VisibilityScoreProps {
  overviewData?: OverviewStats | null;
  archetype?: string;
}

export function VisibilityScore({ overviewData, archetype }: VisibilityScoreProps) {
  if (!overviewData) {
    return (
      <div className="flex items-start gap-8">
        <ScoreGauge score={0} size="xl" label="Visibility Score" className="flex-shrink-0" />
        <div className="flex-1 text-[#9CA3AF]">No overview data available.</div>
      </div>
    );
  }

  const score = overviewData.visibilityScore;
  const industryName = archetype ? ARCHETYPE_LABEL[archetype] : undefined;
  const lowCitationArchetype = archetype ? LOW_CITATION_ARCHETYPES.has(archetype) : false;

  const getScoreInterpretation = (s: number): string => {
    if (s < 25) {
      return "Your AI search visibility is critically low. You're being significantly outperformed by all tracked competitors.";
    }
    if (s < 40) {
      return "Your AI search visibility is below average. You're being outperformed by most tracked competitors.";
    }
    if (s < 60) {
      return "Your AI search visibility is moderate. There's significant room for improvement against top competitors.";
    }
    if (s < 80) {
      return "Your AI search visibility is good. You're competitive but could strengthen presence in key areas.";
    }
    return "Your AI search visibility is excellent. You're a leader in AI search presence.";
  };

  return (
    <div className="flex items-start gap-8">
      <ScoreGauge
        score={score}
        size="xl"
        label="Visibility Score"
        className="flex-shrink-0"
      />
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <h3 className={cn('text-2xl font-heading font-bold', getScoreTextClass(score))}>
            {score < 40 ? 'Below Average' : score < 60 ? 'Moderate' : 'Good'}
          </h3>
          {industryName && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22252F] border border-[#2A2D37] text-xs text-[#9CA3AF]">
              <Building2 className="h-3 w-3" />
              {industryName}
            </span>
          )}
        </div>
        <p className="mt-2 text-[#9CA3AF] leading-relaxed">
          {getScoreInterpretation(score)}
        </p>
        {lowCitationArchetype && (
          <p className="mt-2 text-xs text-[#6B7280] flex items-center gap-1">
            <Info className="h-3 w-3" />
            Score weighted for {industryName?.toLowerCase()} (brand mentions matter more than domain citations)
          </p>
        )}
        {overviewData.topCompetitor && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-[#6B7280]">Top competitor:</span>
            <span className="font-medium text-[#E5E7EB]">{overviewData.topCompetitor}</span>
            <span className="text-[#6B7280]">at</span>
            <span className="font-medium text-amber-400">
              {(overviewData.topCompetitorRate * 100).toFixed(0)}%
            </span>
            <span className="text-[#6B7280]">mention rate</span>
          </div>
        )}
      </div>
    </div>
  );
}
