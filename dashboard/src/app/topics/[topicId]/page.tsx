import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { TopicDetail } from '@/components/topics';
import { PlatformDataProvider } from '@/components/shared';
import { getTopicDetail, getClients, getLatestRunDate, type QueryFilters } from '@/lib/db';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface TopicDetailPageProps {
  params: Promise<{
    topicId: string;
  }>;
  searchParams: Promise<{
    client?: string;
    platform?: string;
    sentiment?: string;
    isotope?: string;
    intent?: string;
    date_from?: string;
    date_to?: string;
  }>;
}

export default async function TopicDetailPage({ params, searchParams }: TopicDetailPageProps) {
  const [{ topicId }, searchParamValues] = await Promise.all([params, searchParams]);
  const clientId = searchParamValues.client || DEFAULT_CLIENT_ID;

  // Temporary diagnostic — surfaces in Vercel logs so we can confirm the
  // right topicId + clientId are hitting this route when 404s get reported.
  // Remove once the drill-down is stable across multiple clients.
  console.log('[topics/[topicId]] rendering', { topicId, clientId });

  const filters: QueryFilters = {
    platform: searchParamValues.platform,
    sentiment: searchParamValues.sentiment,
    isotope: searchParamValues.isotope,
    conversionIntent: searchParamValues.intent,
    date_from: searchParamValues.date_from,
    date_to: searchParamValues.date_to,
  };

  const [detail, clients, runDate] = await Promise.all([
    getTopicDetail(clientId, topicId, filters),
    getClients(),
    getLatestRunDate(clientId),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <PageContainer
      title={detail.topicName}
      description={`Detailed breakdown for ${detail.topicName}`}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      currentClientId={clientId}
      runDate={runDate ?? undefined}
    >
      <PlatformDataProvider key={clientId} clientId={clientId}>
        <TopicDetail serverData={detail} />
      </PlatformDataProvider>
    </PageContainer>
  );
}
