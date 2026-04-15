'use client';

import { MessageSquare, Trophy, PieChart, TrendingUp, Link2, ChevronDown, ChevronUp, Info, Calculator } from 'lucide-react';
import { useState, useEffect } from 'react';
import { MetricCard, Tooltip } from '@/components/shared';
import { analyzedMetrics } from '@/lib/fixtures';
import { getOverallBrandMetrics, type OverallBrandMetrics } from '@/lib/platform-data';
import { formatPercent, cn } from '@/lib/utils';

// Industry weights - matching collector/src/industry-profiles.ts
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

export function ScoreBreakdown() {
  const { summary, textMetrics } = analyzedMetrics;
  const [showCitations, setShowCitations] = useState(false);
  const [batchMetrics, setBatchMetrics] = useState<OverallBrandMetrics | null>(null);

  useEffect(() => {
    getOverallBrandMetrics().then(setBatchMetrics);
  }, []);

  // Use batch metrics when available, fall back to fixture
  const brandMentionRate = batchMetrics?.brandMentionRate ?? summary.brandMentionRate ?? 0;
  const firstMentionRate = batchMetrics?.firstMentionRate ?? summary.firstMentionRate ?? 0;
  const shareOfVoice = batchMetrics?.shareOfVoice ?? summary.shareOfVoice ?? 0;
  const citationRate = batchMetrics?.citationRate ?? summary.citationShare;
  const totalResponses = batchMetrics?.totalResponses ?? textMetrics?.overall.totalResponses ?? summary.totalPrompts * 3;
  const promptsWithMention = batchMetrics?.promptsWithMention ?? Math.round(brandMentionRate * totalResponses);
  const promptsWithCitation = batchMetrics?.promptsWithCitation ?? 0;

  // Get industry weights
  const industryId = summary.industry?.id ?? 'default';
  const weights = INDUSTRY_WEIGHTS[industryId] ?? INDUSTRY_WEIGHTS['default'];

  // Calculate position score (same formula as analyze.ts)
  const avgPosition = summary.avgMentionPosition ?? 0;
  const positionScore = avgPosition > 0
    ? Math.max(0, 1 - (avgPosition - 1) / 4)
    : 0;

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

  // Sort by contribution (highest first)
  const sortedComponents = [...components].sort((a, b) => b.contribution - a.contribution);
  const totalScore = Math.round(components.reduce((sum, c) => sum + c.contribution, 0));
  const maxPossible = 100;

  // Color map for segmented bar (raw hex values)
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
          Weighted for {summary.industry?.name ?? 'General'}
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
        {/* Legend for segmented bar */}
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

      {/* Score Components — always visible */}
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
              {/* Progress bar showing contribution */}
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
          value={summary.avgMentionPosition ? `#${summary.avgMentionPosition.toFixed(1)}` : 'N/A'}
          subValue="When mentioned"
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
          {summary.industry?.citationExpectation === 'low' && (
            <span className="text-xs bg-[#22252F] px-2 py-0.5 rounded">
              {weights.domain}% weight for {summary.industry.name}
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
