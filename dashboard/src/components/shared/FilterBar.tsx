'use client';

import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FilterDropdown({
  label,
  options,
  value,
  onChange,
  className,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-[#2A2D37] bg-[#1A1D27] px-3 py-2 text-sm text-[#E5E7EB] hover:bg-[#22252F] transition-colors"
      >
        <span className="text-[#6B7280]">{label}:</span>
        <span>{selectedOption?.label || 'All'}</span>
        <ChevronDown className={cn('h-4 w-4 text-[#6B7280] transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 min-w-full rounded-lg border border-[#2A2D37] bg-[#1A1D27] py-1 shadow-lg">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-[#22252F] transition-colors',
                  option.value === value ? 'text-[#00D4AA]' : 'text-[#E5E7EB]'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#2A2D37] bg-[#1A1D27] py-2 pl-10 pr-10 text-sm text-[#E5E7EB] placeholder-[#6B7280] focus:border-[#00D4AA] focus:outline-none focus:ring-1 focus:ring-[#00D4AA]"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#E5E7EB]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {children}
    </div>
  );
}
