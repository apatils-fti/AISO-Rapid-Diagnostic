import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { IsotopeHeatmap } from '@/components/topics';
import { getTopicIsotopeStats, getClients } from '@/lib/db';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface TopicsPageProps {
  searchParams: Promise<{ client?: string; platform?: string }>;
}

async function TopicsContent({ clientId, platform }: { clientId: string; platform?: string }) {
  const topicData = await getTopicIsotopeStats(clientId, platform);

  return <IsotopeHeatmap serverTopicData={topicData} />;
}

export default async function TopicsPage({ searchParams }: TopicsPageProps) {
  const params = await searchParams;
  const clientId = params.client || DEFAULT_CLIENT_ID;
  const clients = await getClients();

  return (
    <PageContainer
      title="Topic Landscape"
      description="Isotope analysis across all tracked topics"
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      currentClientId={clientId}
    >
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-10 rounded-lg bg-[#1A1D27] animate-pulse" />
            <div className="h-96 rounded-lg border border-[#2A2D37] bg-[#1A1D27] animate-pulse" />
          </div>
        }
      >
        <TopicsContent clientId={clientId} platform={params.platform} />
      </Suspense>
    </PageContainer>
  );
}
