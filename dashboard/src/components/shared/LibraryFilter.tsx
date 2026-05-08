'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Library } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LibraryOption {
  id: string;
  name: string;
}

interface LibraryFilterProps {
  libraries: LibraryOption[];
}

function LibraryFilterInner({ libraries }: LibraryFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // No filter when the client has 0 or 1 library — there's nothing to switch
  // between. Page queries default to "all libraries" anyway.
  if (libraries.length < 2) return null;

  const current = searchParams.get('library') ?? 'all';

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('library');
    } else {
      params.set('library', value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const options: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All Libraries' },
    ...libraries.map((l) => ({ value: l.id, label: l.name })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 flex items-center gap-1.5 text-xs text-[#6B7280]">
        <Library className="h-3.5 w-3.5" />
        Library:
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleChange(opt.value)}
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
}

export function LibraryFilter({ libraries }: LibraryFilterProps) {
  return (
    <Suspense fallback={<div className="h-7" />}>
      <LibraryFilterInner libraries={libraries} />
    </Suspense>
  );
}
