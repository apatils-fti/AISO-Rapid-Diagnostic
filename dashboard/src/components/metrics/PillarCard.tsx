'use client';

import { useState } from 'react';
import { ChevronDown, MessageSquare, Eye, Shield, ShoppingCart, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScoreColor, getScoreTextClass } from '@/lib/colors';
import type { LucideIcon } from 'lucide-react';

const PILLAR_ICONS: Record<string, LucideIcon> = {
  'Visibility': Eye,
  'Trust': Shield,
  'Customer Acquisition': ShoppingCart,
  'Recommendation': ThumbsUp,
};

interface SubMetric {
  label: string;
  value: string;
}

export interface SampleResponse {
  promptText: string;
  platform: string;
  sentiment: string;
  responseText: string;
  clientMentioned: boolean;
}

interface PillarCardProps {
  title: string;
  score: number;
  subMetrics: SubMetric[];
  formula?: string;
  sampleResponses?: SampleResponse[];
  className?: string;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'text-emerald-400',
  neutral: 'text-[#6B7280]',
  hedged: 'text-amber-400',
  negative: 'text-red-400',
  not_mentioned: 'text-[#6B7280]',
};

export function PillarCard({ title, score, subMetrics, formula, sampleResponses, className }: PillarCardProps) {
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const Icon = PILLAR_ICONS[title] ?? Eye;
  const scoreColor = getScoreColor(score);

  return (
    <div
      className={cn(
        'rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-5 card-hover',
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
            {title}
          </p>
          <p
            className={cn('mt-1 text-3xl font-heading font-bold', getScoreTextClass(score))}
          >
            {score}
          </p>
        </div>
        <div className="rounded-lg bg-[#22252F] p-2.5">
          <Icon className="h-5 w-5" style={{ color: scoreColor }} />
        </div>
      </div>

      <div className="space-y-2 border-t border-[#2A2D37] pt-3">
        {subMetrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between">
            <span className="text-xs text-[#6B7280]">{metric.label}</span>
            <span className="text-sm font-medium text-[#E5E7EB]">{metric.value}</span>
          </div>
        ))}
      </div>

      {formula && (
        <div className="mt-3 border-t border-[#2A2D37] pt-2">
          <button
            onClick={() => setFormulaOpen(!formulaOpen)}
            className="flex w-full items-center justify-between py-1 text-xs text-[#6B7280] hover:text-[#9CA3AF] transition-colors"
          >
            <span>How is this calculated?</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', formulaOpen && 'rotate-180')} />
          </button>
          {formulaOpen && (
            <div className="mt-2 rounded bg-[#0F1117] border border-[#2A2D37] px-3 py-2">
              <p className="text-xs text-[#9CA3AF] font-mono leading-relaxed whitespace-pre-wrap">
                {formula}
              </p>
            </div>
          )}
        </div>
      )}

      {sampleResponses && sampleResponses.length > 0 && (
        <div className="mt-3 border-t border-[#2A2D37] pt-2">
          <button
            onClick={() => setResponsesOpen(!responsesOpen)}
            className="flex w-full items-center justify-between py-1 text-xs text-[#6B7280] hover:text-[#9CA3AF] transition-colors"
          >
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Sample responses ({sampleResponses.length})
            </span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', responsesOpen && 'rotate-180')} />
          </button>
          {responsesOpen && (
            <div className="mt-2 space-y-2">
              {sampleResponses.map((resp, idx) => (
                <div key={idx} className="rounded bg-[#0F1117] border border-[#2A2D37] px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#9CA3AF] truncate max-w-[70%]">
                      {resp.promptText.length > 60 ? resp.promptText.slice(0, 60) + '...' : resp.promptText}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#22252F] text-[#9CA3AF]">
                        {resp.platform}
                      </span>
                      <span className={cn('text-[10px] font-medium', SENTIMENT_COLORS[resp.sentiment] || 'text-[#6B7280]')}>
                        {resp.sentiment}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#E5E7EB] leading-relaxed">
                    {expandedIdx === idx
                      ? resp.responseText
                      : resp.responseText.length > 300
                        ? resp.responseText.slice(0, 300) + '...'
                        : resp.responseText}
                  </p>
                  {resp.responseText.length > 300 && (
                    <button
                      onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                      className="mt-1 text-[10px] text-[#00D4AA] hover:text-[#00D4AA]/80"
                    >
                      {expandedIdx === idx ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
