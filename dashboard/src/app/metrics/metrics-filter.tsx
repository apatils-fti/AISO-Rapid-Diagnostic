'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface MetricsFilterProps {
  platforms: string[];
  currentPlatform: string;
}

export function MetricsFilter({ platforms, currentPlatform }: MetricsFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handlePlatformChange(platform: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (platform === 'all') {
      params.delete('platform');
    } else {
      params.set('platform', platform);
    }
    router.push(`/metrics?${params.toString()}`);
  }

  const options = ['all', ...platforms];

  return (
    <div className="flex gap-2">
      {options.map((p) => (
        <button
          key={p}
          onClick={() => handlePlatformChange(p)}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            (currentPlatform === p || (p === 'all' && !currentPlatform))
              ? 'bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30'
              : 'bg-[#22252F] text-[#9CA3AF] border border-[#2A2D37] hover:bg-[#2A2D37] hover:text-[#E5E7EB]'
          )}
        >
          {p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  );
}
