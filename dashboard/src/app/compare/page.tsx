import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { PlatformComparison } from '@/components/compare/PlatformComparison';
import { TopicComparisonTable } from '@/components/compare/TopicComparisonTable';
import { getPlatformComparison, getTopicPlatformStats } from '@/lib/db';

const CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

async function CompareContent() {
  const [platformStats, topicStats] = await Promise.all([
    getPlatformComparison(CLIENT_ID),
    getTopicPlatformStats(CLIENT_ID),
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

export default function ComparePage() {
  return (
    <PageContainer
      title="Platform Comparison"
      description="Compare your brand's visibility across AI search platforms"
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00D4AA] border-t-transparent" />
            <span className="ml-3 text-[#9CA3AF]">Loading platform data...</span>
          </div>
        }
      >
        <CompareContent />
      </Suspense>
    </PageContainer>
  );
}
