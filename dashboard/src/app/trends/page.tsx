import { PageContainer } from '@/components/layout';
import { TrendsView } from '@/components/trends/TrendsView';
import { DateRangeFilter } from '@/components/shared';
import { getAvailableRunDates, getClients } from '@/lib/db';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface TrendsPageProps {
  searchParams: Promise<{
    client?: string;
    date_from?: string;
    date_to?: string;
  }>;
}

export default async function TrendsPage({ searchParams }: TrendsPageProps) {
  const params = await searchParams;
  const clientId = params.client || DEFAULT_CLIENT_ID;
  const [availableDates, clients] = await Promise.all([
    getAvailableRunDates(clientId),
    getClients(),
  ]);
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <PageContainer
      title="Trends"
      description="Track mention rate changes over time across platforms and topics"
      clients={clientOptions}
      currentClientId={clientId}
    >
      <div className="space-y-4">
        <DateRangeFilter
          availableDates={availableDates}
          currentFrom={params.date_from}
          currentTo={params.date_to}
        />
        <TrendsView
          clientId={clientId}
          dateFrom={params.date_from}
          dateTo={params.date_to}
        />
      </div>
    </PageContainer>
  );
}
