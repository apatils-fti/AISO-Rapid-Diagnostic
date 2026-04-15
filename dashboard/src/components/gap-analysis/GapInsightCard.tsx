'use client';

import { Lightbulb, CheckCircle2 } from 'lucide-react';
import { analyzedMetrics } from '@/lib/fixtures';

interface GapInsightCardProps {
  serverGapData?: import('@/lib/db').GapRow[];
}

export function GapInsightCard({ serverGapData }: GapInsightCardProps) {
  const { gapAnalysis } = analyzedMetrics;

  const quadrantLabels: Record<string, { label: string; color: string }> = {
    'high-parametric-high-rag': { label: 'Strong Position', color: '#10B981' },
    'high-parametric-low-rag': { label: 'Known Brand, Content Invisible', color: '#F59E0B' },
    'low-parametric-high-rag': { label: 'Content Discoverable, Brand Unknown', color: '#3B82F6' },
    'low-parametric-low-rag': { label: 'Invisible', color: '#EF4444' },
    'low-parametric-moderate-rag': { label: 'Content Discoverable, Brand Unknown', color: '#3B82F6' },
  };

  const quadrantInfo = quadrantLabels[gapAnalysis.quadrant] || quadrantLabels['low-parametric-low-rag'];

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <div className="flex items-start gap-4 mb-6">
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
              style={{ backgroundColor: `${quadrantInfo.color}20`, color: quadrantInfo.color }}
            >
              {quadrantInfo.label}
            </span>
          </div>
          <p className="text-[#9CA3AF] leading-relaxed">
            {gapAnalysis.insight}
          </p>
        </div>
      </div>

      <div className="border-t border-[#2A2D37] pt-6">
        <h4 className="font-medium text-[#E5E7EB] mb-4">Recommendations</h4>
        <div className="space-y-3">
          {gapAnalysis.recommendations.map((rec, index) => (
            <div key={index} className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#00D4AA] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-[#9CA3AF]">{rec}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[#2A2D37] flex items-center justify-between text-sm">
        <div>
          <span className="text-[#6B7280]">Parametric Score: </span>
          <span className="font-medium text-purple-400">{gapAnalysis.parametricScore}</span>
        </div>
        <div>
          <span className="text-[#6B7280]">RAG Score: </span>
          <span className="font-medium text-blue-400">{gapAnalysis.ragScore}</span>
        </div>
        <div>
          <span className="text-[#6B7280]">Gap: </span>
          <span className="font-medium text-amber-400">
            {gapAnalysis.ragScore - gapAnalysis.parametricScore > 0 ? '+' : ''}
            {gapAnalysis.ragScore - gapAnalysis.parametricScore}
          </span>
        </div>
      </div>
    </div>
  );
}
