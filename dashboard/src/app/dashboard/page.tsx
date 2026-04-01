import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import {
  VisibilityScore,
  ScoreBreakdown,
  CompetitorQuickCompare,
  PlatformOverview,
  TopGapsCard,
  ExecutiveSummary,
} from '@/components/dashboard';
import { getOverviewStats, getPlatformComparison, getClients } from '@/lib/db';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface DashboardPageProps {
  searchParams: Promise<{ client?: string }>;
}

async function DashboardContent({ clientId }: { clientId: string }) {
  const [overview, platformStats] = await Promise.all([
    getOverviewStats(clientId),
    getPlatformComparison(clientId),
  ]);

  return (
    <div className="space-y-6">
      {/* Executive Summary — server data when available */}
      <ExecutiveSummary overviewData={overview} clientName="J.Crew" />

      {/* Top Section - Visibility Score + Breakdown */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-8">
        <VisibilityScore />
        <div className="mt-8 pt-6 border-t border-[#2A2D37]">
          <ScoreBreakdown />
        </div>
      </div>

      {/* Middle Section - Two columns */}
      <div className="grid grid-cols-2 gap-6">
        <CompetitorQuickCompare />
        <PlatformOverview platformData={platformStats} />
      </div>

      {/* Bottom Section - Top Opportunities */}
      <TopGapsCard />
    </div>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const clientId = params.client || DEFAULT_CLIENT_ID;

  const clients = await getClients();
  const clientOptions = clients.map(c => ({ id: c.id, name: c.name }));

  return (
    <PageContainer
      title="Executive Summary"
      description="AI Search Presence Overview"
      clients={clientOptions}
      currentClientId={clientId}
    >
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6 h-32 animate-pulse" />
            <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-8 h-64 animate-pulse" />
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6 h-48 animate-pulse" />
              <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6 h-48 animate-pulse" />
            </div>
          </div>
        }
      >
        <DashboardContent clientId={clientId} />
      </Suspense>
    </PageContainer>
  );
}
