'use client';

import { useState } from 'react';
import { MessageSquare, Trophy, PieChart, TrendingUp, Link2, ChevronDown, ChevronUp, Info, Calculator } from 'lucide-react';
import { MetricCard, Tooltip } from '@/components/shared';
import type { OverviewStats } from '@/lib/db';
import { formatPercent, cn } from '@/lib/utils';

// NOTE: As of 2026-04-22 this component is exported from
// `components/dashboard/index.ts` but not rendered by any page — Executive
// Summary uses <ExecutiveSummary> + <PillarCard> instead. Kept around (and
// kept current) so it's ready if/when reintroduced.

// Industry weights — matches collector/src/industry-profiles.ts. Indexed by
// archetype id stored on the clients row.
const INDUSTRY_WEIGHTS: Record<string, { domain: number; mention: number; position: number; voice: number }> = {
  'fashion-apparel': { domain: 15, mention: 35, position: 25, voice: 25 },
  'saas-software': { domain: 40, mention: 25, position: 20, voice: 15 },
  'finance-banking': { domain: 30, mention: 30, position: 20, voice: 20 },
  'healthcare-pharma': { domain: 45, mention: 25, position: 15, voice: 15 },
  'retail-ecommerce': { domain: 25, mention: 30, position: 25, voice: 20 },
  'travel-hospitality': { domain: 20, mention: 35, position: 25, voice: 20 },
  'food-beverage': { domain: 15, mention: 40, position: 25, voice: 20 },
  'default': { domain: 25, mention: 30, position: 25, voice: 20 },
};

const ARCHETYPE_LABEL: Record<string, string> = {
  'fashion-apparel': 'Fashion & Apparel',
  'saas-software': 'SaaS / Software',
  'finance-banking': 'Finance & Banking',
  'healthcare-pharma': 'Healthcare / Pharma',
  'retail-ecommerce': 'Retail / E-commerce',
  'travel-hospitality': 'Travel & Hospitality',
  'food-beverage': 'Food & Beverage',
};

const LOW_CITATION_ARCHETYPES = new Set(['fashion-apparel', 'food-beverage']);

interface ScoreComponent {
  id: string;
  label: string;
  description: string;
  rawValue: number;
  rawDisplay: string;
  weight: number;
  contribution: number;
  color: string;
  icon: React.ElementType;
}

interface ScoreBreakdownProps {
  overviewData?: OverviewStats | null;
  archetype?: string;
}

export function ScoreBreakdown({ overviewData, archetype }: ScoreBreakdownProps) {
  const [showCitations, setShowCitations] = useState(false);

  if (!overviewData) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6 text-sm text-[#9CA3AF]">
        No overview data available.
      </div>
    );
  }

  const brandMentionRate = overviewData.mentionRate;
  const firstMentionRate = overviewData.firstMentionRate;
  const shareOfVoice = overviewData.shareOfVoice;
  const citationRate = overviewData.citationRate;
  const totalResponses = overviewData.totalResults;
  const promptsWithMention = overviewData.promptsWithMention;
  const promptsWithCitation = overviewData.promptsWithCitation;

  // Industry weights from archetype, falling back to a generic default.
  const industryId = archetype ?? 'default';
  const weights = INDUSTRY_WEIGHTS[industryId] ?? INDUSTRY_WEIGHTS['default'];
  const industryName = archetype ? ARCHETYPE_LABEL[archetype] : 'General';

  // Position score: not currently in OverviewStats. Treated as 0 until
  // avgMentionPosition is added to the server-side computation.
  const avgPosition = 0;
  const positionScore = 0;

  // Calculate each component's contribution
  const components: ScoreComponent[] = [
    {
      id: 'mention',
      label: 'Brand Mentions',
      description: 'How often your brand is mentioned in AI responses',
      rawValue: brandMentionRate,
      rawDisplay: formatPercent(brandMentionRate),
      weight: weights.mention,
      contribution: brandMentionRate * weights.mention,
      color: 'bg-emerald-500',
      icon: MessageSquare,
    },
    {
      id: 'position',
      label: 'Mention Position',
      description: 'How early your brand appears when mentioned (1st = 100%, 5th+ = 0%)',
      rawValue: positionScore,
      rawDisplay: avgPosition > 0 ? `#${avgPosition.toFixed(1)} avg` : 'N/A',
      weight: weights.position,
      contribution: positionScore * weights.position,
      color: 'bg-blue-500',
      icon: TrendingUp,
    },
    {
      id: 'voice',
      label: 'Share of Voice',
      description: 'Your brand mentions vs all competitor mentions',
      rawValue: shareOfVoice,
      rawDisplay: formatPercent(shareOfVoice),
      weight: weights.voice,
      contribution: shareOfVoice * weights.voice,
      color: 'bg-purple-500',
      icon: PieChart,
    },
    {
      id: 'domain',
      label: 'Domain Citations',
      description: 'How often your website is directly cited as a source',
      rawValue: citationRate,
      rawDisplay: formatPercent(citationRate),
      weight: weights.domain,
      contribution: citationRate * weights.domain,
      color: 'bg-amber-500',
      icon: Link2,
    },
  ];

  const sortedComponents = [...components].sort((a, b) => b.contribution - a.contribution);
  const totalScore = Math.round(components.reduce((sum, c) => sum + c.contribution, 0));
  const maxPossible = 100;

  const segmentColors: Record<string, string> = {
    'bg-emerald-500': '#10B981',
    'bg-blue-500': '#3B82F6',
    'bg-purple-500': '#8B5CF6',
    'bg-amber-500': '#F59E0B',
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#9CA3AF]" />
          <span className="text-sm font-medium text-[#E5E7EB]">Score Breakdown</span>
        </div>
        <span className="text-xs text-[#6B7280]">
          Weighted for {industryName}
        </span>
      </div>

      {/* Stacked segmented bar */}
      <div>
        <div className="flex h-3 rounded-full overflow-hidden bg-[#22252F]">
          {sortedComponents.map((c) => (
            <div
              key={c.id}
              className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${c.contribution}%`,
                backgroundColor: segmentColors[c.color] ?? '#6B7280',
              }}
              title={`${c.label}: +${c.contribution.toFixed(1)}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 mt-2">
          {sortedComponents.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: segmentColors[c.color] ?? '#6B7280' }}
              />
              <span className="text-xs text-[#6B7280]">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Score Components */}
      <div className="space-y-3">
        {sortedComponents.map((component) => {
          const Icon = component.icon;
          const contributionPercent = (component.contribution / maxPossible) * 100;

          return (
            <div key={component.id} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="p-1.5 rounded"
                    style={{ backgroundColor: `${segmentColors[component.color] ?? '#6B7280'}20` }}
                  >
                    <Icon
                      className="h-3.5 w-3.5"
                      style={{ color: segmentColors[component.color] ?? '#6B7280' }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[#E5E7EB]">{component.label}</span>
                  <Tooltip content={component.description}>
                    <Info className="h-3 w-3 text-[#6B7280] cursor-help" />
                  </Tooltip>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[#9CA3AF] font-data tabular-nums">
                    {component.rawDisplay}
                  </span>
                  <span className="text-[#6B7280]">&times;</span>
                  <span className="text-[#9CA3AF] font-data tabular-nums w-8 text-right">
                    {component.weight}%
                  </span>
                  <span className="text-[#6B7280]">=</span>
                  <span className={cn(
                    'font-semibold font-data tabular-nums w-12 text-right',
                    component.contribution > 10 ? 'text-emerald-400' :
                    component.contribution > 5 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    +{component.contribution.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[#22252F] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, contributionPercent * 2)}%`,
                      backgroundColor: segmentColors[component.color] ?? '#6B7280',
                    }}
                  />
                </div>
                <span className="text-xs text-[#6B7280] font-data w-16 text-right">
                  {contributionPercent.toFixed(1)}% of 100
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-3 border-t border-[#2A2D37]">
        <span className="text-sm font-medium text-[#9CA3AF]">Total Score</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {sortedComponents.map((c, i) => (
              <span key={c.id} className="contents">
                {i > 0 && <span className="text-[#6B7280] text-sm mx-0.5">+</span>}
                <span className={cn(
                  'text-sm font-semibold font-data',
                  c.contribution > 10 ? 'text-emerald-400' :
                  c.contribution > 5 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {c.contribution.toFixed(1)}
                </span>
              </span>
            ))}
          </div>
          <span className="text-[#6B7280] text-sm">=</span>
          <span className={cn(
            'text-xl font-bold font-data',
            totalScore >= 60 ? 'text-emerald-400' :
            totalScore >= 40 ? 'text-amber-400' : 'text-red-400'
          )}>
            {totalScore}/100
          </span>
        </div>
      </div>

      {/* Insight */}
      <div className="bg-[#22252F] rounded-lg p-3 text-xs text-[#9CA3AF]">
        <strong className="text-[#E5E7EB]">Biggest opportunity:</strong>{' '}
        {(() => {
          const lowest = sortedComponents[sortedComponents.length - 1];
          const potential = lowest.weight - lowest.contribution;
          return `Improving ${lowest.label.toLowerCase()} could add up to +${potential.toFixed(0)} points to your score.`;
        })()}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 gap-4 pt-2">
        <MetricCard
          label="Brand Mentions"
          value={formatPercent(brandMentionRate)}
          subValue={`${promptsWithMention} of ${totalResponses}`}
          icon={MessageSquare}
          variant="compact"
        />
        <MetricCard
          label="First Mention"
          value={formatPercent(firstMentionRate)}
          subValue="Mentioned first"
          icon={Trophy}
          variant="compact"
        />
        <MetricCard
          label="Share of Voice"
          value={formatPercent(shareOfVoice)}
          subValue="Of all mentions"
          icon={PieChart}
          variant="compact"
        />
        <MetricCard
          label="Avg Position"
          value="N/A"
          subValue="Not yet computed"
          icon={TrendingUp}
          variant="compact"
        />
      </div>

      {/* Secondary: Citation metrics (collapsible) */}
      <div className="border-t border-[#2A2D37] pt-3">
        <button
          onClick={() => setShowCitations(!showCitations)}
          className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#9CA3AF] transition-colors"
        >
          {showCitations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Domain Citation Details
          {archetype && LOW_CITATION_ARCHETYPES.has(archetype) && (
            <span className="text-xs bg-[#22252F] px-2 py-0.5 rounded">
              {weights.domain}% weight for {industryName}
            </span>
          )}
        </button>
        {showCitations && (
          <div className="grid grid-cols-2 gap-4 mt-3">
            <MetricCard
              label="Domain Citation Rate"
              value={formatPercent(citationRate)}
              subValue={`${promptsWithCitation} of ${totalResponses} prompts`}
              icon={Link2}
              variant="compact"
            />
            <MetricCard
              label="Prompts Cited"
              value={`${promptsWithCitation}/${totalResponses}`}
              subValue="Direct URL citations"
              icon={Link2}
              variant="compact"
            />
          </div>
        )}
      </div>
    </div>
  );
}
