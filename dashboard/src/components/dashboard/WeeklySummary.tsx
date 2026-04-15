import { TrendingUp, TrendingDown, Minus, Trophy, ArrowUpRight } from 'lucide-react';
import type { WeeklySummary as WeeklySummaryData } from '@/lib/db';
import { cn } from '@/lib/utils';

interface WeeklySummaryProps {
  data: WeeklySummaryData;
}

const PLATFORM_LABELS: Record<string, string> = {
  perplexity: 'Perplexity',
  chatgpt_search: 'ChatGPT Search',
  gemini: 'Gemini',
  claude: 'Claude',
  google_ai_overview: 'Google AI Overview',
};

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function formatDelta(delta: number): { label: string; icon: React.ComponentType<{ className?: string }>; color: string } {
  const abs = Math.abs(delta * 100);
  if (delta > 0.005) {
    return {
      label: `↑ ${abs.toFixed(1)}pt this week`,
      icon: TrendingUp,
      color: 'text-[#00D4AA]',
    };
  }
  if (delta < -0.005) {
    return {
      label: `↓ ${abs.toFixed(1)}pt this week`,
      icon: TrendingDown,
      color: 'text-[#FF6B6B]',
    };
  }
  return {
    label: 'Flat this week',
    icon: Minus,
    color: 'text-[#9CA3AF]',
  };
}

/**
 * Weekly summary card for the Overview page. Rendered conditionally by
 * the dashboard server component when `getWeeklySummary(clientId)` returns
 * non-null (i.e. when ≥2 distinct run_dates exist for the client).
 *
 * Server component. Data comes from the parent's await, no loading state.
 */
export function WeeklySummary({ data }: WeeklySummaryProps) {
  const delta = formatDelta(data.deltaMentionRate);
  const DeltaIcon = delta.icon;
  const platformLabel = data.bestPlatform
    ? PLATFORM_LABELS[data.bestPlatform.platform] ?? data.bestPlatform.platform
    : null;

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg font-semibold text-[#E5E7EB]">
            This Week
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {data.startDate} → {data.endDate} · {data.daysOfData} day
            {data.daysOfData === 1 ? '' : 's'} of data
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Delta card */}
        <div className="rounded-lg border border-[#2A2D37] bg-[#0B0D12] p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#6B7280] mb-2">
            <DeltaIcon className={cn('h-3 w-3', delta.color)} />
            <span>Mention Rate Delta</span>
          </div>
          <div className={cn('text-2xl font-semibold', delta.color)}>
            {delta.label}
          </div>
          <div className="text-xs text-[#9CA3AF] mt-1">
            {formatPct(data.startMentionRate)} → {formatPct(data.endMentionRate)}
          </div>
        </div>

        {/* Best platform card */}
        <div className="rounded-lg border border-[#2A2D37] bg-[#0B0D12] p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#6B7280] mb-2">
            <Trophy className="h-3 w-3 text-[#F59E0B]" />
            <span>Best Platform</span>
          </div>
          {platformLabel ? (
            <>
              <div className="text-lg font-semibold text-[#E5E7EB]">
                {platformLabel}
              </div>
              <div className="text-xs text-[#9CA3AF] mt-1">
                {formatPct(data.bestPlatform!.mention_rate)} mention rate
              </div>
            </>
          ) : (
            <div className="text-sm text-[#6B7280]">No platform data</div>
          )}
        </div>

        {/* Most improved topic card */}
        <div className="rounded-lg border border-[#2A2D37] bg-[#0B0D12] p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#6B7280] mb-2">
            <ArrowUpRight className="h-3 w-3 text-[#00D4AA]" />
            <span>Most Improved Topic</span>
          </div>
          {data.mostImprovedTopic ? (
            <>
              <div
                className="text-sm font-medium text-[#E5E7EB] line-clamp-2"
                title={data.mostImprovedTopic.topicName}
              >
                {data.mostImprovedTopic.topicName}
              </div>
              <div className="text-xs text-[#9CA3AF] mt-1">
                {formatPct(data.mostImprovedTopic.startRate)} →{' '}
                {formatPct(data.mostImprovedTopic.endRate)}
                <span
                  className={cn(
                    'ml-2',
                    data.mostImprovedTopic.delta >= 0 ? 'text-[#00D4AA]' : 'text-[#FF6B6B]',
                  )}
                >
                  {data.mostImprovedTopic.delta >= 0 ? '+' : ''}
                  {(data.mostImprovedTopic.delta * 100).toFixed(1)}pt
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-[#6B7280]">
              Not enough topic data for week-over-week comparison
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
