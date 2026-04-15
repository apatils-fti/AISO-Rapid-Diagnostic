'use client';

import { PageContainer } from '@/components/layout';
import { TrendsView } from '@/components/trends/TrendsView';

export default function TrendsPage() {
  return (
    <PageContainer
      title="Trends"
      description="Track mention rate changes over time across platforms and topics"
    >
      <TrendsView />
    </PageContainer>
  );
}
