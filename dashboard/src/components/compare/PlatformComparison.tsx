'use client';

import { Sparkles, Bot, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { analyzedMetrics } from '@/lib/fixtures';
import { cn } from '@/lib/utils';

interface PlatformData {
  name: string;
  key: string;
  icon: typeof Sparkles;
  color: string;
  available: boolean;
  citationShare: number;
  promptsCited: number;
  totalPrompts: number;
  avgPosition: number;
  brandMentionRate: number;
}

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

function PlatformCard({ platform, compareWith }: { platform: PlatformData; compareWith?: PlatformData }) {
  const Icon = platform.icon;

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
            {platform.name}
          </h3>
          {platform.available ? (
            <span className="text-xs text-[#10B981]">Active</span>
          ) : (
            <span className="text-xs text-[#6B7280]">Coming Soon</span>
          )}
        </div>
      </div>

      {platform.available ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Citation Share</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-[#00D4AA]">
                {(platform.citationShare * 100).toFixed(1)}%
              </span>
              {compareWith?.available && (
                <DeltaIndicator
                  value={(platform.citationShare - compareWith.citationShare) * 100}
                  suffix="%"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Prompts Cited</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-[#E5E7EB]">
                {platform.promptsCited}/{platform.totalPrompts}
              </span>
              {compareWith?.available && (
                <DeltaIndicator
                  value={platform.promptsCited - compareWith.promptsCited}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Avg. Position</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-[#E5E7EB]">
                #{platform.avgPosition.toFixed(1)}
              </span>
              {compareWith?.available && (
                <DeltaIndicator
                  value={-(platform.avgPosition - compareWith.avgPosition)}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Brand Mention Rate</span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-[#E5E7EB]">
                {(platform.brandMentionRate * 100).toFixed(1)}%
              </span>
              {compareWith?.available && (
                <DeltaIndicator
                  value={(platform.brandMentionRate - compareWith.brandMentionRate) * 100}
                  suffix="%"
                />
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#2A2D37]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6B7280]">Coverage Rate</span>
              <span className="text-sm font-medium text-[#E5E7EB]">
                {((platform.promptsCited / platform.totalPrompts) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#22252F] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(platform.promptsCited / platform.totalPrompts) * 100}%`,
                  backgroundColor: platform.color,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-[#6B7280] py-8 text-center">
          Data collection for this platform is in development.
        </div>
      )}
    </div>
  );
}

export function PlatformComparison() {
  const { platformBreakdown } = analyzedMetrics.summary;

  // Build platform data from fixtures
  const perplexityData = platformBreakdown.perplexity;
  const chatgptData = platformBreakdown.chatgpt_search;

  const platforms: PlatformData[] = [
    {
      name: 'Perplexity',
      key: 'perplexity',
      icon: Sparkles,
      color: '#20B8CD',
      available: 'available' in perplexityData ? perplexityData.available : false,
      citationShare: 'citationShare' in perplexityData ? perplexityData.citationShare ?? 0 : 0,
      promptsCited: 'promptsCited' in perplexityData ? perplexityData.promptsCited ?? 0 : 0,
      totalPrompts: 'totalPrompts' in perplexityData ? perplexityData.totalPrompts ?? 90 : 90,
      avgPosition: 'avgCitationPosition' in perplexityData ? perplexityData.avgCitationPosition ?? 0 : 0,
      brandMentionRate: analyzedMetrics.summary.brandMentionRate ?? 0,
    },
    {
      name: 'ChatGPT Search',
      key: 'chatgpt_search',
      icon: Bot,
      color: '#10A37F',
      available: 'available' in chatgptData ? chatgptData.available : false,
      citationShare: 'citationShare' in chatgptData ? chatgptData.citationShare ?? 0 : 0,
      promptsCited: 'promptsCited' in chatgptData ? chatgptData.promptsCited ?? 0 : 0,
      totalPrompts: 'totalPrompts' in chatgptData ? chatgptData.totalPrompts ?? 90 : 90,
      avgPosition: 'avgCitationPosition' in chatgptData ? chatgptData.avgCitationPosition ?? 0 : 0,
      brandMentionRate: 'brandMentionRate' in chatgptData ? (chatgptData as any).brandMentionRate ?? 0 : 0,
    },
  ];

  const perplexity = platforms[0];
  const chatgpt = platforms[1];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <PlatformCard platform={perplexity} compareWith={chatgpt} />
      <PlatformCard platform={chatgpt} compareWith={perplexity} />
    </div>
  );
}
