import { PageContainer } from '@/components/layout';
import { PromptTable } from '@/components/prompts';
import { PlatformDataProvider } from '@/components/shared';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

export default function VisualChecksPage() {
  return (
    <PageContainer
      title="Visual Checks (Beta)"
      description="Run Fara-7B visual spot-checks on AI search results"
    >
      <PlatformDataProvider clientId={DEFAULT_CLIENT_ID}>
        <PromptTable />
      </PlatformDataProvider>
    </PageContainer>
  );
}
