import { PageContainer } from '@/components/layout';
import { TrendsView } from '@/components/trends/TrendsView';
import { DateRangeFilter, LibraryFilter } from '@/components/shared';
import { getAvailableRunDates, getAvailableLibraries, getClients, getLatestRunDate } from '@/lib/db';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface TrendsPageProps {
  searchParams: Promise<{
    client?: string;
    library?: string;
    date_from?: string;
    date_to?: string;
  }>;
}

export default async function TrendsPage({ searchParams }: TrendsPageProps) {
  const params = await searchParams;
  const clientId = params.client || DEFAULT_CLIENT_ID;
  const libraryId = params.library;
  const [availableDates, clients, runDate, libraries] = await Promise.all([
    getAvailableRunDates(clientId, libraryId),
    getClients(),
    getLatestRunDate(clientId, libraryId),
    getAvailableLibraries(clientId),
  ]);
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <PageContainer
      title="Trends"
      description="Track mention rate changes over time across platforms and topics"
      clients={clientOptions}
      currentClientId={clientId}
      runDate={runDate ?? undefined}
    >
      <div className="space-y-4">
        <LibraryFilter libraries={libraries} />
        <DateRangeFilter
          availableDates={availableDates}
          currentFrom={params.date_from}
          currentTo={params.date_to}
        />
        <TrendsView
          clientId={clientId}
          libraryId={libraryId}
          dateFrom={params.date_from}
          dateTo={params.date_to}
        />
      </div>
    </PageContainer>
  );
}
