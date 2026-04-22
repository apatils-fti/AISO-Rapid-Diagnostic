import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { ShareOfVoice, TopicCompetition, CompetitorCard } from '@/components/competitors';
import { getCompetitorOverview, getTopicIsotopeStats, getClients, getLatestRunDate, type QueryFilters } from '@/lib/db';
import { EnrichmentFilters } from '@/components/shared';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface CompetitorsPageProps {
  searchParams: Promise<{ client?: string; platform?: string; sentiment?: string; isotope?: string; intent?: string }>;
}

async function CompetitorsContent({ clientId, filters }: { clientId: string; filters: QueryFilters }) {
  const [competitors, topicStats] = await Promise.all([
    getCompetitorOverview(clientId, filters),
    getTopicIsotopeStats(clientId, filters),
  ]);

  if (competitors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-[#9CA3AF]">No competitor data found.</p>
        <p className="mt-2 text-sm text-[#6B7280]">
          Run the competitor enrichment script first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EnrichmentFilters />
      <ShareOfVoice serverData={competitors} />
      <TopicCompetition serverData={competitors} serverTopicData={topicStats} />
      <div>
        <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-4">
          Competitor Profiles
        </h3>
        <div className="grid grid-cols-2 gap-6">
          {competitors.map(comp => (
            <CompetitorCard key={comp.name} serverData={comp} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function CompetitorsPage({ searchParams }: CompetitorsPageProps) {
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
      title="Competitive Intelligence"
      description="Brand awareness and mention analysis across AI responses"
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      currentClientId={clientId}
      runDate={runDate ?? undefined}
    >
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="h-48 rounded-lg border border-[#2A2D37] bg-[#1A1D27] animate-pulse" />
            <div className="h-64 rounded-lg border border-[#2A2D37] bg-[#1A1D27] animate-pulse" />
            <div className="grid grid-cols-2 gap-6">
              <div className="h-48 rounded-lg border border-[#2A2D37] bg-[#1A1D27] animate-pulse" />
              <div className="h-48 rounded-lg border border-[#2A2D37] bg-[#1A1D27] animate-pulse" />
            </div>
          </div>
        }
      >
        <CompetitorsContent clientId={clientId} filters={filters} />
      </Suspense>
    </PageContainer>
  );
}
