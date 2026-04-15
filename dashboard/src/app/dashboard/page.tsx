import { Suspense } from 'react';
import { PageContainer } from '@/components/layout';
import {
  CompetitorQuickCompare,
  PlatformOverview,
  TopGapsCard,
  ExecutiveSummary,
} from '@/components/dashboard';
import { PillarCard, SentimentBar } from '@/components/metrics';
import type { SampleResponse } from '@/components/metrics/PillarCard';
import { getOverviewStats, getPlatformComparison, getClients, type QueryFilters } from '@/lib/db';
import { supabaseService } from '@/lib/supabase';
import {
  getVisibilityScore,
  getTrustScore,
  getAcquisitionScore,
  getRecommendationScore,
  getWeightsForArchetype,
} from '@/lib/metrics';
import type { EnrichedResult } from '@/lib/metrics';
import { formatPercent } from '@/lib/utils';
import { EnrichmentFilters, PlatformDataProvider } from '@/components/shared';
import { MetricsFilter } from '../metrics/metrics-filter';

const DEFAULT_CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';

interface DashboardPageProps {
  searchParams: Promise<{ client?: string; platform?: string; sentiment?: string; isotope?: string; intent?: string }>;
}

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

async function DashboardContent({ clientId, filters }: { clientId: string; filters: QueryFilters }) {
  const [overview, platformStats, results, platforms, clients] = await Promise.all([
    getOverviewStats(clientId, filters),
    getPlatformComparison(clientId, filters),
    getEnrichedResults(clientId, filters),
    getAvailablePlatforms(clientId),
    getClients(),
  ]);

  // Archetype weights
  const client = clients.find(c => c.id === clientId);
  const archetype = client?.archetype;
  const weights = getWeightsForArchetype(archetype);

  const platform = filters.platform || 'all';
  const isSinglePlatform = platform !== 'all';

  // First Mention Rate requires the competitor list from the client's config
  // row to scan response text for competitor positioning. Config shape
  // mirrors generator/configs/*.json: { competitors: [{name, domains}], ... }.
  // If the shape is missing or empty we fall back to hardcoded J.Crew
  // competitors so the dashboard isn't silently broken on the default client.
  // TODO: remove the hardcoded fallback once every clients row has a full
  //       config JSON populated.
  const clientConfig = (client?.config ?? {}) as { competitors?: Array<{ name: string }> };
  const competitorNames =
    clientConfig.competitors?.map(c => c.name).filter(Boolean) ?? [];
  const brandContext = {
    clientName: client?.name || 'J.Crew',
    competitorNames: competitorNames.length > 0
      ? competitorNames
      : ['Banana Republic', 'Everlane', 'Madewell', 'Uniqlo', 'Gap'],
  };

  const visibility = getVisibilityScore(results, isSinglePlatform, weights, brandContext);
  const trust = getTrustScore(results, weights);
  const acquisition = getAcquisitionScore(results, weights);
  const recommendation = getRecommendationScore(results, weights);

  const topicCount = new Set(results.map(r => r.topic_name)).size;
  const dominantTopics = Math.round(trust.topicDominanceScore * topicCount);

  // Sample responses per pillar — one per platform for diversity
  function toSample(r: EnrichedResult): SampleResponse {
    return {
      promptText: r.prompt_id,
      platform: r.platform,
      sentiment: r.sentiment || 'neutral',
      responseText: r.response_text || '',
      clientMentioned: r.client_mentioned,
    };
  }

  function pickOnePerPlatform(filtered: EnrichedResult[], max = 4): SampleResponse[] {
    const seen = new Set<string>();
    const samples: SampleResponse[] = [];
    for (const r of filtered) {
      if (seen.has(r.platform)) continue;
      seen.add(r.platform);
      samples.push(toSample(r));
      if (samples.length >= max) break;
    }
    // If fewer platforms than max, fill remaining slots
    if (samples.length < max) {
      for (const r of filtered) {
        if (samples.length >= max) break;
        if (!samples.some(s => s.platform === r.platform && s.promptText === r.prompt_id)) {
          samples.push(toSample(r));
        }
      }
    }
    return samples;
  }

  const visibilitySamples = pickOnePerPlatform(results.filter(r => r.client_mentioned));
  const trustSamples = pickOnePerPlatform(results.filter(r => r.sentiment === 'positive' || r.sentiment === 'hedged'));
  const acquisitionSamples = pickOnePerPlatform(results.filter(r => r.isotope === 'commercial' || r.isotope === 'specific'));
  const recommendationSamples = pickOnePerPlatform(results.filter(r => r.recommendation_strength === 'strong' || r.recommendation_strength === 'qualified'));

  // Formula definitions — plain English metric definitions
  const visFormula = `Mention Rate = prompts where brand was mentioned / total prompts
First Mention Rate = prompts where brand was named first / prompts where brand was mentioned
Share of Voice = brand mentions / all brand mentions in responses
Citation Rate = responses citing brand domain / total responses
Platform Spread = avg platforms mentioning brand per prompt / platforms with data`;

  const trustFormula = `Positive Sentiment = responses with positive sentiment / responses where brand was mentioned
Hedged Sentiment = responses with hedged sentiment / responses where brand was mentioned
Topic Dominance = topics where brand is most-mentioned / total topics tracked
Owned Sources = citations from brand domain / total citations
Earned Media = citations from editorial + blog + news + review sites / total citations`;

  const acqFormula = `High-Intent Rate = brand mentions on commercial + specific prompts / total commercial + specific prompts
CTA Presence = responses with actionable next step / responses where brand was mentioned
Isotope rates = brand mentions per isotope type / total prompts of that isotope`;

  const recFormula = `Recommendation Rate = responses with recommendation language / responses where brand was mentioned
Strong Rec. = responses with "best option", "top choice", etc. / responses where brand was mentioned
Wins Comparisons = comparative prompts where brand gets final recommendation / total comparative prompts`;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-3">
        <MetricsFilter platforms={platforms} currentPlatform={platform} />
        <EnrichmentFilters />
      </div>

      {/* Executive Summary */}
      <ExecutiveSummary overviewData={overview} clientName={client?.name || 'J.Crew'} />

      {results.length > 0 && (
        <p className="text-sm text-[#6B7280]">
          {results.length} enriched results
          {platform !== 'all' ? ` for ${platform}` : ' across all platforms'}
          {archetype && <span className="ml-2 text-[#00D4AA]">({archetype} weights)</span>}
        </p>
      )}

      {/* Four AISO Pillar Cards */}
      {results.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PillarCard
              title="Visibility"
              score={visibility.composite}
    
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
            <p className="text-xs text-[#6B7280]">
              Spread calculated across {visibility.platformSpreadPromptCount} prompts with multi-platform coverage
            </p>
          )}

          {/* Sentiment Distribution */}
          <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-5">
            <h3 className="mb-3 text-sm font-medium text-[#E5E7EB]">Sentiment Distribution</h3>
            <SentimentBar breakdown={trust.sentimentBreakdown} />
          </div>
        </>
      )}

      {/* Competitor + Platform Overview */}
      <div className="grid grid-cols-2 gap-6">
        <CompetitorQuickCompare />
        <PlatformOverview platformData={platformStats} />
      </div>

      {/* Top Opportunities */}
      <TopGapsCard />
    </div>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const clientId = params.client || DEFAULT_CLIENT_ID;
  const filters: QueryFilters = {
    platform: params.platform,
    sentiment: params.sentiment,
    isotope: params.isotope,
    conversionIntent: params.intent,
  };

  const clients = await getClients();
  const clientOptions = clients.map(c => ({ id: c.id, name: c.name }));

  return (
    <PageContainer
      title="Executive Summary"
      description="AI Search Presence Overview"
      clients={clientOptions}
      currentClientId={clientId}
    >
      <PlatformDataProvider key={clientId} clientId={clientId}>
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6 h-32 animate-pulse" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-5 h-48 animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6 h-48 animate-pulse" />
              <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6 h-48 animate-pulse" />
            </div>
          </div>
        }
      >
        <DashboardContent clientId={clientId} filters={filters} />
      </Suspense>
      </PlatformDataProvider>
    </PageContainer>
  );
}
