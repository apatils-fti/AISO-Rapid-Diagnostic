'use client';

import { cn } from '@/lib/utils';
import { getScoreColor, getScoreTextClass } from '@/lib/colors';

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function ScoreGauge({
  score,
  size = 'md',
  showLabel = true,
  label = 'Score',
  className,
}: ScoreGaugeProps) {
  const radius = {
    sm: 30,
    md: 45,
    lg: 60,
    xl: 80,
  }[size];

  const strokeWidth = {
    sm: 4,
    md: 6,
    lg: 8,
    xl: 10,
  }[size];

  const fontSize = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  }[size];

  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const svgSize = (radius + strokeWidth) * 2;
  const center = radius + strokeWidth;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative">
        <svg
          width={svgSize}
          height={svgSize}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#2A2D37"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={getScoreColor(score)}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-data font-bold', fontSize, getScoreTextClass(score))}>
            {score}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="mt-2 text-sm text-[#9CA3AF]">{label}</span>
      )}
    </div>
  );
}

interface LinearScoreProps {
  score: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function LinearScore({
  score,
  label,
  showValue = true,
  size = 'md',
  className,
}: LinearScoreProps) {
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between">
          {label && <span className="text-sm text-[#9CA3AF]">{label}</span>}
          {showValue && (
            <span className={cn('text-sm font-medium', getScoreTextClass(score))}>
              {score}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full bg-[#2A2D37]',
          size === 'sm' && 'h-1.5',
          size === 'md' && 'h-2'
        )}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${score}%`,
            backgroundColor: getScoreColor(score),
          }}
        />
      </div>
    </div>
  );
}
