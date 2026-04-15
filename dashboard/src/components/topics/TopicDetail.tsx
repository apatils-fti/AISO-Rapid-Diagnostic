'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Link2, MessageSquare } from 'lucide-react';
import { ScoreGauge, Badge, StatusBadge, LinearScore } from '@/components/shared';
import { ISOTOPE_TYPES, ISOTOPE_LABELS, ISOTOPE_DESCRIPTIONS, getPromptsForTopic, analyzedMetrics } from '@/lib/fixtures';
import { COMPETITOR_COLORS, getHeatmapBgClass, getHeatmapTextClass, getPositionColor } from '@/lib/colors';
import { PlatformResponseViewer } from './PlatformResponseViewer';
import { cn } from '@/lib/utils';
import type { TopicResult, IsotopeType } from '@/lib/types';

export type TopicDetailMode = 'citations' | 'mentions';

interface TopicDetailProps {
  topic: TopicResult;
}

export function TopicDetail({ topic }: TopicDetailProps) {
  const [mode, setMode] = useState<TopicDetailMode>('mentions');
  const prompts = getPromptsForTopic(topic.topicId);

  // Get mention metrics for this topic
  const topicMentionMetrics = analyzedMetrics.textMetrics?.byTopic?.[topic.topicId];

  // Calculate mention-based robustness
  const mentionRobustness = (topicMentionMetrics?.brandMetrics?.['J.Crew']?.mentionRate || 0) * 100;
  const displayRobustness = mode === 'citations'
    ? Math.round(topic.robustnessScore * 100)
    : Math.round(mentionRobustness);

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

      {/* Header with Toggle */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold text-[#E5E7EB]">
            {topic.topicName}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant="outline">{topic.category}</Badge>
            <span className="text-sm text-[#6B7280]">
              {mode === 'citations' ? 'Citation' : 'Mention'} Robustness: {displayRobustness}%
            </span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-1">
            <button
              onClick={() => setMode('citations')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'citations'
                  ? 'bg-[#00D4AA]/10 text-[#00D4AA]'
                  : 'text-[#9CA3AF] hover:text-[#E5E7EB]'
              )}
            >
              <Link2 className="h-4 w-4" />
              Citations
            </button>
            <button
              onClick={() => setMode('mentions')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'mentions'
                  ? 'bg-[#00D4AA]/10 text-[#00D4AA]'
                  : 'text-[#9CA3AF] hover:text-[#E5E7EB]'
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Mentions
            </button>
          </div>
          <ScoreGauge
            score={topic.overallScore}
            size="lg"
            label="Topic Score"
          />
        </div>
      </div>

      {/* Mention Performance (Mentions Mode) */}
      {mode === 'mentions' && topicMentionMetrics && (
        <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
          <h2 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-6">
            Brand Performance for {topic.topicName}
          </h2>
          <div className="grid grid-cols-2 gap-6">
            {/* J.Crew Metrics */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-[#00D4AA] mb-3">J.Crew (You)</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">Mention Rate</span>
                      <span className="text-sm font-medium text-[#E5E7EB]">
                        {(topicMentionMetrics.brandMetrics['J.Crew'].mentionRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <LinearScore
                      score={topicMentionMetrics.brandMetrics['J.Crew'].mentionRate * 100}
                      size="sm"
                      showValue={false}
                    />
                    <p className="text-xs text-[#6B7280] mt-1">
                      Mentioned in {Math.round(topicMentionMetrics.brandMetrics['J.Crew'].mentionRate * 100)}% of responses
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">First Mention Rate</span>
                      <span className="text-sm font-medium text-[#E5E7EB]">
                        {(topicMentionMetrics.brandMetrics['J.Crew'].firstMentionRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <LinearScore
                      score={topicMentionMetrics.brandMetrics['J.Crew'].firstMentionRate * 100}
                      size="sm"
                      showValue={false}
                    />
                    <p className="text-xs text-[#6B7280] mt-1">
                      Mentioned first in responses
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">Avg Mentions Per Response</span>
                      <span className="text-sm font-medium text-[#E5E7EB]">
                        {topicMentionMetrics.brandMetrics['J.Crew'].avgMentionCount.toFixed(1)}x
                      </span>
                    </div>
                    <LinearScore
                      score={Math.min(topicMentionMetrics.brandMetrics['J.Crew'].avgMentionCount * 20, 100)}
                      size="sm"
                      showValue={false}
                    />
                  </div>
                  <div className="pt-3 border-t border-[#2A2D37]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">Total Mentions</span>
                      <span className="text-lg font-bold text-[#00D4AA]">
                        {topicMentionMetrics.brandMetrics['J.Crew'].totalMentions.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Topic-Level Stats */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-[#E5E7EB] mb-3">Topic Statistics</h3>
                <div className="space-y-3">
                  <div className="rounded bg-[#22252F] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">Share of Voice</span>
                      <span className="text-lg font-bold text-[#E5E7EB]">
                        {(topicMentionMetrics.shareOfVoice * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      J.Crew's share of all brand mentions in this topic
                    </p>
                  </div>
                  <div className="rounded bg-[#22252F] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">Avg Mention Position</span>
                      <span className="text-lg font-bold text-[#E5E7EB]">
                        #{topicMentionMetrics.avgMentionPosition.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      Average position when mentioned in responses
                    </p>
                  </div>
                  <div className="rounded bg-[#22252F] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">Total Responses</span>
                      <span className="text-lg font-bold text-[#E5E7EB]">
                        {topicMentionMetrics.totalResponses.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      {topicMentionMetrics.responsesWithMention} contained brand mentions
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Isotope Breakdown (Citations Mode) */}
      {mode === 'citations' && (
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
      )}

      {/* Multi-Platform AI Responses */}
      <PlatformResponseViewer topicId={topic.topicId} />

      {/* Competitive Overview for this topic */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <h2 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-4">
          {mode === 'citations' ? 'Topic Competitive Overview (Citations)' : 'Competitor Mention Comparison'}
        </h2>
        {mode === 'citations' ? (
          <TopicCompetitorChart topic={topic} />
        ) : (
          <TopicMentionComparisonChart topicId={topic.topicId} />
        )}
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

function TopicMentionComparisonChart({ topicId }: { topicId: string }) {
  const topicMetrics = analyzedMetrics.textMetrics?.byTopic?.[topicId];

  if (!topicMetrics) {
    return (
      <p className="text-sm text-[#6B7280]">No mention data available for this topic.</p>
    );
  }

  // Sort competitors by mention rate
  const sortedCompetitors = Object.entries(topicMetrics.brandMetrics)
    .sort(([, a], [, b]) => b.mentionRate - a.mentionRate);

  const maxMentionRate = Math.max(...Object.values(topicMetrics.brandMetrics).map(m => m.mentionRate));

  return (
    <div className="space-y-4">
      {sortedCompetitors.map(([competitor, metrics]) => {
        const barWidth = (metrics.mentionRate / maxMentionRate) * 100;
        const color = COMPETITOR_COLORS[competitor] || '#6B7280';
        const isClient = competitor === 'J.Crew';

        return (
          <div
            key={competitor}
            className={cn(
              'rounded-lg border p-4',
              isClient ? 'border-[#00D4AA]/30 bg-[#00D4AA]/5' : 'border-[#2A2D37] bg-[#22252F]'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className={cn(
                  'text-sm font-medium',
                  isClient ? 'text-[#00D4AA]' : 'text-[#E5E7EB]'
                )}>
                  {competitor}
                  {isClient && ' (You)'}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs text-[#6B7280]">Mention Rate</div>
                  <div className="text-sm font-medium text-[#E5E7EB]">
                    {(metrics.mentionRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#6B7280]">Total Mentions</div>
                  <div className="text-sm font-medium text-[#E5E7EB]">
                    {metrics.totalMentions.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-[#1A1D27]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: color }}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#6B7280]">First Mention Rate: </span>
                <span className="text-[#E5E7EB]">{(metrics.firstMentionRate * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-[#6B7280]">Avg Count: </span>
                <span className="text-[#E5E7EB]">{metrics.avgMentionCount.toFixed(1)}x</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
