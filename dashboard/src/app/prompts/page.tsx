import { PageContainer } from '@/components/layout';
import { PromptTable } from '@/components/prompts';

export default function PromptsPage() {
  return (
    <PageContainer
      title="Prompt Detail"
      description="Complete breakdown of all prompts and responses"
    >
      <PromptTable />
    </PageContainer>
  );
}
