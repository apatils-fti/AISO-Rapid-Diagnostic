'use client';

import { MessageSquare, Trophy, PieChart, TrendingUp, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { MetricCard } from '@/components/shared';
import { analyzedMetrics } from '@/lib/fixtures';
import { formatPercent } from '@/lib/utils';

export function ScoreBreakdown() {
  const { summary, textMetrics } = analyzedMetrics;
  const [showCitations, setShowCitations] = useState(false);

  // Total responses for calculating counts
  const totalResponses = textMetrics?.overall.totalResponses ?? summary.totalPrompts * 3;

  // Primary metrics: Text-based (what matters for fashion/consumer brands)
  const primaryMetrics = [
    {
      label: 'Brand Mention Rate',
      value: formatPercent(summary.brandMentionRate ?? 0),
      subValue: `${Math.round((summary.brandMentionRate ?? 0) * totalResponses)} of ${totalResponses} responses`,
      icon: MessageSquare,
    },
    {
      label: 'First Mention Rate',
      value: formatPercent(summary.firstMentionRate ?? 0),
      subValue: 'Mentioned first in responses',
      icon: Trophy,
    },
    {
      label: 'Share of Voice',
      value: formatPercent(summary.shareOfVoice ?? 0),
      subValue: 'Of all brand mentions',
      icon: PieChart,
    },
    {
      label: 'Avg Position',
      value: summary.avgMentionPosition ? `#${summary.avgMentionPosition.toFixed(1)}` : 'N/A',
      subValue: 'When mentioned',
      icon: TrendingUp,
    },
  ];

  // Secondary metrics: Citation-based (less relevant for fashion)
  const citationMetrics = [
    {
      label: 'Domain Citations',
      value: formatPercent(summary.citationShare),
      subValue: `${summary.clientCitations} of ${summary.totalCitations} citations`,
      icon: Link2,
    },
    {
      label: 'Prompts Cited',
      value: `${summary.platformBreakdown.perplexity.promptsCited}/${summary.totalPrompts}`,
      subValue: 'Direct URL citations',
      icon: Link2,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Primary: Text-based metrics */}
      <div className="grid grid-cols-4 gap-4">
        {primaryMetrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            subValue={metric.subValue}
            icon={metric.icon}
            variant="compact"
          />
        ))}
      </div>

      {/* Secondary: Citation metrics (collapsible) */}
      <div className="border-t pt-3">
        <button
          onClick={() => setShowCitations(!showCitations)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showCitations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Domain Citation Metrics
          {summary.industry?.citationExpectation === 'low' && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">Less relevant for {summary.industry.name}</span>
          )}
        </button>
        {showCitations && (
          <div className="grid grid-cols-2 gap-4 mt-3">
            {citationMetrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                subValue={metric.subValue}
                icon={metric.icon}
                variant="compact"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
