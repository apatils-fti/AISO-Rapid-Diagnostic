import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import { PromptTable } from '@/components/prompts';
import { getPromptResults, getClients, getAvailableLibraries, getLatestRunDate, type DbLibrary } from '@/lib/db';
import { EnrichmentFilters, DateRangeFilter, LibraryFilter, PlatformDataProvider } from '@/components/shared';
import { getAvailableRunDates } from '@/lib/db';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface PromptsPageProps {
  searchParams: Promise<{
    client?: string;
    platform?: string;
    topic?: string;
    isotope?: string;
    sentiment?: string;
    intent?: string;
    library?: string;
    date_from?: string;
    date_to?: string;
  }>;
}

async function PromptsContent({
  clientId,
  platform,
  topic,
  isotope,
  sentiment,
  intent,
  libraryId,
  dateFrom,
  dateTo,
  clientName,
  clientDomains,
  libraries,
}: {
  clientId: string;
  platform?: string;
  topic?: string;
  isotope?: string;
  sentiment?: string;
  intent?: string;
  libraryId?: string;
  dateFrom?: string;
  dateTo?: string;
  clientName?: string;
  clientDomains?: string[];
  libraries: DbLibrary[];
}) {
  const promptData = await getPromptResults(
    clientId,
    platform,
    topic,
    isotope,
    sentiment,
    intent,
    dateFrom,
    dateTo,
    libraryId,
  );

  return (
    <div className="space-y-4">
      <LibraryFilter libraries={libraries} />
      <EnrichmentFilters />
      <PromptTable
        serverData={promptData}
        clientName={clientName}
        clientDomains={clientDomains}
      />
    </div>
  );
}

/**
 * Extract a client's owned-domain list from the JSONB `clients.config` column.
 * Accepts the two shapes used by the generator (`{client: {domains}}`) and
 * the seed scripts (`{clientDomains: string[]}`).
 */
function extractClientDomains(config: unknown): string[] {
  const cfg = (config ?? {}) as { clientDomains?: string[]; client?: { domains?: string[] } };
  return cfg.clientDomains ?? cfg.client?.domains ?? [];
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const params = await searchParams;
  const clientId = params.client || DEFAULT_CLIENT_ID;
  const [clients, runDate, availableDates, libraries] = await Promise.all([
    getClients(),
    getLatestRunDate(clientId, params.library),
    getAvailableRunDates(clientId, params.library),
    getAvailableLibraries(clientId),
  ]);

  return (
    <PageContainer
      title="Prompt Detail"
      description="Complete breakdown of all prompts and responses"
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      currentClientId={clientId}
      runDate={runDate ?? undefined}
    >
      <PlatformDataProvider key={clientId} clientId={clientId}>
        <DateRangeFilter
          availableDates={availableDates}
          currentFrom={params.date_from}
          currentTo={params.date_to}
        />
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
            sentiment={params.sentiment}
            intent={params.intent}
            libraryId={params.library}
            dateFrom={params.date_from}
            dateTo={params.date_to}
            clientName={clients.find((c) => c.id === clientId)?.name}
            clientDomains={extractClientDomains(clients.find((c) => c.id === clientId)?.config)}
            libraries={libraries}
          />
        </Suspense>
      </PlatformDataProvider>
    </PageContainer>
  );
}
