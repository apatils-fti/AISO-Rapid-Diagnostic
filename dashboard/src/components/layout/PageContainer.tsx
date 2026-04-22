import { Header } from './Header';
import type { ClientOption } from './ClientSelector';

interface PageContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  clients?: ClientOption[];
  currentClientId?: string;
  runDate?: string;
}

export function PageContainer({ title, description, children, clients, currentClientId, runDate }: PageContainerProps) {
  return (
    <div className="ml-60 min-h-screen bg-[#0F1117]">
      <Header
        title={title}
        description={description}
        clients={clients}
        currentClientId={currentClientId}
        runDate={runDate}
      />
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}
