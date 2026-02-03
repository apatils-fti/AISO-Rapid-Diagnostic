'use client';

import { ChevronDown, Plus, Calendar } from 'lucide-react';
import { clientConfig } from '@/lib/fixtures';
import { formatDateShort } from '@/lib/utils';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#2A2D37] bg-[#0F1117]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0F1117]/80">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left - Title */}
        <div>
          <h1 className="font-heading text-xl font-semibold text-[#E5E7EB]">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-[#6B7280]">{description}</p>
          )}
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-4">
          {/* Run Date */}
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <Calendar className="h-4 w-4" />
            <span>{formatDateShort(clientConfig.runDate)}</span>
          </div>

          {/* Client Selector */}
          <button className="flex items-center gap-2 rounded-lg border border-[#2A2D37] bg-[#1A1D27] px-3 py-2 text-sm font-medium text-[#E5E7EB] hover:bg-[#22252F] transition-colors">
            <span>{clientConfig.clientName}</span>
            <ChevronDown className="h-4 w-4 text-[#6B7280]" />
          </button>

          {/* New Run Button */}
          <button className="flex items-center gap-2 rounded-lg bg-[#00D4AA] px-4 py-2 text-sm font-medium text-[#0F1117] hover:bg-[#00D4AA]/90 transition-colors">
            <Plus className="h-4 w-4" />
            New Run
          </button>
        </div>
      </div>
    </header>
  );
}
