import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'large' | 'compact';
  className?: string;
}

export function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-4 card-hover',
        variant === 'large' && 'p-6',
        variant === 'compact' && 'p-3',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#9CA3AF]">{label}</p>
          <p
            className={cn(
              'mt-1 font-heading font-semibold text-[#E5E7EB]',
              variant === 'large' && 'text-3xl',
              variant === 'default' && 'text-2xl',
              variant === 'compact' && 'text-xl'
            )}
          >
            {value}
          </p>
          {subValue && (
            <p className="mt-1 text-sm text-[#6B7280]">{subValue}</p>
          )}
          {trend && trendValue && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  'text-sm font-medium',
                  trend === 'up' && 'text-emerald-400',
                  trend === 'down' && 'text-red-400',
                  trend === 'neutral' && 'text-[#9CA3AF]'
                )}
              >
                {trend === 'up' && '↑'}
                {trend === 'down' && '↓'}
                {trendValue}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-[#22252F] p-2">
            <Icon className="h-5 w-5 text-[#9CA3AF]" />
          </div>
        )}
      </div>
    </div>
  );
}
