import { cn } from '@/lib/utils';
import { Sparkles, Search, Bot, Lock } from 'lucide-react';
import { PLATFORM_COLORS } from '@/lib/colors';

type Platform = 'perplexity' | 'google_ai_overview' | 'chatgpt_search' | 'claude_search';

interface PlatformIconProps {
  platform: Platform;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  disabled?: boolean;
  className?: string;
}

const platformConfig: Record<Platform, {
  label: string;
  icon: typeof Sparkles;
  color: string;
}> = {
  perplexity: {
    label: 'Perplexity',
    icon: Sparkles,
    color: PLATFORM_COLORS.perplexity,
  },
  google_ai_overview: {
    label: 'Google AI',
    icon: Search,
    color: PLATFORM_COLORS.google_ai_overview,
  },
  chatgpt_search: {
    label: 'ChatGPT',
    icon: Bot,
    color: PLATFORM_COLORS.chatgpt_search,
  },
  claude_search: {
    label: 'Claude',
    icon: Bot,
    color: PLATFORM_COLORS.claude,
  },
};

export function PlatformIcon({
  platform,
  size = 'md',
  showLabel = false,
  disabled = false,
  className,
}: PlatformIconProps) {
  const config = platformConfig[platform];
  const Icon = disabled ? Lock : config.icon;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-md p-1.5',
          disabled ? 'bg-[#22252F]' : 'bg-[#22252F]'
        )}
      >
        <Icon
          className={cn(sizeClasses[size])}
          style={{ color: disabled ? '#6B7280' : config.color }}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            'text-sm font-medium',
            disabled ? 'text-[#6B7280]' : 'text-[#E5E7EB]'
          )}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}

export function getPlatformLabel(platform: Platform): string {
  return platformConfig[platform].label;
}

export function getPlatformColor(platform: Platform): string {
  return platformConfig[platform].color;
}
