import { PageContainer } from '@/components/layout';
import { ShareOfVoice, TopicCompetition, CompetitorCard } from '@/components/competitors';
import { analyzedMetrics } from '@/lib/fixtures';

export default function CompetitorsPage() {
  const competitors = analyzedMetrics.competitorOverview;

  return (
    <PageContainer
      title="Competitive Intelligence"
      description="Citation share and positioning analysis vs. competitors"
    >
      <div className="space-y-6">
        {/* Overall Share of Voice */}
        <ShareOfVoice />

        {/* Topic-level competition table */}
        <TopicCompetition />

        {/* Competitor profile cards */}
        <div>
          <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-4">
            Competitor Profiles
          </h3>
          <div className="grid grid-cols-2 gap-6">
            {competitors.map(competitor => (
              <CompetitorCard key={competitor.name} competitor={competitor} />
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
