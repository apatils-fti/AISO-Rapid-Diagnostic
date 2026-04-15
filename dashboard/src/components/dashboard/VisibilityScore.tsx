'use client';

import { useState, useEffect } from 'react';
import { Building2, Info } from 'lucide-react';
import { ScoreGauge } from '@/components/shared';
import { analyzedMetrics } from '@/lib/fixtures';
import { getOverallBrandMetrics, type OverallBrandMetrics } from '@/lib/platform-data';
import { getScoreTextClass } from '@/lib/colors';
import { cn } from '@/lib/utils';

export function VisibilityScore() {
  const { summary, textMetrics } = analyzedMetrics;
  const [batchMetrics, setBatchMetrics] = useState<OverallBrandMetrics | null>(null);

  useEffect(() => {
    getOverallBrandMetrics().then(setBatchMetrics);
  }, []);

  // Find top competitor by mention rate, preferring batch data
  let topCompetitorName = '';
  let topCompetitorRate = 0;

  if (batchMetrics) {
    for (const [name, rates] of Object.entries(batchMetrics.competitorRates)) {
      if (rates.mentionRate > topCompetitorRate) {
        topCompetitorName = name;
        topCompetitorRate = rates.mentionRate;
      }
    }
  } else {
    const brandMetrics = textMetrics?.overall.brandMetrics ?? {};
    const top = Object.entries(brandMetrics)
      .filter(([name]) => !analyzedMetrics.competitorOverview.find(c => c.name === name && c.isClient))
      .sort(([, a], [, b]) => b.mentionRate - a.mentionRate)[0];
    if (top) {
      topCompetitorName = top[0];
      topCompetitorRate = top[1].mentionRate;
    }
  }

  const score = summary.overallScore;

  const getScoreInterpretation = (score: number): string => {
    if (score < 25) {
      return "Your AI search visibility is critically low. You're being significantly outperformed by all tracked competitors.";
    }
    if (score < 40) {
      return "Your AI search visibility is below average. You're being outperformed by most tracked competitors.";
    }
    if (score < 60) {
      return "Your AI search visibility is moderate. There's significant room for improvement against top competitors.";
    }
    if (score < 80) {
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
          {summary.industry && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22252F] border border-[#2A2D37] text-xs text-[#9CA3AF]">
              <Building2 className="h-3 w-3" />
              {summary.industry.name}
            </span>
          )}
        </div>
        <p className="mt-2 text-[#9CA3AF] leading-relaxed">
          {getScoreInterpretation(score)}
        </p>
        {summary.industry?.citationExpectation === 'low' && (
          <p className="mt-2 text-xs text-[#6B7280] flex items-center gap-1">
            <Info className="h-3 w-3" />
            Score weighted for {summary.industry.name.toLowerCase()} (brand mentions matter more than domain citations)
          </p>
        )}
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-[#6B7280]">Top competitor:</span>
          <span className="font-medium text-[#E5E7EB]">
            {topCompetitorName || summary.topCompetitor.name}
          </span>
          <span className="text-[#6B7280]">at</span>
          <span className="font-medium text-amber-400">
            {(topCompetitorRate * 100).toFixed(0)}%
          </span>
          <span className="text-[#6B7280]">mention rate</span>
        </div>
      </div>
    </div>
  );
}
