'use client';

import { Lightbulb } from 'lucide-react';
import type { GapRow } from '@/lib/db';

interface GapInsightCardProps {
  serverGapData?: GapRow[];
  clientName?: string;
}

// Computes a one-line narrative summary of the client's worst topic gaps,
// plus a severity badge based on the biggest single gap. Replaces the old
// hand-authored "insight" + "recommendations" prose that shipped baked into
// the J.Crew fixture (see TODOS.md note about the recs path needing a real
// generation step — for now we just surface the data).

function pickSeverity(maxGap: number): { label: string; color: string } {
  if (maxGap > 0.15) return { label: 'Critical Gaps', color: '#EF4444' };
  if (maxGap > 0.08) return { label: 'Significant Gaps', color: '#F59E0B' };
  if (maxGap > 0) return { label: 'Minor Gaps', color: '#3B82F6' };
  return { label: 'Strong Position', color: '#10B981' };
}

function formatTopicList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function buildInsight(gaps: GapRow[], clientName: string): string {
  const top3 = gaps.slice(0, 3).filter((g) => g.gap > 0);
  if (top3.length === 0) {
    return `${clientName} has no significant visibility gaps in the topics tracked — competitors aren't pulling away on any topic right now.`;
  }

  const topicList = formatTopicList(top3.map((g) => g.topicName));

  // Pick the most-frequent top competitor across the worst gaps. If multiple
  // competitors tie, the first one found wins — the message doesn't depend
  // on the tie-break being principled.
  const compCounts = new Map<string, number>();
  for (const g of top3) {
    compCounts.set(g.topCompetitor, (compCounts.get(g.topCompetitor) ?? 0) + 1);
  }
  const dominant = [...compCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  // Mention rate: average across the top3 entries where this competitor leads.
  const dominantRows = top3.filter((g) => g.topCompetitor === dominant);
  const dominantAvg =
    dominantRows.reduce((s, g) => s + g.competitorRate, 0) / Math.max(1, dominantRows.length);

  return (
    `${clientName} has significant visibility gaps in ${topicList}. ` +
    `Leading competitor ${dominant} dominates these areas with ${(dominantAvg * 100).toFixed(0)}% mention rate.`
  );
}

export function GapInsightCard({ serverGapData, clientName }: GapInsightCardProps) {
  const gaps = serverGapData ?? [];
  const displayName = clientName || 'This client';
  const maxGap = gaps.reduce((m, g) => (g.gap > m ? g.gap : m), 0);
  const severity = pickSeverity(maxGap);
  const insight = buildInsight(gaps, displayName);

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-amber-500/20 p-3">
          <Lightbulb className="h-6 w-6 text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
              Diagnostic Insight
            </h3>
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: `${severity.color}20`, color: severity.color }}
            >
              {severity.label}
            </span>
          </div>
          <p className="text-[#9CA3AF] leading-relaxed">{insight}</p>
        </div>
      </div>
    </div>
  );
}
