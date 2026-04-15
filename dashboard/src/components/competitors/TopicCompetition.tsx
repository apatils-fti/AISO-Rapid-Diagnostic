'use client';

import { analyzedMetrics, getFilteredTopicBrandMetrics } from '@/lib/fixtures';
import { COMPETITOR_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { Crown } from 'lucide-react';
import type { CompetitorOverviewRow, TopicIsotopeRow } from '@/lib/db';

interface TopicCompetitionProps {
  mode?: string;
  selectedPlatforms?: string[];
  serverData?: CompetitorOverviewRow[];
  serverTopicData?: TopicIsotopeRow[];
}

export function TopicCompetition({ mode = 'mentions', selectedPlatforms, serverData, serverTopicData }: TopicCompetitionProps) {
  const { competitorOverview: competitors, topicResults: topics } = analyzedMetrics;

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] overflow-hidden">
      <div className="border-b border-[#2A2D37] bg-[#22252F] px-6 py-4">
        <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-2">
          Topic-Level Competition
        </h3>
        <p className="text-sm text-[#9CA3AF]">
          {mode === 'citations'
            ? 'Citation share per topic - which brands get cited for each topic area'
            : 'Mention rates per topic - which brands are discussed most in each topic area'}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2A2D37] bg-[#22252F]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                Topic
              </th>
              {competitors.map(c => (
                <th
                  key={c.name}
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider"
                  style={{ color: COMPETITOR_COLORS[c.name] || '#9CA3AF' }}
                >
                  {c.name}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                Leader
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2D37]">
            {topics.map(topic => {
              // Find the shares for each competitor
              const filteredTopicMetrics = getFilteredTopicBrandMetrics(topic.topicId, selectedPlatforms);
              const shares = competitors.map(c => {
                let share = 0;
                if (mode === 'citations') {
                  share = c.topicShares[topic.topicId] || 0;
                } else {
                  share = filteredTopicMetrics[c.name]?.mentionRate || 0;
                }
                return {
                  name: c.name,
                  share,
                  isClient: c.isClient,
                };
              });

              // Find the leader
              const leader = shares.reduce((max, s) => s.share > max.share ? s : max, shares[0]);
              const maxShare = Math.max(...shares.map(s => s.share));

              return (
                <tr key={topic.topicId} className="hover:bg-[#22252F] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#E5E7EB] text-sm">
                      {topic.topicName}
                    </div>
                    <div className="text-xs text-[#6B7280]">
                      {topic.category}
                    </div>
                  </td>
                  {shares.map(s => {
                    const barWidth = maxShare > 0 ? (s.share / maxShare) * 100 : 0;
                    const color = COMPETITOR_COLORS[s.name] || COMPETITOR_COLORS.Other;

                    return (
                      <td key={s.name} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[#22252F] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: color,
                                opacity: s.isClient ? 1 : 0.6,
                              }}
                            />
                          </div>
                          <span
                            className={cn(
                              'text-xs w-10 text-right',
                              s.isClient ? 'text-[#00D4AA]' : 'text-[#9CA3AF]'
                            )}
                          >
                            {(s.share * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium"
                      style={{ color: COMPETITOR_COLORS[leader.name] || '#9CA3AF' }}
                    >
                      <Crown className="h-3 w-3" />
                      {leader.name}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
