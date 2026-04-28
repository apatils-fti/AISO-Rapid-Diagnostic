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
    // New 5-isotope taxonomy. Old values (informational/commercial/persona/
    // specific/conversational) no longer match anything in the results
    // table. lib/metrics.ts normalises legacy rows for aggregation but the
    // filter bar surfaces only the active vocabulary.
    param: 'isotope',
    label: 'Isotope',
    options: [
      { value: 'all', label: 'All' },
      { value: 'declarative', label: 'Declarative' },
      { value: 'comparative', label: 'Comparative' },
      { value: 'situated', label: 'Situated' },
      { value: 'constrained', label: 'Constrained' },
      { value: 'adversarial', label: 'Adversarial' },
    ],
  },
  {
    // Intent now reflects buyer-journey stage from `intent_stage` column,
    // not the old `conversion_intent` (high/medium/low) field — that
    // column is null for ScaledAgile and any future client. URL param
    // stays `intent=` for backward compatibility with bookmarks.
    param: 'intent',
    label: 'Intent',
    options: [
      { value: 'all', label: 'All' },
      { value: 'learning', label: 'Learning' },
      { value: 'discovery', label: 'Discovery' },
      { value: 'evaluation', label: 'Evaluation' },
      { value: 'validation', label: 'Validation' },
      { value: 'acquisition', label: 'Acquisition' },
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
