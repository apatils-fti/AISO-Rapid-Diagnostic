import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { PromptTable } from '@/components/prompts';
import { getPromptResults, getClients } from '@/lib/db';
import { EnrichmentFilters } from '@/components/shared';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface PromptsPageProps {
  searchParams: Promise<{ client?: string; platform?: string; topic?: string; isotope?: string; sentiment?: string; intent?: string }>;
}

async function PromptsContent({ clientId, platform, topic, isotope }: {
  clientId: string; platform?: string; topic?: string; isotope?: string;
}) {
  const promptData = await getPromptResults(clientId, platform, topic, isotope);

  return (
    <div className="space-y-4">
      <EnrichmentFilters />
      <PromptTable serverData={promptData} />
    </div>
  );
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const params = await searchParams;
  const clientId = params.client || DEFAULT_CLIENT_ID;
  const clients = await getClients();

  return (
    <PageContainer
      title="Prompt Detail"
      description="Complete breakdown of all prompts and responses"
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
        <PromptsContent
          clientId={clientId}
          platform={params.platform}
          topic={params.topic}
          isotope={params.isotope}
        />
      </Suspense>
    </PageContainer>
  );
}
