'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRangeFilterProps {
  /** Distinct run_date values for the current client, sorted newest first. */
  availableDates: string[];
  /** Current date_from search param (YYYY-MM-DD) */
  currentFrom?: string;
  /** Current date_to search param (YYYY-MM-DD) */
  currentTo?: string;
}

type Mode = 'today' | 'last-7' | 'custom';

function todayUtc(): string {
  return new Date().toISOString().split('T')[0]!;
}

function last7Range(): { from: string; to: string } {
  const today = new Date();
  const end = today.toISOString().split('T')[0]!;
  const startMs = today.getTime() - 6 * 24 * 60 * 60 * 1000;
  const start = new Date(startMs).toISOString().split('T')[0]!;
  return { from: start, to: end };
}

function formatDateLabel(iso: string): string {
  // Parse as UTC to avoid timezone shifts on display.
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Pill-style date range filter for the Overview and Trends pages.
 *
 * Three modes:
 *  - Today: one-day range anchored on today
 *  - Last 7 days: rolling 7-day window ending today
 *  - Custom: single-day pick from a dropdown of dates that have data
 *
 * State lives in URL search params (?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD)
 * so the server components can read the selection and pass to queries.
 * Dropdown is populated from availableDates — only dates with actual data
 * are selectable, which is the simplest good UX and avoids empty-range bugs.
 */
export function DateRangeFilter({ availableDates, currentFrom, currentTo }: DateRangeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [dropdownOpen]);

  // Determine which mode is currently active.
  const mode: Mode = (() => {
    if (currentFrom && currentTo && currentFrom === currentTo) return 'custom';
    if (currentFrom && currentTo) return 'last-7';
    return 'last-7'; // default
  })();

  function updateParams(from: string | null, to: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set('date_from', from);
    else params.delete('date_from');
    if (to) params.set('date_to', to);
    else params.delete('date_to');
    router.push(`${pathname}?${params.toString()}`);
  }

  function selectToday() {
    const t = todayUtc();
    updateParams(t, t);
    setDropdownOpen(false);
  }

  function selectLast7() {
    const { from, to } = last7Range();
    updateParams(from, to);
    setDropdownOpen(false);
  }

  function selectCustom(date: string) {
    updateParams(date, date);
    setDropdownOpen(false);
  }

  const customLabel =
    mode === 'custom' && currentFrom
      ? formatDateLabel(currentFrom)
      : 'Custom';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-[#6B7280] mr-1">
        Date Range
      </span>
      <button
        type="button"
        onClick={selectToday}
        className={cn(
          'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
          mode === 'custom' && currentFrom === todayUtc()
            ? 'bg-[#00D4AA] text-[#0B0D12] border-[#00D4AA]'
            : 'bg-[#1A1D27] text-[#9CA3AF] border-[#2A2D37] hover:border-[#00D4AA]/40',
        )}
      >
        Today
      </button>
      <button
        type="button"
        onClick={selectLast7}
        className={cn(
          'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
          mode === 'last-7'
            ? 'bg-[#00D4AA] text-[#0B0D12] border-[#00D4AA]'
            : 'bg-[#1A1D27] text-[#9CA3AF] border-[#2A2D37] hover:border-[#00D4AA]/40',
        )}
      >
        Last 7 days
      </button>
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          disabled={availableDates.length === 0}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border inline-flex items-center gap-1',
            mode === 'custom' && currentFrom !== todayUtc()
              ? 'bg-[#00D4AA] text-[#0B0D12] border-[#00D4AA]'
              : 'bg-[#1A1D27] text-[#9CA3AF] border-[#2A2D37] hover:border-[#00D4AA]/40',
            availableDates.length === 0 && 'opacity-50 cursor-not-allowed',
          )}
        >
          <Calendar className="h-3 w-3" />
          {customLabel}
          <ChevronDown className="h-3 w-3" />
        </button>
        {dropdownOpen && availableDates.length > 0 && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] max-h-[280px] overflow-y-auto rounded-lg border border-[#2A2D37] bg-[#0B0D12] shadow-lg">
            {availableDates.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => selectCustom(date)}
                className={cn(
                  'block w-full text-left px-3 py-2 text-xs transition-colors',
                  currentFrom === date && currentTo === date
                    ? 'bg-[#00D4AA]/20 text-[#00D4AA]'
                    : 'text-[#9CA3AF] hover:bg-[#1A1D27] hover:text-[#E5E7EB]',
                )}
              >
                {formatDateLabel(date)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
