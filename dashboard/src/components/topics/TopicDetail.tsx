'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Link2, MessageSquare } from 'lucide-react';
import { ScoreGauge, Badge, LinearScore } from '@/components/shared';
import { COMPETITOR_COLORS, getHeatmapBgClass, getHeatmapTextClass } from '@/lib/colors';
import { PlatformResponseViewer } from './PlatformResponseViewer';
import { cn } from '@/lib/utils';
import type { TopicDetailData } from '@/lib/db';

export type TopicDetailMode = 'citations' | 'mentions';

// Isotope taxonomy inlined locally — these are pure presentation strings, not
// J.Crew-specific data. Keeping them here avoids pulling @/lib/fixtures (and
// the J.Crew analyzedMetrics snapshot) into this component's import graph.
const ISOTOPE_ORDER = [
  'informational',
  'commercial',
  'comparative',
  'persona',
  'specific',
  'conversational',
] as const;

const ISOTOPE_LABELS: Record<string, string> = {
  informational: 'Informational',
  commercial: 'Commercial',
  comparative: 'Comparative',
  persona: 'Persona',
  specific: 'Specific',
  conversational: 'Conversational',
};

const ISOTOPE_DESCRIPTIONS: Record<string, string> = {
  informational: 'Educational queries asking "What is X?"',
  commercial: 'Buying intent queries like "Best X tools"',
  comparative: 'Head-to-head queries like "X vs Y vs Z"',
  persona: 'Role-based queries like "As a [role], what should I use?"',
  specific: 'Narrow, detailed queries with multiple requirements',
  conversational: 'Natural, casual phrasing like real user questions',
};

interface TopicDetailProps {
  serverData: TopicDetailData;
}

export function TopicDetail({ serverData }: TopicDetailProps) {
  const [mode, setMode] = useState<TopicDetailMode>('mentions');

  const topic = serverData;
  const youLabel = topic.clientName || 'You';

  // Topic-level score used in the hero gauge. Uses the client mention rate
  // (0–1) as a 0–100 score — same interpretation as the rest of the dashboard
  // where "score" and "mention rate" are treated interchangeably for topic
  // health.
  const topicScore = Math.round(topic.clientMentionRate * 100);
  const citationRobustness =
    topic.isotopes.length > 0
      ? Math.round(
          (topic.isotopes.reduce((s, i) => s + i.citationRate, 0) / topic.isotopes.length) * 100
        )
      : 0;
  const displayRobustness = mode === 'citations' ? citationRobustness : topicScore;

  // Stable isotope ordering — show the known taxonomy first, then any
  // isotope the data surfaces that isn't in the canonical list.
  const isotopeMap = new Map(topic.isotopes.map((i) => [i.isotope, i] as const));
  const orderedIsotopes = [
    ...ISOTOPE_ORDER.filter((iso) => isotopeMap.has(iso)).map((iso) => isotopeMap.get(iso)!),
    ...topic.isotopes.filter((i) => !ISOTOPE_ORDER.includes(i.isotope as (typeof ISOTOPE_ORDER)[number])),
  ];

  const topCompetitor = topic.competitors.find((c) => !c.isClient);

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
            <span className="text-sm text-[#6B7280]">
              {mode === 'citations' ? 'Citation' : 'Mention'} Rate: {displayRobustness}%
            </span>
            <Badge variant="outline">
              {topic.totalResponses} responses
            </Badge>
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
          <ScoreGauge score={topicScore} size="lg" label="Topic Score" />
        </div>
      </div>

      {/* Mention Performance (Mentions Mode) */}
      {mode === 'mentions' && (
        <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
          <h2 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-6">
            Brand Performance for {topic.topicName}
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-[#00D4AA] mb-3">
                  {youLabel} {topic.clientName && '(You)'}
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">Mention Rate</span>
                      <span className="text-sm font-medium text-[#E5E7EB]">
                        {(topic.clientMentionRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <LinearScore
                      score={topic.clientMentionRate * 100}
                      size="sm"
                      showValue={false}
                    />
                    <p className="text-xs text-[#6B7280] mt-1">
                      Mentioned in {Math.round(topic.clientMentionRate * 100)}% of responses
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">First Mention Rate</span>
                      <span className="text-sm font-medium text-[#E5E7EB]">
                        {(topic.clientFirstMentionRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <LinearScore
                      score={topic.clientFirstMentionRate * 100}
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
                        {topic.clientAvgMentionCount.toFixed(1)}x
                      </span>
                    </div>
                    <LinearScore
                      score={Math.min(topic.clientAvgMentionCount * 20, 100)}
                      size="sm"
                      showValue={false}
                    />
                  </div>
                  <div className="pt-3 border-t border-[#2A2D37]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[#6B7280]">Total Mentions</span>
                      <span className="text-lg font-bold text-[#00D4AA]">
                        {topic.clientTotalMentions.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-[#E5E7EB] mb-3">Topic Statistics</h3>
                <div className="space-y-3">
                  <div className="rounded bg-[#22252F] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">Share of Voice</span>
                      <span className="text-lg font-bold text-[#E5E7EB]">
                        {(topic.clientShareOfVoice * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      {youLabel}'s share of all brand mentions in this topic
                    </p>
                  </div>
                  <div className="rounded bg-[#22252F] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">Top Competitor</span>
                      <span className="text-sm font-medium text-[#E5E7EB]">
                        {topCompetitor?.name ?? '—'}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      {topCompetitor
                        ? `${(topCompetitor.mentionRate * 100).toFixed(1)}% mention rate on this topic`
                        : 'No competitor data for this topic yet'}
                    </p>
                  </div>
                  <div className="rounded bg-[#22252F] p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[#6B7280]">Total Responses</span>
                      <span className="text-lg font-bold text-[#E5E7EB]">
                        {topic.totalResponses.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      {topic.responsesWithMention} contained brand mentions
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
            {orderedIsotopes.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No isotope data for this topic.</p>
            ) : (
              orderedIsotopes.map((result) => (
                <div
                  key={result.isotope}
                  className="rounded-lg border border-[#2A2D37] bg-[#22252F] p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-[#E5E7EB]">
                          {ISOTOPE_LABELS[result.isotope] ?? result.isotope}
                        </span>
                        <Badge
                          variant={result.citationRate > 0.5 ? 'success' : result.citationRate > 0 ? 'outline' : 'error'}
                          size="sm"
                        >
                          {result.citationRate > 0.5 ? 'Strong' : result.citationRate > 0 ? 'Partial' : 'None'}
                        </Badge>
                      </div>
                      <p className="text-sm text-[#6B7280]">
                        {ISOTOPE_DESCRIPTIONS[result.isotope] ?? ''}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'flex h-12 w-20 items-center justify-center rounded border',
                        getHeatmapBgClass(result.citationRate)
                      )}
                    >
                      <span className={cn('text-sm font-medium', getHeatmapTextClass(result.citationRate))}>
                        {result.responsesWithCitation}/{result.totalResponses}
                      </span>
                    </div>
                  </div>

                  {/* Sample prompt text */}
                  {result.samplePromptText && (
                    <div className="mt-3 rounded bg-[#1A1D27] p-3">
                      <p className="text-sm text-[#9CA3AF] italic">
                        &ldquo;{result.samplePromptText}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="mt-3 flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-[#6B7280]">Citations: </span>
                      <span className="text-[#E5E7EB]">{result.totalCitationCount}</span>
                    </div>
                    <div>
                      <span className="text-[#6B7280]">Mention Rate: </span>
                      <span className={getHeatmapTextClass(result.mentionRate)}>
                        {(result.mentionRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6B7280]">Citation Rate: </span>
                      <span className={getHeatmapTextClass(result.citationRate)}>
                        {(result.citationRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Competitor mentions within this isotope */}
                  {Object.keys(result.competitorMentions).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#2A2D37]">
                      <span className="text-xs text-[#6B7280] uppercase tracking-wider">
                        Competitor Mentions (this isotope)
                      </span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(result.competitorMentions)
                          .sort(([, a], [, b]) => b - a)
                          .map(([competitor, count]) => (
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
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Multi-Platform AI Responses — unchanged. PlatformResponseViewer reads
          from platform-data.ts which is already Supabase-backed for the active
          client via <PlatformDataProvider>. */}
      <PlatformResponseViewer topicId={topic.topicId} />

      {/* Competitive Overview for this topic */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <h2 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-4">
          {mode === 'citations' ? 'Topic Competitive Overview (Citations)' : 'Competitor Mention Comparison'}
        </h2>
        {mode === 'citations' ? (
          <TopicCompetitorChart isotopes={topic.isotopes} />
        ) : (
          <TopicMentionComparisonChart competitors={topic.competitors} />
        )}
      </div>
    </div>
  );
}

// Aggregates competitor mention counts across all isotopes for this topic and
// renders a horizontal-bar breakdown. Was previously keyed off
// `competitorCitations` in the J.Crew fixture (URL-citation counts); we now
// use `competitorMentions` (brand-name occurrences) from the enricher.
// Different source data, same visual story — "which competitor dominates
// this topic in the responses we've seen."
function TopicCompetitorChart({ isotopes }: { isotopes: TopicDetailData['isotopes'] }) {
  const totals: Record<string, number> = {};
  for (const iso of isotopes) {
    for (const [name, count] of Object.entries(iso.competitorMentions)) {
      totals[name] = (totals[name] ?? 0) + count;
    }
  }

  const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
  if (sorted.length === 0) {
    return <p className="text-sm text-[#6B7280]">No competitor mentions detected on this topic.</p>;
  }

  const totalMentions = sorted.reduce((s, [, c]) => s + c, 0);
  const maxMentions = Math.max(...sorted.map(([, c]) => c));

  return (
    <div className="space-y-3">
      {sorted.map(([competitor, count]) => {
        const percentage = totalMentions > 0 ? (count / totalMentions) * 100 : 0;
        const barWidth = maxMentions > 0 ? (count / maxMentions) * 100 : 0;
        const color = COMPETITOR_COLORS[competitor] || '#6B7280';

        return (
          <div key={competitor}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#E5E7EB]">{competitor}</span>
              <span className="text-sm text-[#9CA3AF]">
                {count} mentions ({percentage.toFixed(1)}%)
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

function TopicMentionComparisonChart({ competitors }: { competitors: TopicDetailData['competitors'] }) {
  if (competitors.length === 0) {
    return <p className="text-sm text-[#6B7280]">No mention data available for this topic.</p>;
  }

  const maxMentionRate = Math.max(0.01, ...competitors.map((c) => c.mentionRate));

  return (
    <div className="space-y-4">
      {competitors.map((competitor) => {
        const barWidth = (competitor.mentionRate / maxMentionRate) * 100;
        const color = COMPETITOR_COLORS[competitor.name] || '#6B7280';

        return (
          <div
            key={competitor.name || '—'}
            className={cn(
              'rounded-lg border p-4',
              competitor.isClient ? 'border-[#00D4AA]/30 bg-[#00D4AA]/5' : 'border-[#2A2D37] bg-[#22252F]'
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className={cn(
                  'font-medium',
                  competitor.isClient ? 'text-[#00D4AA]' : 'text-[#E5E7EB]'
                )}>
                  {competitor.name || '—'}
                  {competitor.isClient && <span className="ml-2 text-xs text-[#6B7280]">(You)</span>}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[#9CA3AF]">
                  {(competitor.mentionRate * 100).toFixed(1)}%
                </span>
                <span className="text-[#6B7280]">
                  {competitor.totalMentions.toLocaleString()} mentions
                </span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-[#1A1D27]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: color, opacity: competitor.isClient ? 1 : 0.7 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
