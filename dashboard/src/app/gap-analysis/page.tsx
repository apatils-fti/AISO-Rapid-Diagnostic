import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { QuadrantChart, LayerComparison, GapBridges, GapInsightCard, TopGapPriorities } from '@/components/gap-analysis';
import { getGapAnalysis, getClients, getLatestRunDate, type QueryFilters } from '@/lib/db';
import { EnrichmentFilters } from '@/components/shared';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface GapAnalysisPageProps {
  searchParams: Promise<{ client?: string; platform?: string; sentiment?: string; isotope?: string; intent?: string }>;
}

async function GapContent({ clientId, filters }: { clientId: string; filters: QueryFilters }) {
  const gaps = await getGapAnalysis(clientId, filters);

  if (gaps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-[#9CA3AF]">No gap analysis data found.</p>
        <p className="mt-2 text-sm text-[#6B7280]">
          Run batch collection and competitor enrichment first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EnrichmentFilters />
      <TopGapPriorities serverGapData={gaps} />
      <QuadrantChart serverGapData={gaps} />
      <LayerComparison serverGapData={gaps} />
      <GapBridges />
      <GapInsightCard serverGapData={gaps} />
    </div>
  );
}

export default async function GapAnalysisPage({ searchParams }: GapAnalysisPageProps) {
  const params = await searchParams;
  const clientId = params.client || DEFAULT_CLIENT_ID;
  const filters: QueryFilters = {
    platform: params.platform,
    sentiment: params.sentiment,
    isotope: params.isotope,
    conversionIntent: params.intent,
  };
  const [clients, runDate] = await Promise.all([
    getClients(),
    getLatestRunDate(clientId),
  ]);

  return (
    <PageContainer
      title="Gap Analysis"
      description="Parametric knowledge vs. RAG citation analysis"
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      currentClientId={clientId}
      runDate={runDate ?? undefined}
    >
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="h-48 rounded-lg border border-[#2A2D37] bg-[#1A1D27] animate-pulse" />
            <div className="h-64 rounded-lg border border-[#2A2D37] bg-[#1A1D27] animate-pulse" />
            <div className="h-48 rounded-lg border border-[#2A2D37] bg-[#1A1D27] animate-pulse" />
          </div>
        }
      >
        <GapContent clientId={clientId} filters={filters} />
      </Suspense>
    </PageContainer>
  );
}
