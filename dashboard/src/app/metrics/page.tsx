import { Suspense } from 'react';
import { Eye, Shield, ShoppingCart, ThumbsUp } from 'lucide-react';
import { PageContainer } from '@/components/layout';
import { PillarCard, SentimentBar } from '@/components/metrics';
import { supabaseService } from '@/lib/supabase';
import {
  getVisibilityScore,
  getTrustScore,
  getAcquisitionScore,
  getRecommendationScore,
} from '@/lib/metrics';
import type { EnrichedResult } from '@/lib/metrics';
import { formatPercent } from '@/lib/utils';
import { MetricsFilter } from './metrics-filter';

const CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

async function getEnrichedResults(platform: string): Promise<EnrichedResult[]> {
  if (!supabaseService) return [];

  // Get run_ids for this client
  const { data: runs, error: runsError } = await supabaseService
    .from('runs')
    .select('id')
    .eq('client_id', CLIENT_ID);

  if (runsError || !runs || runs.length === 0) return [];

  const runIds = runs.map((r: { id: string }) => r.id);

  // Fetch enriched results
  let query = supabaseService
    .from('results')
    .select('*')
    .in('run_id', runIds)
    .not('sentiment', 'is', null);

  if (platform && platform !== 'all') {
    query = query.eq('platform', platform);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as EnrichedResult[];
}

async function getAvailablePlatforms(): Promise<string[]> {
  if (!supabaseService) return [];

  const { data: runs } = await supabaseService
    .from('runs')
    .select('id')
    .eq('client_id', CLIENT_ID);

  if (!runs || runs.length === 0) return [];

  const { data, error } = await supabaseService
    .from('results')
    .select('platform')
    .in('run_id', runs.map((r: { id: string }) => r.id))
    .not('sentiment', 'is', null);

  if (error || !data) return [];
  return [...new Set(data.map((r: { platform: string }) => r.platform))].sort();
}

interface MetricsPageProps {
  searchParams: Promise<{ platform?: string }>;
}

async function MetricsContent({ platform }: { platform: string }) {
  const results = await getEnrichedResults(platform);
  const platforms = await getAvailablePlatforms();

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg text-[#9CA3AF]">No enriched results found.</p>
        <p className="mt-2 text-sm text-[#6B7280]">
          Run the enrichment script first:{' '}
          <code className="text-[#00D4AA]">node scripts/enrich-supabase-metrics.js</code>
        </p>
      </div>
    );
  }

  const isSinglePlatform = platform !== 'all';
  const visibility = getVisibilityScore(results, isSinglePlatform);
  const trust = getTrustScore(results);
  const acquisition = getAcquisitionScore(results);
  const recommendation = getRecommendationScore(results);

  const topicCount = new Set(results.map(r => r.topic_name)).size;
  const dominantTopics = Math.round(trust.topicDominanceScore * topicCount);

  return (
    <>
      <div className="mb-6">
        <MetricsFilter platforms={platforms} currentPlatform={platform} />
      </div>

      <p className="mb-4 text-sm text-[#6B7280]">
        Showing {results.length} enriched results
        {platform !== 'all' ? ` for ${platform}` : ' across all platforms'}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PillarCard
          title="Visibility"
          score={visibility.composite}
          icon={Eye}
          subMetrics={[
            { label: 'Mention Rate', value: formatPercent(visibility.mentionRate) },
            { label: 'Share of Voice', value: formatPercent(visibility.shareOfVoice) },
            ...(visibility.platformSpread !== null
              ? [{ label: 'Platform Spread', value: formatPercent(visibility.platformSpread) }]
              : [{ label: 'Platform Spread', value: 'N/A' }]),
          ]}
        />
        <PillarCard
          title="Trust"
          score={trust.composite}
          icon={Shield}
          subMetrics={[
            { label: 'Positive Sentiment', value: formatPercent(trust.sentimentBreakdown.positive) },
            { label: 'Hedged', value: formatPercent(trust.sentimentBreakdown.hedged) },
            { label: 'Topic Dominance', value: `${dominantTopics}/${topicCount}` },
          ]}
        />
        <PillarCard
          title="Customer Acquisition"
          score={acquisition.composite}
          icon={ShoppingCart}
          subMetrics={[
            { label: 'High-Intent Rate', value: formatPercent(acquisition.highIntentMentionRate) },
            { label: 'CTA Presence', value: formatPercent(acquisition.ctaPresenceRate) },
          ]}
        />
        <PillarCard
          title="Recommendation"
          score={recommendation.composite}
          icon={ThumbsUp}
          subMetrics={[
            { label: 'Recommended', value: formatPercent(recommendation.recommendationRate) },
            { label: 'Strong Rec.', value: formatPercent(recommendation.strongRecommendationRate) },
            { label: 'Wins Comparisons', value: formatPercent(recommendation.decisionCriteriaWinRate) },
          ]}
        />
      </div>

      {visibility.platformSpread !== null && visibility.platformSpreadPromptCount > 0 && (
        <p className="mt-3 text-xs text-[#6B7280]">
          Spread calculated across {visibility.platformSpreadPromptCount} prompts with multi-platform coverage
        </p>
      )}

      <div className="mt-6 rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-5">
        <h3 className="mb-3 text-sm font-medium text-[#E5E7EB]">Sentiment Distribution</h3>
        <SentimentBar breakdown={trust.sentimentBreakdown} />
      </div>
    </>
  );
}

export default async function MetricsPage({ searchParams }: MetricsPageProps) {
  const params = await searchParams;
  const platform = params.platform || 'all';

  return (
    <PageContainer title="AISO Metrics" description="Four-pillar analysis of AI search presence">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00D4AA] border-t-transparent" />
            <span className="ml-3 text-[#9CA3AF]">Loading metrics from Supabase...</span>
          </div>
        }
      >
        <MetricsContent platform={platform} />
      </Suspense>
    </PageContainer>
  );
}
