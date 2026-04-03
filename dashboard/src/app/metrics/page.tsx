import { Suspense } from 'react';
import { Eye, Shield, ShoppingCart, ThumbsUp } from 'lucide-react';
import { PageContainer } from '@/components/layout';
import { PillarCard, SentimentBar } from '@/components/metrics';
import type { SampleResponse } from '@/components/metrics/PillarCard';
import { supabaseService } from '@/lib/supabase';
import { getClients, type QueryFilters } from '@/lib/db';
import { EnrichmentFilters } from '@/components/shared';
import {
  getVisibilityScore,
  getTrustScore,
  getAcquisitionScore,
  getRecommendationScore,
  getWeightsForArchetype,
} from '@/lib/metrics';
import type { EnrichedResult } from '@/lib/metrics';
import { formatPercent } from '@/lib/utils';
import { MetricsFilter } from './metrics-filter';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

async function getEnrichedResults(clientId: string, filters: QueryFilters): Promise<EnrichedResult[]> {
  if (!supabaseService) return [];

  const { data: runs, error: runsError } = await supabaseService
    .from('runs')
    .select('id')
    .eq('client_id', clientId);

  if (runsError || !runs || runs.length === 0) return [];
  const runIds = runs.map((r: { id: string }) => r.id);

  let query = supabaseService
    .from('results')
    .select('*')
    .in('run_id', runIds)
    .not('sentiment', 'is', null);

  if (filters.platform && filters.platform !== 'all') query = query.eq('platform', filters.platform);
  if (filters.sentiment && filters.sentiment !== 'all') query = query.eq('sentiment', filters.sentiment);
  if (filters.isotope && filters.isotope !== 'all') query = query.eq('isotope', filters.isotope);
  if (filters.conversionIntent && filters.conversionIntent !== 'all') query = query.eq('conversion_intent', filters.conversionIntent);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as EnrichedResult[];
}

async function getAvailablePlatforms(clientId: string): Promise<string[]> {
  if (!supabaseService) return [];

  const { data: runs } = await supabaseService
    .from('runs')
    .select('id')
    .eq('client_id', clientId);

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
  searchParams: Promise<{ platform?: string; client?: string; sentiment?: string; isotope?: string; intent?: string }>;
}

async function MetricsContent({ filters, clientId }: { filters: QueryFilters; clientId: string }) {
  const [results, platforms, clients] = await Promise.all([
    getEnrichedResults(clientId, filters),
    getAvailablePlatforms(clientId),
    getClients(),
  ]);

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

  // Get archetype for selected client
  const client = clients.find(c => c.id === clientId);
  const archetype = client?.archetype;
  const weights = getWeightsForArchetype(archetype);

  const platform = filters.platform || 'all';
  const isSinglePlatform = platform !== 'all';
  const visibility = getVisibilityScore(results, isSinglePlatform, weights);
  const trust = getTrustScore(results, weights);
  const acquisition = getAcquisitionScore(results, weights);
  const recommendation = getRecommendationScore(results, weights);

  const topicCount = new Set(results.map(r => r.topic_name)).size;
  const dominantTopics = Math.round(trust.topicDominanceScore * topicCount);

  // Select sample responses per pillar
  function toSample(r: EnrichedResult): SampleResponse {
    return {
      promptText: r.prompt_id,
      platform: r.platform,
      sentiment: r.sentiment || 'neutral',
      responseText: r.response_text || '',
      clientMentioned: r.client_mentioned,
    };
  }

  const visibilitySamples = results
    .filter(r => r.client_mentioned)
    .slice(0, 4)
    .map(toSample);

  const trustSamples = results
    .filter(r => r.sentiment === 'positive' || r.sentiment === 'hedged')
    .slice(0, 4)
    .map(toSample);

  const acquisitionSamples = results
    .filter(r => r.isotope === 'commercial' || r.isotope === 'specific')
    .slice(0, 4)
    .map(toSample);

  const recommendationSamples = results
    .filter(r => r.recommendation_strength === 'strong' || r.recommendation_strength === 'qualified')
    .slice(0, 4)
    .map(toSample);

  // Build formula strings from weights
  const vw = weights.visibility;
  const tw = weights.trust;
  const aw = weights.acquisition;
  const rw = weights.recommendation;

  const visFormula = archetype
    ? `Score = ${vw.mentionRate}×Mention + ${vw.shareOfVoice}×SoV + ${vw.firstMentionRate}×FirstMention + ${vw.platformSpread}×Spread\nArchetype: ${archetype}`
    : `Score = 0.35×Mention + 0.30×SoV + 0.20×FirstMention + 0.15×Spread`;

  const trustFormula = archetype
    ? `Score = ${tw.citationRate}×Citation + ${tw.sentimentPositive}×Sentiment+ + ${tw.topicDominance}×TopicDom\nArchetype: ${archetype}`
    : `Score = 0.30×Citation + 0.45×Sentiment+ + 0.25×TopicDom`;

  const acqFormula = archetype
    ? `Score = ${aw.highIntentMentionRate}×HighIntent + ${aw.conversionQueryMentionRate}×ConvQuery + ${aw.ctaPresenceRate}×CTA\nArchetype: ${archetype}`
    : `Score = 0.40×HighIntent + 0.35×ConvQuery + 0.25×CTA`;

  const recFormula = archetype
    ? `Score = ${rw.recommendationRate}×RecRate + ${rw.strongRecommendationRate}×StrongRec + ${rw.decisionCriteriaWinRate}×CompWin\nArchetype: ${archetype}`
    : `Score = 0.35×RecRate + 0.30×StrongRec + 0.35×CompWin`;

  return (
    <>
      <div className="mb-6">
        <MetricsFilter platforms={platforms} currentPlatform={platform} />
        <EnrichmentFilters />
      </div>

      <p className="mb-4 text-sm text-[#6B7280]">
        Showing {results.length} enriched results
        {platform !== 'all' ? ` for ${platform}` : ' across all platforms'}
        {archetype && <span className="ml-2 text-[#00D4AA]">({archetype} weights)</span>}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PillarCard
          title="Visibility"
          score={visibility.composite}
          icon={Eye}
          formula={visFormula}
          subMetrics={[
            { label: 'Mention Rate', value: formatPercent(visibility.mentionRate) },
            { label: 'Share of Voice', value: formatPercent(visibility.shareOfVoice) },
            { label: 'Citation Rate', value: formatPercent(visibility.citationRate) },
            ...(visibility.platformSpread !== null
              ? [{ label: 'Platform Spread', value: formatPercent(visibility.platformSpread) }]
              : [{ label: 'Platform Spread', value: 'N/A' }]),
          ]}
          sampleResponses={visibilitySamples}
        />
        <PillarCard
          title="Trust"
          score={trust.composite}
          icon={Shield}
          formula={trustFormula}
          subMetrics={[
            { label: 'Positive Sentiment', value: formatPercent(trust.sentimentBreakdown.positive) },
            { label: 'Hedged', value: formatPercent(trust.sentimentBreakdown.hedged) },
            { label: 'Topic Dominance', value: `${dominantTopics}/${topicCount}` },
            ...(trust.citationSources.totalCitations > 0 ? [
              { label: 'Owned Sources', value: formatPercent(trust.citationSources.owned) },
              { label: 'Earned Media', value: formatPercent(
                trust.citationSources.earned_editorial +
                trust.citationSources.earned_blog +
                trust.citationSources.earned_news +
                trust.citationSources.earned_review
              ) },
              { label: 'Community', value: formatPercent(trust.citationSources.community) },
            ] : []),
          ]}
          sampleResponses={trustSamples}
        />
        <PillarCard
          title="Customer Acquisition"
          score={acquisition.composite}
          icon={ShoppingCart}
          formula={acqFormula}
          subMetrics={[
            { label: 'High-Intent Rate', value: formatPercent(acquisition.highIntentMentionRate) },
            { label: 'CTA Presence', value: formatPercent(acquisition.ctaPresenceRate) },
            ...acquisition.isotopeBreakdown.slice(0, 4).map(iso => ({
              label: `${iso.isotope}`,
              value: `${formatPercent(iso.mentionRate)} (${iso.mentioned}/${iso.total})`,
            })),
          ]}
          sampleResponses={acquisitionSamples}
        />
        <PillarCard
          title="Recommendation"
          score={recommendation.composite}
          icon={ThumbsUp}
          formula={recFormula}
          subMetrics={[
            { label: 'Recommended', value: formatPercent(recommendation.recommendationRate) },
            { label: 'Strong Rec.', value: formatPercent(recommendation.strongRecommendationRate) },
            { label: 'Wins Comparisons', value: formatPercent(recommendation.decisionCriteriaWinRate) },
          ]}
          sampleResponses={recommendationSamples}
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
  const clientId = params.client || DEFAULT_CLIENT_ID;
  const filters: QueryFilters = {
    platform: params.platform,
    sentiment: params.sentiment,
    isotope: params.isotope,
    conversionIntent: params.intent,
  };

  const clients = await getClients();

  return (
    <PageContainer
      title="AISO Metrics"
      description="Four-pillar analysis of AI search presence"
      clients={clients.map(c => ({ id: c.id, name: c.name }))}
      currentClientId={clientId}
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00D4AA] border-t-transparent" />
            <span className="ml-3 text-[#9CA3AF]">Loading metrics from Supabase...</span>
          </div>
        }
      >
        <MetricsContent filters={filters} clientId={clientId} />
      </Suspense>
    </PageContainer>
  );
}
