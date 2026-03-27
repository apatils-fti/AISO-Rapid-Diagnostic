'use client';

import { Lock, Sparkles, Search, Bot } from 'lucide-react';
import { analyzedMetrics, clientConfig } from '@/lib/fixtures';
import { cn } from '@/lib/utils';

interface PlatformCardProps {
  name: string;
  icon: typeof Sparkles;
  color: string;
  available: boolean;
  comingSoon?: boolean;
  citationShare?: number;
  promptsCited?: number;
  totalPrompts?: number;
  avgPosition?: number;
}

function PlatformCard({
  name,
  icon: Icon,
  color,
  available,
  comingSoon,
  citationShare,
  promptsCited,
  totalPrompts,
  avgPosition,
}: PlatformCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        available
          ? 'border-[#2A2D37] bg-[#1A1D27] hover:border-[#363944]'
          : 'border-[#2A2D37]/50 bg-[#1A1D27]/50'
      )}
    >
      {comingSoon && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#22252F] px-2 py-0.5 text-xs text-[#6B7280]">
            <Lock className="h-3 w-3" />
            Coming Soon
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'flex items-center justify-center rounded-lg p-2',
            available ? 'bg-[#22252F]' : 'bg-[#22252F]/50'
          )}
        >
          <Icon
            className="h-6 w-6"
            style={{ color: available ? color : '#6B7280' }}
          />
        </div>
        <span
          className={cn(
            'font-medium',
            available ? 'text-[#E5E7EB]' : 'text-[#6B7280]'
          )}
        >
          {name}
        </span>
      </div>

      {available ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Citation Share</span>
            <span className="text-sm font-medium text-[#00D4AA]">
              {((citationShare || 0) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Prompts Cited</span>
            <span className="text-sm font-medium text-[#E5E7EB]">
              {promptsCited}/{totalPrompts}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#6B7280]">Avg. Position</span>
            <span className="text-sm font-medium text-[#E5E7EB]">
              #{avgPosition?.toFixed(1)}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-[#6B7280]">
          Data collection for this platform is in development.
        </div>
      )}
    </div>
  );
}

export function PlatformOverview() {
  const { platformBreakdown } = analyzedMetrics.summary;

  const platforms = [
    {
      key: 'perplexity',
      name: 'Perplexity',
      icon: Sparkles,
      color: '#20B8CD',
    },
    {
      key: 'google_ai_overview',
      name: 'Google AI Overview',
      icon: Search,
      color: '#4285F4',
    },
    {
      key: 'chatgpt_search',
      name: 'ChatGPT Search',
      icon: Bot,
      color: '#10A37F',
    },
    {
      key: 'claude_search',
      name: 'Claude Search',
      icon: Bot,
      color: '#D97706',
    },
  ];

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-4">
        Platform Coverage
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {platforms.map((platform) => {
          const data = platformBreakdown[platform.key as keyof typeof platformBreakdown];
          const isAvailable = 'available' in data ? data.available : false;

          return (
            <PlatformCard
              key={platform.key}
              name={platform.name}
              icon={platform.icon}
              color={platform.color}
              available={isAvailable}
              comingSoon={'comingSoon' in data ? data.comingSoon : false}
              citationShare={'citationShare' in data ? data.citationShare : undefined}
              promptsCited={'promptsCited' in data ? data.promptsCited : undefined}
              totalPrompts={'totalPrompts' in data ? data.totalPrompts : undefined}
              avgPosition={'avgCitationPosition' in data ? data.avgCitationPosition : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
