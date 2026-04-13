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
  className?: string;
}

export function PillarCard({ title, score, icon: Icon, subMetrics, className }: PillarCardProps) {
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
    </div>
  );
}
