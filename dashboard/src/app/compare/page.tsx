'use client';

import { PageContainer } from '@/components/layout';
import { PlatformComparison } from '@/components/compare/PlatformComparison';
import { TopicComparisonTable } from '@/components/compare/TopicComparisonTable';

export default function ComparePage() {
  return (
    <PageContainer
      title="Platform Comparison"
      description="Compare your brand's visibility across AI search platforms"
    >
      <div className="space-y-6">
        <PlatformComparison />
        <TopicComparisonTable />
      </div>
    </PageContainer>
  );
}
