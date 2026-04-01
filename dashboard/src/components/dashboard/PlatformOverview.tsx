'use client';

import { useState, useEffect } from 'react';
import { Lock, Sparkles, Bot, Gem, Search } from 'lucide-react';
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

function PlatformCard({ stats }: { stats: PlatformStats }) {
  const Icon = PLATFORM_ICONS[stats.platform] ?? Bot;

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        stats.available
          ? 'border-[#2A2D37] bg-[#1A1D27] hover:border-[#363944]'
          : 'border-[#2A2D37]/50 bg-[#1A1D27]/50'
      )}
    >
      {!stats.available && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#22252F] px-2 py-0.5 text-xs text-[#6B7280]">
            <Lock className="h-3 w-3" />
            No Data
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'flex items-center justify-center rounded-lg p-2',
            stats.available ? 'bg-[#22252F]' : 'bg-[#22252F]/50'
          )}
        >
          <Icon
            className="h-6 w-6"
            style={{ color: stats.available ? stats.color : '#6B7280' }}
          />
        </div>
        <span
          className={cn(
            'font-medium',
            stats.available ? 'text-[#E5E7EB]' : 'text-[#6B7280]'
          )}
        >
          {stats.displayName}
        </span>
      </div>

      {stats.available ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Brand Mention Rate</span>
            <span className="text-sm font-medium text-[#00D4AA]">
              {(stats.brandMentionRate * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Prompts Mentioned</span>
            <span className="text-sm font-medium text-[#E5E7EB]">
              {stats.promptsWithMention}/{stats.totalPrompts}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Domain Citations</span>
            <span className="text-sm font-medium text-[#E5E7EB]">
              {stats.citationsAvailable
                ? `${(stats.citationRate * 100).toFixed(1)}%`
                : 'N/A'}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-[#6B7280]">
          No batch results available for this platform.
        </div>
      )}
    </div>
  );
}

interface PlatformOverviewProps {
  selectedPlatforms?: string[];
  platformData?: PlatformComparisonStats[];
}

export function PlatformOverview({ selectedPlatforms, platformData }: PlatformOverviewProps) {
  const [allPlatforms, setAllPlatforms] = useState<PlatformStats[]>([]);

  useEffect(() => {
    // Use server-provided Supabase data if available
    if (platformData && platformData.length > 0) {
      setAllPlatforms(platformData.map(p => ({ ...p, avgMentionCount: 0 })));
      return;
    }
    if (typeof window === 'undefined') return;
    getAllPlatformStats().then(setAllPlatforms);
  }, [platformData]);

  const platforms = selectedPlatforms
    ? allPlatforms.filter((p) => selectedPlatforms.includes(p.platform))
    : allPlatforms;

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-4">
        Platform Coverage
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {allPlatforms.length === 0 ? (
          <div className="col-span-2 text-sm text-[#6B7280] text-center py-4">
            Loading platform data...
          </div>
        ) : (
          platforms.map((stats) => (
            <PlatformCard key={stats.platform} stats={stats} />
          ))
        )}
      </div>
    </div>
  );
}
