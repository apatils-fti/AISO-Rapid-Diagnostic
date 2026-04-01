'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Bot, Globe, Gem, Search, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { getAllPlatformStats, type PlatformStats } from '@/lib/platform-data';
import type { PlatformComparisonStats } from '@/lib/db';
import { cn } from '@/lib/utils';

const PLATFORM_ICONS: Record<string, typeof Sparkles> = {
  perplexity: Sparkles,
  chatgpt_search: Bot,
  gemini: Gem,
  claude: Bot,
  google_ai_overview: Search,
};

function DeltaIndicator({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (Math.abs(value) < 0.1) {
    return (
      <span className="inline-flex items-center gap-1 text-[#6B7280]">
        <Minus className="h-3 w-3" />
        <span className="text-xs">Same</span>
      </span>
    );
  }

  const isPositive = value > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'
      )}
    >
      {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      <span className="text-xs font-medium">
        {isPositive ? '+' : ''}
        {value.toFixed(1)}
        {suffix}
      </span>
    </span>
  );
}

function PlatformCard({
  platform,
  compareWith,
}: {
  platform: PlatformStats;
  compareWith?: PlatformStats;
}) {
  const Icon = PLATFORM_ICONS[platform.platform] ?? Bot;

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex items-center justify-center rounded-lg p-3"
          style={{ backgroundColor: `${platform.color}20` }}
        >
          <Icon className="h-6 w-6" style={{ color: platform.color }} />
        </div>
        <div>
          <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
            {platform.displayName}
          </h3>
          {platform.available ? (
            <span className="text-xs text-[#10B981]">Active</span>
          ) : (
            <span className="text-xs text-[#6B7280]">No Data</span>
          )}
        </div>
      </div>

      {platform.available ? (
        <div className="space-y-4">
          {/* PRIMARY: Brand Mention Rate */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Brand Mention Rate</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-[#00D4AA]">
                {(platform.brandMentionRate * 100).toFixed(1)}%
              </span>
              {compareWith?.available && (
                <DeltaIndicator
                  value={
                    (platform.brandMentionRate - compareWith.brandMentionRate) *
                    100
                  }
                  suffix="%"
                />
              )}
            </div>
          </div>

          {/* Prompts with Mention */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Prompts Mentioned</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-[#E5E7EB]">
                {platform.promptsWithMention}/{platform.totalPrompts}
              </span>
              {compareWith?.available && (
                <DeltaIndicator
                  value={
                    platform.promptsWithMention - compareWith.promptsWithMention
                  }
                />
              )}
            </div>
          </div>

          {/* First Mention Rate */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">First Mention Rate</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-[#E5E7EB]">
                {(platform.firstMentionRate * 100).toFixed(1)}%
              </span>
              {compareWith?.available && (
                <DeltaIndicator
                  value={
                    (platform.firstMentionRate -
                      compareWith.firstMentionRate) *
                    100
                  }
                  suffix="%"
                />
              )}
            </div>
          </div>

          {/* SECONDARY: Citation Rate (only if platform has citations) */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Domain Citations</span>
            <div className="flex items-center gap-3">
              {platform.citationsAvailable ? (
                <span className="text-lg font-semibold text-[#E5E7EB]">
                  {(platform.citationRate * 100).toFixed(1)}%
                </span>
              ) : (
                <span className="text-sm text-[#6B7280] italic">N/A</span>
              )}
            </div>
          </div>

          {/* Coverage bar */}
          <div className="mt-4 pt-4 border-t border-[#2A2D37]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6B7280]">Mention Coverage</span>
              <span className="text-sm font-medium text-[#E5E7EB]">
                {(platform.brandMentionRate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#22252F] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${platform.brandMentionRate * 100}%`,
                  backgroundColor: platform.color,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-[#6B7280] py-8 text-center">
          No batch results available for this platform.
        </div>
      )}
    </div>
  );
}

interface PlatformComparisonProps {
  selectedPlatforms?: string[];
  platformData?: PlatformComparisonStats[];
}

export function PlatformComparison({ selectedPlatforms, platformData }: PlatformComparisonProps) {
  const [fetchedPlatforms, setFetchedPlatforms] = useState<PlatformStats[]>([]);

  useEffect(() => {
    // Skip client-side fetch if server data was provided
    if (platformData) return;
    if (typeof window === 'undefined') return;
    getAllPlatformStats().then(setFetchedPlatforms);
  }, [platformData]);

  // Use server-provided data if available, otherwise fall back to client fetch
  const allPlatforms: PlatformStats[] = platformData
    ? platformData.map(p => ({
        ...p,
        avgMentionCount: 0,
      }))
    : fetchedPlatforms;

  if (allPlatforms.length === 0) {
    return (
      <div className="text-center py-12 text-[#6B7280]">
        Loading platform data...
      </div>
    );
  }

  const platforms = selectedPlatforms
    ? allPlatforms.filter((p) => selectedPlatforms.includes(p.platform))
    : allPlatforms;

  // Use first visible platform as comparison baseline
  const baseline = platforms[0];

  const colClass =
    platforms.length <= 2
      ? 'lg:grid-cols-2'
      : platforms.length === 3
      ? 'lg:grid-cols-3'
      : 'lg:grid-cols-4';

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${colClass} gap-6`}>
      {platforms.map((platform, idx) => (
        <PlatformCard
          key={platform.platform}
          platform={platform}
          compareWith={idx === 0 ? platforms[1] : baseline}
        />
      ))}
    </div>
  );
}
