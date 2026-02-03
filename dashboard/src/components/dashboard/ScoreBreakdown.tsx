'use client';

import { TrendingUp, Link2, Repeat, Brain } from 'lucide-react';
import { MetricCard } from '@/components/shared';
import { analyzedMetrics } from '@/lib/fixtures';
import { formatPercent } from '@/lib/utils';

export function ScoreBreakdown() {
  const { summary } = analyzedMetrics;

  const metrics = [
    {
      label: 'Citation Share',
      value: formatPercent(summary.citationShare),
      subValue: `${summary.clientCitations} of ${summary.totalCitations} citations`,
      icon: Link2,
    },
    {
      label: 'Citation Frequency',
      value: `${summary.platformBreakdown.perplexity.promptsCited}/${summary.totalPrompts}`,
      subValue: 'Prompts with client citation',
      icon: TrendingUp,
    },
    {
      label: 'Isotope Robustness',
      value: formatPercent(summary.ragCitationRate),
      subValue: 'Avg. presence across isotopes',
      icon: Repeat,
    },
    {
      label: 'Parametric Presence',
      value: formatPercent(summary.parametricMentionRate),
      subValue: 'Brand recognition in AI',
      icon: Brain,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {metrics.map((metric) => (
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
  );
}
