'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Grid3X3,
  Users,
  Layers,
  List,
  Download,
  Settings,
  Activity,
  GitCompare,
  Camera,
  TrendingUp,
} from 'lucide-react';
import { FARA_CONFIG } from '@/lib/fara-config';
import { cn, formatDateShort } from '@/lib/utils';
import { supabaseAnon } from '@/lib/supabase';

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Topics', href: '/topics', icon: Grid3X3 },
  { label: 'Competitors', href: '/competitors', icon: Users },
  { label: 'Gap Analysis', href: '/gap-analysis', icon: Layers },
  { label: 'Compare Platforms', href: '/compare', icon: GitCompare },
  { label: 'Prompt Detail', href: '/prompts', icon: List },
  { label: 'Trends', href: '/trends', icon: TrendingUp },
];

// Reads the selected client from ?client= and fetches its name + latest run
// date from Supabase. Rendered inside a <Suspense> — useSearchParams requires
// it. Returns empty placeholders if Supabase isn't configured or the client
// can't be found, rather than falling back to fixture (J.Crew) values.
function SidebarClientInfo() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('client');
  const [state, setState] = useState<{ name: string | null; runDate: string | null; loading: boolean }>({
    name: null,
    runDate: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabaseAnon || !clientId) {
        if (!cancelled) setState({ name: null, runDate: null, loading: false });
        return;
      }

      try {
        const [{ data: client }, { data: runs }] = await Promise.all([
          supabaseAnon.from('clients').select('name').eq('id', clientId).maybeSingle(),
          supabaseAnon
            .from('runs')
            .select('run_date')
            .eq('client_id', clientId)
            .not('run_date', 'is', null)
            .order('run_date', { ascending: false })
            .limit(1),
        ]);

        if (cancelled) return;
        setState({
          name: (client?.name as string | undefined) ?? null,
          runDate: (runs?.[0]?.run_date as string | undefined) ?? null,
          loading: false,
        });
      } catch {
        if (!cancelled) setState({ name: null, runDate: null, loading: false });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <>
      <div className="text-sm font-medium text-[#E5E7EB]">
        {state.loading ? '—' : state.name ?? '—'}
      </div>
      <div className="text-xs text-[#6B7280]">
        Run: {state.runDate ? formatDateShort(state.runDate) : '—'}
      </div>
    </>
  );
}

// Renders the nav links with the active client param appended to every href,
// so switching tabs preserves ?client=. Pulls usePathname + useSearchParams,
// both of which require a Suspense boundary in the App Router. Mounted under
// the same Suspense as SidebarClientInfo above to share the boundary.
function SidebarNavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clientParam = searchParams.get('client');
  const querySuffix = clientParam ? `?client=${clientParam}` : '';

  return (
    <>
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={`${item.href}${querySuffix}`}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[#00D4AA]/10 text-[#00D4AA]'
                : 'text-[#9CA3AF] hover:bg-[#1A1D27] hover:text-[#E5E7EB]'
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}

      {/* Fara Visual Checks - Feature Flagged */}
      {FARA_CONFIG.ENABLED && (
        <Link
          href={`/prompts-fara${querySuffix}`}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            pathname === '/prompts-fara'
              ? 'bg-[#00D4AA]/10 text-[#00D4AA]'
              : 'text-[#9CA3AF] hover:bg-[#1A1D27] hover:text-[#E5E7EB]'
          )}
        >
          <Camera className="h-5 w-5" />
          <span className="flex items-center gap-2">
            Visual Checks
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B]">
              Beta
            </span>
          </span>
        </Link>
      )}
    </>
  );
}

// Static fallback rendered during the brief Suspense window before
// useSearchParams resolves. Hrefs are bare (no client param). Fine because
// the user almost never sees this — the fallback just covers SSR + hydration.
function SidebarNavFallback() {
  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#9CA3AF] hover:bg-[#1A1D27] hover:text-[#E5E7EB] transition-colors"
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-[#2A2D37] bg-[#0F1117]">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-[#2A2D37] px-4">
          <Activity className="h-6 w-6 text-[#00D4AA]" />
          <span className="font-heading text-lg font-semibold text-[#E5E7EB]">
            AI Search Diagnostic
          </span>
        </div>

        {/* Client Info */}
        <div className="border-b border-[#2A2D37] px-4 py-4">
          <Suspense
            fallback={
              <>
                <div className="text-sm font-medium text-[#E5E7EB]">—</div>
                <div className="text-xs text-[#6B7280]">Run: —</div>
              </>
            }
          >
            <SidebarClientInfo />
          </Suspense>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          <Suspense fallback={<SidebarNavFallback />}>
            <SidebarNavLinks />
          </Suspense>
        </nav>

        {/* Bottom Actions */}
        <div className="border-t border-[#2A2D37] p-3 space-y-1">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#9CA3AF] hover:bg-[#1A1D27] hover:text-[#E5E7EB] transition-colors">
            <Download className="h-5 w-5" />
            Export Report
          </button>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#9CA3AF] hover:bg-[#1A1D27] hover:text-[#E5E7EB] transition-colors">
            <Settings className="h-5 w-5" />
            Settings
          </button>
        </div>
      </div>
    </aside>
  );
}
