import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { TopicDetail } from '@/components/topics';
import { PlatformDataProvider } from '@/components/shared';
import { getTopicById } from '@/lib/fixtures';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface TopicDetailPageProps {
  params: Promise<{
    topicId: string;
  }>;
}

export default async function TopicDetailPage({ params }: TopicDetailPageProps) {
  const { topicId } = await params;
  const topic = getTopicById(topicId);

  if (!topic) {
    notFound();
  }

  return (
    <PageContainer
      title={topic.topicName}
      description={`Detailed isotope analysis for ${topic.topicName}`}
    >
      <PlatformDataProvider clientId={DEFAULT_CLIENT_ID}>
        <TopicDetail topic={topic} />
      </PlatformDataProvider>
    </PageContainer>
  );
}
