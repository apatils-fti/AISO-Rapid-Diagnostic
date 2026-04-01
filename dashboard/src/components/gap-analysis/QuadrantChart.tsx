'use client';

import { analyzedMetrics, getFilteredBrandMetrics } from '@/lib/fixtures';
import { COMPETITOR_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';

interface QuadrantChartProps {
  selectedPlatforms?: string[];
  serverGapData?: import('@/lib/db').GapRow[];
}

export function QuadrantChart({ selectedPlatforms, serverGapData }: QuadrantChartProps) {
  const { competitorOverview, gapAnalysis } = analyzedMetrics;
  const filteredBrandMetrics = getFilteredBrandMetrics(selectedPlatforms);

  // Map competitors to coordinates
  const points = competitorOverview.map(c => {
    // Use filtered mention rate for Y-axis
    const mentionRate = filteredBrandMetrics[c.name]?.mentionRate || 0;

    return {
      name: c.name,
      x: c.parametricMentionRate * 100, // Parametric presence (knowledge in training data)
      y: mentionRate * 100, // Mention presence in responses
      isClient: c.isClient,
      color: COMPETITOR_COLORS[c.name] || COMPETITOR_COLORS.Other,
    };
  });

  // Chart dimensions
  const width = 100;
  const height = 100;
  const padding = 10;

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-6">
        Parametric vs. Response Mention Presence
      </h3>

      <div className="relative aspect-square max-w-2xl mx-auto">
        {/* Background quadrants */}
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Quadrant backgrounds */}
          <rect x="0" y="0" width="50" height="50" fill="#22252F" opacity="0.5" />
          <rect x="50" y="0" width="50" height="50" fill="#10B981" opacity="0.1" />
          <rect x="0" y="50" width="50" height="50" fill="#EF4444" opacity="0.1" />
          <rect x="50" y="50" width="50" height="50" fill="#F59E0B" opacity="0.1" />

          {/* Grid lines */}
          <line x1="50" y1="0" x2="50" y2="100" stroke="#2A2D37" strokeWidth="0.5" strokeDasharray="2,2" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#2A2D37" strokeWidth="0.5" strokeDasharray="2,2" />

          {/* Axis lines */}
          <line x1="0" y1="100" x2="100" y2="100" stroke="#363944" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2="100" stroke="#363944" strokeWidth="1" />

          {/* Points */}
          {points.map((point, i) => (
            <g key={point.name}>
              {/* Shadow for emphasis */}
              <circle
                cx={point.x}
                cy={100 - point.y}
                r={point.isClient ? 7 : 5}
                fill={point.color}
                opacity={0.3}
                className="blur-sm"
              />
              {/* Main point */}
              <circle
                cx={point.x}
                cy={100 - point.y}
                r={point.isClient ? 5 : 3.5}
                fill={point.color}
                stroke={point.isClient ? '#00D4AA' : 'none'}
                strokeWidth={point.isClient ? 1.5 : 0}
              />
            </g>
          ))}
        </svg>

        {/* Quadrant labels */}
        <div className="absolute top-2 left-2 text-xs text-[#9CA3AF]">
          Low Training Data,<br />High Mentions
        </div>
        <div className="absolute top-2 right-2 text-xs text-emerald-400 text-right">
          Strong<br />Position
        </div>
        <div className="absolute bottom-2 left-2 text-xs text-red-400">
          Invisible
        </div>
        <div className="absolute bottom-2 right-2 text-xs text-amber-400 text-right">
          Known in Training,<br />Low Mentions
        </div>

        {/* Axis labels */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-[#6B7280]">
          Parametric Presence (Training Data) →
        </div>
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-[#6B7280]">
          Response Mention Rate →
        </div>
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        {points.map(point => (
          <div key={point.name} className="flex items-center gap-2">
            <div
              className={cn(
                'h-3 w-3 rounded-full',
                point.isClient && 'ring-1 ring-[#00D4AA]'
              )}
              style={{ backgroundColor: point.color }}
            />
            <span className={cn(
              'text-sm',
              point.isClient ? 'text-[#00D4AA] font-medium' : 'text-[#9CA3AF]'
            )}>
              {point.name}
              {point.isClient && ' (You)'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
