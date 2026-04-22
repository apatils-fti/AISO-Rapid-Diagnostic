'use client';

import { InfoTooltip } from '@/components/shared';
import { ISOTOPE_TYPES, ISOTOPE_LABELS, ISOTOPE_DESCRIPTIONS } from '@/lib/taxonomy';
import type { HeatmapMode } from './IsotopeHeatmap';

interface IsotopeLegendProps {
  mode: HeatmapMode;
}

export function IsotopeLegend({ mode }: IsotopeLegendProps) {
  return (
    <div className="flex items-center gap-8 rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#6B7280]">Legend:</span>
      </div>
      <div className="flex items-center gap-6">
        {mode === 'citations' ? (
          <>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-emerald-500/50" />
              <span className="text-xs text-[#9CA3AF]">Consistently cited (67%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-lime-500/50" />
              <span className="text-xs text-[#9CA3AF]">Sometimes cited (33-66%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-amber-500/50" />
              <span className="text-xs text-[#9CA3AF]">Rarely cited (&lt;33%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-red-500/50" />
              <span className="text-xs text-[#9CA3AF]">Never cited</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-emerald-500/50" />
              <span className="text-xs text-[#9CA3AF]">High mentions (67%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-lime-500/50" />
              <span className="text-xs text-[#9CA3AF]">Moderate mentions (33-66%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-amber-500/50" />
              <span className="text-xs text-[#9CA3AF]">Low mentions (&lt;33%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-red-500/50" />
              <span className="text-xs text-[#9CA3AF]">Not mentioned</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function IsotopeHeaders() {
  return (
    <div className="flex items-center gap-4 px-3 py-2">
      <div className="w-48 flex-shrink-0">
        <span className="text-sm font-medium text-[#9CA3AF]">Topic</span>
      </div>
      <div className="flex flex-1 gap-2">
        {ISOTOPE_TYPES.map((isotope) => (
          <div key={isotope} className="flex-1 text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                {ISOTOPE_LABELS[isotope].slice(0, 4)}
              </span>
              <InfoTooltip content={ISOTOPE_DESCRIPTIONS[isotope]} />
            </div>
          </div>
        ))}
      </div>
      <div className="w-32 flex-shrink-0 text-center">
        <span className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
          Robustness
        </span>
      </div>
      <div className="w-5 flex-shrink-0" /> {/* Spacer for arrow */}
    </div>
  );
}
