'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface ClientOption {
  id: string;
  name: string;
}

interface ClientSelectorProps {
  clients: ClientOption[];
  currentClientId: string;
}

export function ClientSelector({ clients, currentClientId }: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentClient = clients.find(c => c.id === currentClientId) ?? clients[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectClient(clientId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('client', clientId);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  if (clients.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#2A2D37] bg-[#1A1D27] px-3 py-2 text-sm font-medium text-[#E5E7EB]">
        <span>{currentClient?.name ?? 'No clients'}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-[#2A2D37] bg-[#1A1D27] px-3 py-2 text-sm font-medium text-[#E5E7EB] hover:bg-[#22252F] transition-colors"
      >
        <span>{currentClient?.name}</span>
        <ChevronDown className={cn('h-4 w-4 text-[#6B7280] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-[#2A2D37] bg-[#1A1D27] shadow-lg overflow-hidden">
          {clients.map(client => (
            <button
              key={client.id}
              onClick={() => selectClient(client.id)}
              className={cn(
                'flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors',
                client.id === currentClientId
                  ? 'bg-[#00D4AA]/10 text-[#00D4AA]'
                  : 'text-[#9CA3AF] hover:bg-[#22252F] hover:text-[#E5E7EB]'
              )}
            >
              <span>{client.name}</span>
              {client.id === currentClientId && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
