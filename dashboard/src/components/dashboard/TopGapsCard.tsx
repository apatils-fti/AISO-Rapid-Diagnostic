'use client';

import { AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { analyzedMetrics, ISOTOPE_LABELS } from '@/lib/fixtures';
import type { IsotopeType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface OpportunityGap {
  topicId: string;
  topicName: string;
  isotope: IsotopeType;
  dominantCompetitor: string;
  competitorShare: number;
  clientConsistency: number;
}

function findTopGaps(): OpportunityGap[] {
  const gaps: OpportunityGap[] = [];

  for (const topic of analyzedMetrics.topicResults) {
    for (const [isotope, result] of Object.entries(topic.isotopeResults)) {
      // Find gaps where client is not cited but competitors are
      if (result.consistency === 0) {
        const competitorCitations = result.competitorCitations;
        const topCompetitor = Object.entries(competitorCitations)
          .sort(([, a], [, b]) => b - a)[0];

        if (topCompetitor && topCompetitor[1] > 0) {
          gaps.push({
            topicId: topic.topicId,
            topicName: topic.topicName,
            isotope: isotope as IsotopeType,
            dominantCompetitor: topCompetitor[0],
            competitorShare: topCompetitor[1] / result.runs,
            clientConsistency: result.consistency,
          });
        }
      }
    }
  }

  // Sort by competitor dominance and return top 5
  return gaps
    .sort((a, b) => b.competitorShare - a.competitorShare)
    .slice(0, 5);
}

export function TopGapsCard() {
  const gaps = findTopGaps();

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
        {gaps.map((gap, index) => (
          <Link
            key={`${gap.topicId}-${gap.isotope}`}
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
                    {ISOTOPE_LABELS[gap.isotope]}
                  </span>
                </div>
                <p className="text-sm text-[#9CA3AF]">
                  You have <span className="text-red-400">zero presence</span> for{' '}
                  <span className="text-[#E5E7EB]">{ISOTOPE_LABELS[gap.isotope].toLowerCase()}</span> queries.{' '}
                  <span className="text-[#E5E7EB]">{gap.dominantCompetitor}</span> dominates with{' '}
                  <span className="text-amber-400">
                    {(gap.competitorShare * 100).toFixed(0)}%
                  </span>{' '}
                  citation rate.
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-[#6B7280] flex-shrink-0 mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
