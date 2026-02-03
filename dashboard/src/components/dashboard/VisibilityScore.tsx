'use client';

import { ScoreGauge } from '@/components/shared';
import { analyzedMetrics } from '@/lib/fixtures';
import { getScoreTextClass } from '@/lib/colors';
import { cn } from '@/lib/utils';

export function VisibilityScore() {
  const { summary } = analyzedMetrics;
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
        <h3 className={cn('text-2xl font-heading font-bold', getScoreTextClass(score))}>
          {score < 40 ? 'Below Average' : score < 60 ? 'Moderate' : 'Good'}
        </h3>
        <p className="mt-2 text-[#9CA3AF] leading-relaxed">
          {getScoreInterpretation(score)}
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-[#6B7280]">Top competitor:</span>
          <span className="font-medium text-[#E5E7EB]">
            {summary.topCompetitor.name}
          </span>
          <span className="text-[#6B7280]">at</span>
          <span className="font-medium text-red-400">
            {(summary.topCompetitor.citationShare * 100).toFixed(0)}%
          </span>
          <span className="text-[#6B7280]">citation share</span>
        </div>
      </div>
    </div>
  );
}
