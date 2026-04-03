'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { cn } from '@/lib/utils';

interface FilterGroup {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    param: 'sentiment',
    label: 'Sentiment',
    options: [
      { value: 'all', label: 'All' },
      { value: 'positive', label: 'Positive' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'hedged', label: 'Hedged' },
      { value: 'negative', label: 'Negative' },
    ],
  },
  {
    param: 'isotope',
    label: 'Isotope',
    options: [
      { value: 'all', label: 'All' },
      { value: 'informational', label: 'Informational' },
      { value: 'commercial', label: 'Commercial' },
      { value: 'comparative', label: 'Comparative' },
      { value: 'persona', label: 'Persona' },
      { value: 'specific', label: 'Specific' },
      { value: 'conversational', label: 'Conversational' },
    ],
  },
  {
    param: 'intent',
    label: 'Intent',
    options: [
      { value: 'all', label: 'All' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
    ],
  },
];

function EnrichmentFiltersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleFilterChange(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete(param);
    } else {
      params.set(param, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {FILTER_GROUPS.map((group) => {
        const current = searchParams.get(group.param) || 'all';
        return (
          <div key={group.param} className="flex items-center gap-1.5">
            <span className="text-xs text-[#6B7280] mr-1">{group.label}:</span>
            {group.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleFilterChange(group.param, opt.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  current === opt.value
                    ? 'bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/30'
                    : 'bg-[#22252F] text-[#6B7280] border border-[#2A2D37] hover:bg-[#2A2D37] hover:text-[#9CA3AF]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function EnrichmentFilters() {
  return (
    <Suspense fallback={<div className="h-8" />}>
      <EnrichmentFiltersInner />
    </Suspense>
  );
}
