import { Header } from './Header';
import type { ClientOption } from './ClientSelector';

interface PageContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  clients?: ClientOption[];
  currentClientId?: string;
}

export function PageContainer({ title, description, children, clients, currentClientId }: PageContainerProps) {
  return (
    <div className="ml-60 min-h-screen bg-[#0F1117]">
      <Header
        title={title}
        description={description}
        clients={clients}
        currentClientId={currentClientId}
      />
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}
