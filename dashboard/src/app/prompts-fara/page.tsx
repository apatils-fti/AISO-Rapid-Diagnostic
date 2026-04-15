import { PageContainer } from '@/components/layout';
import { PromptTable } from '@/components/prompts';

export default function VisualChecksPage() {
  return (
    <PageContainer
      title="Visual Checks (Beta)"
      description="Run Fara-7B visual spot-checks on AI search results"
    >
      <PromptTable />
    </PageContainer>
  );
}
