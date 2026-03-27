import { PageContainer } from '@/components/layout';
import {
  VisibilityScore,
  ScoreBreakdown,
  CompetitorQuickCompare,
  PlatformOverview,
  TopGapsCard,
} from '@/components/dashboard';

export default function DashboardPage() {
  return (
    <PageContainer
      title="Executive Summary"
      description="AI Search Presence Overview"
    >
      <div className="space-y-6">
        {/* Top Section - Visibility Score + Breakdown */}
        <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-8">
          <VisibilityScore />
          <div className="mt-8 pt-6 border-t border-[#2A2D37]">
            <ScoreBreakdown />
          </div>
        </div>

        {/* Middle Section - Two columns */}
        <div className="grid grid-cols-2 gap-6">
          <CompetitorQuickCompare />
          <PlatformOverview />
        </div>

        {/* Bottom Section - Top Opportunities */}
        <TopGapsCard />
      </div>
    </PageContainer>
  );
}
