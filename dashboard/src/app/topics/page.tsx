import { PageContainer } from '@/components/layout';
import { IsotopeHeatmap } from '@/components/topics';

export default function TopicsPage() {
  return (
    <PageContainer
      title="Topic Landscape"
      description="Isotope analysis across all tracked topics"
    >
      <IsotopeHeatmap />
    </PageContainer>
  );
}
