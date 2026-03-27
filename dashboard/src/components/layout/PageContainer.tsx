import { Header } from './Header';

interface PageContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function PageContainer({ title, description, children }: PageContainerProps) {
  return (
    <div className="ml-60 min-h-screen bg-[#0F1117]">
      <Header title={title} description={description} />
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}
