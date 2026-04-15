import type { SentimentBreakdown } from '@/lib/metrics';

interface SentimentBarProps {
  breakdown: SentimentBreakdown;
}

const SENTIMENT_COLORS: Record<string, { bg: string; label: string }> = {
  positive: { bg: '#10B981', label: 'Positive' },
  neutral: { bg: '#6B7280', label: 'Neutral' },
  hedged: { bg: '#F59E0B', label: 'Hedged' },
  negative: { bg: '#EF4444', label: 'Negative' },
};

export function SentimentBar({ breakdown }: SentimentBarProps) {
  const segments = ['positive', 'neutral', 'hedged', 'negative'] as const;
  const total = segments.reduce((sum, key) => sum + breakdown[key], 0);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-4">
        <p className="text-sm text-[#6B7280]">No sentiment data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#22252F]">
        {segments.map((key) => {
          const pct = breakdown[key] / total;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              style={{
                width: `${pct * 100}%`,
                backgroundColor: SENTIMENT_COLORS[key].bg,
              }}
              title={`${SENTIMENT_COLORS[key].label}: ${(pct * 100).toFixed(1)}%`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((key) => {
          const pct = (breakdown[key] / total) * 100;
          if (pct === 0) return null;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: SENTIMENT_COLORS[key].bg }}
              />
              <span className="text-xs text-[#9CA3AF]">
                {SENTIMENT_COLORS[key].label} {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
