'use client';

import { Sparkles, Bot, Gem, Search } from 'lucide-react';
import { getPlatformKeys, getPlatformMeta } from '@/lib/platform-data';
import { cn } from '@/lib/utils';

const PLATFORM_ICONS: Record<string, typeof Sparkles> = {
  perplexity: Sparkles,
  chatgpt_search: Bot,
  gemini: Gem,
  claude: Bot,
  google_ai_overview: Search,
};

interface PlatformFilterProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

const ALL_PLATFORMS = getPlatformKeys();

export function PlatformFilter({ selected, onChange }: PlatformFilterProps) {
  const allSelected = selected.length === ALL_PLATFORMS.length;

  function toggle(platform: string) {
    if (selected.includes(platform)) {
      // Require minimum 1 selected
      if (selected.length <= 1) return;
      onChange(selected.filter((p) => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#6B7280] mr-1">Platforms:</span>

      {ALL_PLATFORMS.map((platform) => {
        const meta = getPlatformMeta(platform);
        const Icon = PLATFORM_ICONS[platform] ?? Bot;
        const isActive = selected.includes(platform);

        return (
          <button
            key={platform}
            onClick={() => toggle(platform)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
              isActive
                ? 'border-current bg-current/10'
                : 'border-[#2A2D37] bg-transparent text-[#4A4D57] hover:text-[#6B7280]'
            )}
            style={isActive ? { color: meta.color, borderColor: meta.color, backgroundColor: `${meta.color}15` } : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.displayName}
          </button>
        );
      })}

      {!allSelected && (
        <button
          onClick={() => onChange([...ALL_PLATFORMS])}
          className="text-xs text-[#6B7280] hover:text-[#00D4AA] ml-1 transition-colors"
        >
          All
        </button>
      )}
    </div>
  );
}

/** Default selected platforms — all 4 */
export const DEFAULT_PLATFORMS = [...ALL_PLATFORMS];
