import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { PlatformComparison } from '@/components/compare/PlatformComparison';
import { TopicComparisonTable } from '@/components/compare/TopicComparisonTable';
import { PlatformDataProvider } from '@/components/shared';
import { getPlatformComparison, getTopicPlatformStats, getClients } from '@/lib/db';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface ComparePageProps {
  searchParams: Promise<{ client?: string }>;
}

async function CompareContent({ clientId }: { clientId: string }) {
  const [platformStats, topicStats] = await Promise.all([
    getPlatformComparison(clientId),
    getTopicPlatformStats(clientId),
  ]);

  if (platformStats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-[#9CA3AF]">No platform data found.</p>
        <p className="mt-2 text-sm text-[#6B7280]">
          Run batch scripts to collect results, then check back.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlatformComparison platformData={platformStats} />
      <TopicComparisonTable topicData={topicStats} platformData={platformStats} />
    </div>
  );
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const clientId = params.client || DEFAULT_CLIENT_ID;
  const clients = await getClients();

  return (
    <PageContainer
      title="Platform Comparison"
      description="Compare your brand's visibility across AI search platforms"
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      currentClientId={clientId}
    >
      <PlatformDataProvider key={clientId} clientId={clientId}>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00D4AA] border-t-transparent" />
              <span className="ml-3 text-[#9CA3AF]">Loading platform data...</span>
            </div>
          }
        >
          <CompareContent clientId={clientId} />
        </Suspense>
      </PlatformDataProvider>
    </PageContainer>
  );
}
