import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { ShareOfVoice, TopicCompetition, CompetitorCard } from '@/components/competitors';
import { getCompetitorOverview, getTopicIsotopeStats, getClients } from '@/lib/db';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface CompetitorsPageProps {
  searchParams: Promise<{ client?: string; platform?: string }>;
}

async function CompetitorsContent({ clientId, platform }: { clientId: string; platform?: string }) {
  const [competitors, topicStats] = await Promise.all([
    getCompetitorOverview(clientId, platform),
    getTopicIsotopeStats(clientId, platform),
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
  const clients = await getClients();

  return (
    <PageContainer
      title="Competitive Intelligence"
      description="Brand awareness and mention analysis across AI responses"
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      currentClientId={clientId}
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
        <CompetitorsContent clientId={clientId} platform={params.platform} />
      </Suspense>
    </PageContainer>
  );
}
