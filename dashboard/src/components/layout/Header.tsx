'use client';

import { Suspense } from 'react';
import { Calendar, Plus, ChevronDown } from 'lucide-react';
import { ClientSelector, type ClientOption } from './ClientSelector';
import { formatDateShort } from '@/lib/utils';

interface HeaderProps {
  title: string;
  description?: string;
  clients?: ClientOption[];
  currentClientId?: string;
  runDate?: string;
}

export function Header({ title, description, clients, currentClientId, runDate }: HeaderProps) {
  const displayClients = clients ?? [];
  const selectedClient = displayClients.find((c) => c.id === currentClientId);

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
          {/* Run Date — hidden when the current client has no runs to avoid
              showing a stale or misleading date. */}
          {runDate && (
            <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
              <Calendar className="h-4 w-4" />
              <span>{formatDateShort(runDate)}</span>
            </div>
          )}

          {/* Client Selector */}
          {displayClients.length > 0 && currentClientId ? (
            <Suspense
              fallback={
                <div className="flex items-center gap-2 rounded-lg border border-[#2A2D37] bg-[#1A1D27] px-3 py-2 text-sm font-medium text-[#E5E7EB]">
                  <span>{selectedClient?.name ?? '—'}</span>
                  <ChevronDown className="h-4 w-4 text-[#6B7280]" />
                </div>
              }
            >
              <ClientSelector
                clients={displayClients}
                currentClientId={currentClientId}
              />
            </Suspense>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-[#2A2D37] bg-[#1A1D27] px-3 py-2 text-sm font-medium text-[#6B7280]">
              <span>No client</span>
            </div>
          )}

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
