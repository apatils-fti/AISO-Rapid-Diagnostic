import { PageContainer } from '@/components/layout';
import { QuadrantChart, LayerComparison, GapBridges, GapInsightCard } from '@/components/gap-analysis';

export default function GapAnalysisPage() {
  return (
    <PageContainer
      title="Gap Analysis"
      description="Parametric knowledge vs. RAG citation analysis"
    >
      <div className="space-y-6">
        {/* Quadrant chart */}
        <QuadrantChart />

        {/* Side-by-side layer comparison */}
        <LayerComparison />

        {/* Gap bridges visualization */}
        <GapBridges />

        {/* Insight and recommendations */}
        <GapInsightCard />
      </div>
    </PageContainer>
  );
}
