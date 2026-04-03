import { redirect } from 'next/navigation';

interface MetricsPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function MetricsPage({ searchParams }: MetricsPageProps) {
  const params = await searchParams;
  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  ).toString();

  redirect(queryString ? `/dashboard?${queryString}` : '/dashboard');
}
