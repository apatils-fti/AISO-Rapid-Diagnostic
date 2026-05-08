import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { IsotopeHeatmap } from '@/components/topics';
import { getTopicIsotopeStats, getClients, getAvailableLibraries, getLatestRunDate, type QueryFilters, type DbLibrary } from '@/lib/db';
import { EnrichmentFilters, LibraryFilter, PlatformDataProvider } from '@/components/shared';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface TopicsPageProps {
  searchParams: Promise<{ client?: string; platform?: string; sentiment?: string; isotope?: string; intent?: string; library?: string }>;
}

async function TopicsContent({ clientId, filters, libraries }: { clientId: string; filters: QueryFilters; libraries: DbLibrary[] }) {
  const topicData = await getTopicIsotopeStats(clientId, filters);

  return (
    <div className="space-y-4">
      <LibraryFilter libraries={libraries} />
      <EnrichmentFilters />
      <IsotopeHeatmap serverTopicData={topicData} />
    </div>
  );
}

export default async function TopicsPage({ searchParams }: TopicsPageProps) {
  const params = await searchParams;
  const clientId = params.client || DEFAULT_CLIENT_ID;
  const filters: QueryFilters = {
    platform: params.platform,
    sentiment: params.sentiment,
    isotope: params.isotope,
    conversionIntent: params.intent,
    library_id: params.library,
  };
  const [clients, runDate, libraries] = await Promise.all([
    getClients(),
    getLatestRunDate(clientId, filters.library_id),
    getAvailableLibraries(clientId),
  ]);

  return (
    <PageContainer
      title="Topic Landscape"
      description="Isotope analysis across all tracked topics"
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      currentClientId={clientId}
      runDate={runDate ?? undefined}
    >
      <PlatformDataProvider key={clientId} clientId={clientId}>
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-10 rounded-lg bg-[#1A1D27] animate-pulse" />
              <div className="h-96 rounded-lg border border-[#2A2D37] bg-[#1A1D27] animate-pulse" />
            </div>
          }
        >
          <TopicsContent clientId={clientId} filters={filters} libraries={libraries} />
        </Suspense>
      </PlatformDataProvider>
    </PageContainer>
  );
}
