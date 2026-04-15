'use client';

import { AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { analyzedMetrics } from '@/lib/fixtures';

interface MentionGap {
  topicId: string;
  topicName: string;
  category: string;
  clientRate: number;
  topCompetitorName: string;
  topCompetitorRate: number;
  gap: number;
}

const CLIENT_NAME = 'J.Crew';

function findTopMentionGaps(): MentionGap[] {
  const gaps: MentionGap[] = [];
  const textMetrics = analyzedMetrics.textMetrics;
  if (!textMetrics) return gaps;

  for (const topic of analyzedMetrics.topicResults) {
    const topicMetrics = textMetrics.byTopic[topic.topicId];
    if (!topicMetrics) continue;

    const clientRate = topicMetrics.brandMetrics[CLIENT_NAME]?.mentionRate ?? 0;

    // Find the competitor with the highest mention rate for this topic
    let topCompetitorName = '';
    let topCompetitorRate = 0;

    for (const [brand, metrics] of Object.entries(topicMetrics.brandMetrics)) {
      if (brand === CLIENT_NAME) continue;
      if (metrics.mentionRate > topCompetitorRate) {
        topCompetitorName = brand;
        topCompetitorRate = metrics.mentionRate;
      }
    }

    const gap = topCompetitorRate - clientRate;
    if (gap > 0) {
      gaps.push({
        topicId: topic.topicId,
        topicName: topic.topicName,
        category: topic.category,
        clientRate,
        topCompetitorName,
        topCompetitorRate,
        gap,
      });
    }
  }

  // Sort by biggest gap first
  return gaps.sort((a, b) => b.gap - a.gap).slice(0, 5);
}

export function TopGapsCard() {
  const gaps = findTopMentionGaps();

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
            Top Opportunities
          </h3>
        </div>
        <Link
          href="/topics"
          className="flex items-center gap-1 text-sm text-[#00D4AA] hover:underline"
        >
          View all topics
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-4">
        {gaps.length === 0 ? (
          <p className="text-sm text-[#6B7280] text-center py-4">
            No mention gaps found — great coverage!
          </p>
        ) : (
          gaps.map((gap, index) => (
            <Link
              key={gap.topicId}
              href={`/topics/${gap.topicId}`}
              className="block rounded-lg border border-[#2A2D37] bg-[#22252F] p-4 hover:border-[#363944] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-500/20 text-xs font-medium text-amber-400">
                      {index + 1}
                    </span>
                    <span className="font-medium text-[#E5E7EB]">
                      {gap.topicName}
                    </span>
                    <span className="rounded bg-[#1A1D27] px-2 py-0.5 text-xs text-[#9CA3AF]">
                      {gap.category}
                    </span>
                  </div>
                  <p className="text-sm text-[#9CA3AF]">
                    {CLIENT_NAME} mentioned in{' '}
                    <span className="text-[#E5E7EB]">
                      {(gap.clientRate * 100).toFixed(0)}%
                    </span>{' '}
                    of responses.{' '}
                    <span className="text-[#E5E7EB]">{gap.topCompetitorName}</span>{' '}
                    leads at{' '}
                    <span className="text-amber-400">
                      {(gap.topCompetitorRate * 100).toFixed(0)}%
                    </span>
                    {' — '}
                    <span className="text-red-400">
                      {(gap.gap * 100).toFixed(0)}pt gap
                    </span>
                    .
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-[#6B7280] flex-shrink-0 mt-1" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
