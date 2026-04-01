'use client';

import { analyzedMetrics } from '@/lib/fixtures';
import { cn, slugToTitle } from '@/lib/utils';
import { Brain, Search, ArrowRight } from 'lucide-react';

interface LayerComparisonProps {
  serverGapData?: import('@/lib/db').GapRow[];
}

export function LayerComparison({ serverGapData }: LayerComparisonProps) {
  const topics = analyzedMetrics.topicResults;

  // Calculate parametric and RAG scores per topic
  const topicData = topics.map(topic => {
    const parametric = topic.parametricPresence.mentionRate * 100;
    const rag = topic.robustnessScore * 100;
    const gap = rag - parametric;

    return {
      id: topic.topicId,
      name: topic.topicName,
      parametric,
      rag,
      gap,
    };
  }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Parametric Panel */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Brain className="h-5 w-5 text-purple-400" />
          <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
            What AI Knows Without Searching
          </h3>
        </div>
        <p className="text-sm text-[#6B7280] mb-4">
          Parametric knowledge: How often your brand is mentioned when AI answers from memory.
        </p>
        <div className="space-y-3">
          {topicData.map(topic => (
            <div key={topic.id} className="flex items-center gap-3">
              <div className="w-32 text-sm text-[#9CA3AF] truncate">{topic.name}</div>
              <div className="flex-1 h-2 bg-[#22252F] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-400"
                  style={{ width: `${topic.parametric}%` }}
                />
              </div>
              <div className="w-12 text-right text-sm text-purple-400">
                {topic.parametric.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RAG Panel */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Search className="h-5 w-5 text-blue-400" />
          <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
            What AI Finds When Searching
          </h3>
        </div>
        <p className="text-sm text-[#6B7280] mb-4">
          RAG presence: How often your content is cited when AI actively searches for answers.
        </p>
        <div className="space-y-3">
          {topicData.map(topic => (
            <div key={topic.id} className="flex items-center gap-3">
              <div className="w-32 text-sm text-[#9CA3AF] truncate">{topic.name}</div>
              <div className="flex-1 h-2 bg-[#22252F] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-400"
                  style={{ width: `${topic.rag}%` }}
                />
              </div>
              <div className="w-12 text-right text-sm text-blue-400">
                {topic.rag.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GapBridges() {
  const topics = analyzedMetrics.topicResults;

  const topicData = topics.map(topic => {
    const parametric = topic.parametricPresence.mentionRate * 100;
    const rag = topic.robustnessScore * 100;
    const gap = rag - parametric;

    return {
      id: topic.topicId,
      name: topic.topicName,
      parametric,
      rag,
      gap,
    };
  }).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-4">
        Presence Gap Analysis
      </h3>
      <p className="text-sm text-[#6B7280] mb-6">
        The difference between parametric knowledge and RAG retrieval reveals opportunities.
        Positive gaps (blue) mean content outperforms brand recognition. Negative gaps (orange)
        mean the opposite.
      </p>
      <div className="space-y-3">
        {topicData.map(topic => (
          <div key={topic.id} className="flex items-center gap-4">
            <div className="w-36 text-sm text-[#9CA3AF] truncate">{topic.name}</div>
            <div className="flex-1 relative h-6">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#363944]" />

              {/* Gap bar */}
              {topic.gap !== 0 && (
                <div
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 h-4 rounded',
                    topic.gap > 0 ? 'bg-blue-400/60' : 'bg-amber-400/60'
                  )}
                  style={{
                    left: topic.gap > 0 ? '50%' : `${50 + topic.gap / 2}%`,
                    width: `${Math.abs(topic.gap) / 2}%`,
                  }}
                />
              )}

              {/* Dots */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-purple-400 border-2 border-[#1A1D27]"
                style={{ left: `${topic.parametric / 2}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-blue-400 border-2 border-[#1A1D27]"
                style={{ left: `${50 + topic.rag / 2}%` }}
              />
            </div>
            <div className="w-16 text-right">
              <span className={cn(
                'text-sm font-medium',
                topic.gap > 0 ? 'text-blue-400' : topic.gap < 0 ? 'text-amber-400' : 'text-[#6B7280]'
              )}>
                {topic.gap > 0 ? '+' : ''}{topic.gap.toFixed(0)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-[#2A2D37] flex items-center justify-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-purple-400" />
          <span className="text-[#9CA3AF]">Parametric</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-400" />
          <span className="text-[#9CA3AF]">RAG</span>
        </div>
      </div>
    </div>
  );
}
