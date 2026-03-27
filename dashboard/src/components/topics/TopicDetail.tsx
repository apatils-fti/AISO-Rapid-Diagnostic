'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { ScoreGauge, Badge, StatusBadge } from '@/components/shared';
import { ISOTOPE_TYPES, ISOTOPE_LABELS, ISOTOPE_DESCRIPTIONS, getPromptsForTopic } from '@/lib/fixtures';
import { COMPETITOR_COLORS, getHeatmapBgClass, getHeatmapTextClass, getPositionColor } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { TopicResult, IsotopeType } from '@/lib/types';

interface TopicDetailProps {
  topic: TopicResult;
}

export function TopicDetail({ topic }: TopicDetailProps) {
  const prompts = getPromptsForTopic(topic.topicId);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/topics"
        className="inline-flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#00D4AA] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Topic Landscape
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#E5E7EB]">
            {topic.topicName}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">{topic.category}</Badge>
            <span className="text-sm text-[#6B7280]">
              Robustness: {Math.round(topic.robustnessScore * 100)}%
            </span>
          </div>
        </div>
        <ScoreGauge
          score={topic.overallScore}
          size="lg"
          label="Topic Score"
        />
      </div>

      {/* Isotope Breakdown */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <h2 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-6">
          Isotope Breakdown
        </h2>
        <div className="space-y-4">
          {ISOTOPE_TYPES.map((isotope) => {
            const result = topic.isotopeResults[isotope];
            const prompt = prompts.find(p => p.isotope === isotope);

            return (
              <div
                key={isotope}
                className="rounded-lg border border-[#2A2D37] bg-[#22252F] p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-[#E5E7EB]">
                        {ISOTOPE_LABELS[isotope]}
                      </span>
                      <StatusBadge
                        cited={result.cited}
                        consistency={result.consistency}
                      />
                    </div>
                    <p className="text-sm text-[#6B7280]">
                      {ISOTOPE_DESCRIPTIONS[isotope]}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'flex h-12 w-20 items-center justify-center rounded border',
                      getHeatmapBgClass(result.consistency)
                    )}
                  >
                    <span className={cn('text-sm font-medium', getHeatmapTextClass(result.consistency))}>
                      {result.runsWithCitation}/{result.runs}
                    </span>
                  </div>
                </div>

                {/* Prompt text */}
                {prompt && (
                  <div className="mt-3 rounded bg-[#1A1D27] p-3">
                    <p className="text-sm text-[#9CA3AF] italic">
                      "{prompt.text}"
                    </p>
                  </div>
                )}

                {/* Stats row */}
                <div className="mt-3 flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-[#6B7280]">Citations: </span>
                    <span className="text-[#E5E7EB]">{result.citationCount}</span>
                  </div>
                  {result.avgPosition && (
                    <div>
                      <span className="text-[#6B7280]">Avg Position: </span>
                      <span style={{ color: getPositionColor(result.avgPosition) }}>
                        #{result.avgPosition.toFixed(1)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-[#6B7280]">Consistency: </span>
                    <span className={getHeatmapTextClass(result.consistency)}>
                      {(result.consistency * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Competitor citations */}
                <div className="mt-4 pt-3 border-t border-[#2A2D37]">
                  <span className="text-xs text-[#6B7280] uppercase tracking-wider">
                    Competitor Citations
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(result.competitorCitations).map(([competitor, count]) => (
                      <div
                        key={competitor}
                        className="flex items-center gap-2 rounded bg-[#1A1D27] px-2 py-1"
                      >
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: COMPETITOR_COLORS[competitor] || '#6B7280' }}
                        />
                        <span className="text-xs text-[#9CA3AF]">{competitor}</span>
                        <span className="text-xs font-medium text-[#E5E7EB]">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Competitive Overview for this topic */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <h2 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-4">
          Topic Competitive Overview
        </h2>
        <TopicCompetitorChart topic={topic} />
      </div>
    </div>
  );
}

function TopicCompetitorChart({ topic }: { topic: TopicResult }) {
  // Aggregate competitor citations across all isotopes
  const competitorTotals: Record<string, number> = {};
  let totalCitations = 0;

  for (const isotope of ISOTOPE_TYPES) {
    const result = topic.isotopeResults[isotope];
    for (const [competitor, count] of Object.entries(result.competitorCitations)) {
      competitorTotals[competitor] = (competitorTotals[competitor] || 0) + count;
      totalCitations += count;
    }
  }

  const sortedCompetitors = Object.entries(competitorTotals)
    .sort(([, a], [, b]) => b - a);

  const maxCitations = Math.max(...Object.values(competitorTotals));

  return (
    <div className="space-y-3">
      {sortedCompetitors.map(([competitor, count]) => {
        const percentage = totalCitations > 0 ? (count / totalCitations) * 100 : 0;
        const barWidth = (count / maxCitations) * 100;
        const color = COMPETITOR_COLORS[competitor] || '#6B7280';

        return (
          <div key={competitor}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#E5E7EB]">{competitor}</span>
              <span className="text-sm text-[#9CA3AF]">
                {count} citations ({percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#22252F]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
