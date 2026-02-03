import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { TopicDetail } from '@/components/topics';
import { getTopicById } from '@/lib/fixtures';

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
      <TopicDetail topic={topic} />
    </PageContainer>
  );
}
