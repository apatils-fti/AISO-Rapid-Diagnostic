import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { QuadrantChart, LayerComparison, GapBridges, GapInsightCard, TopGapPriorities } from '@/components/gap-analysis';
import { getGapAnalysis, getClients } from '@/lib/db';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface GapAnalysisPageProps {
  searchParams: Promise<{ client?: string; platform?: string }>;
}

async function GapContent({ clientId, platform }: { clientId: string; platform?: string }) {
  const gaps = await getGapAnalysis(clientId, platform);

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
  const clients = await getClients();

  return (
    <PageContainer
      title="Gap Analysis"
      description="Parametric knowledge vs. RAG citation analysis"
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      currentClientId={clientId}
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
        <GapContent clientId={clientId} platform={params.platform} />
      </Suspense>
    </PageContainer>
  );
}
