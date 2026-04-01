'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScoreColor, getScoreTextClass } from '@/lib/colors';
import { LucideIcon } from 'lucide-react';

interface SubMetric {
  label: string;
  value: string;
}

interface PillarCardProps {
  title: string;
  score: number;
  icon: LucideIcon;
  subMetrics: SubMetric[];
  formula?: string;
  className?: string;
}

export function PillarCard({ title, score, icon: Icon, subMetrics, formula, className }: PillarCardProps) {
  const [formulaOpen, setFormulaOpen] = useState(false);
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
    </div>
  );
}
