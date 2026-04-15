'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight, Activity, ChevronDown } from 'lucide-react';
import { supabaseAnon } from '@/lib/supabase';
import { formatPercent } from '@/lib/utils';
import { COLORS, PLATFORM_COLORS, PLATFORM_LABELS } from '@/lib/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Run {
  id: string;
  platform: string;
  prompt_count: number;
  mention_count: number;
  mention_rate: number;
  run_date: string;
  metadata: any;
}

interface TopicDelta {
  topicId: string;
  topicName: string;
  rateA: number;
  rateB: number;
  delta: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TrendsViewProps {
  clientId: string;
  dateFrom?: string;
  dateTo?: string;
}

export function TrendsView({ clientId, dateFrom, dateTo }: TrendsViewProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');
  const [topicDeltas, setTopicDeltas] = useState<TopicDelta[]>([]);
  const [loadingDeltas, setLoadingDeltas] = useState(false);

  // Load runs from Supabase, scoped to the current client and optional
  // date range. The client_id filter fixes a multi-client mixing bug
  // where the previous query pulled every client's data together.
  useEffect(() => {
    async function load() {
      if (!supabaseAnon) {
        setError('Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
        setLoading(false);
        return;
      }

      try {
        let query = supabaseAnon
          .from('runs')
          .select('*')
          .eq('client_id', clientId)
          .not('run_date', 'is', null);
        if (dateFrom) query = query.gte('run_date', dateFrom);
        if (dateTo) query = query.lte('run_date', dateTo);

        const { data, error: err } = await query.order('run_date', { ascending: true });

        if (err) throw new Error(err.message);
        setRuns(data ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clientId, dateFrom, dateTo]);

  // Unique platforms with data
  const platforms = useMemo(() => {
    const set = new Set(runs.map((r) => r.platform));
    return Array.from(set);
  }, [runs]);

  // Filtered runs
  const filteredRuns = useMemo(() => {
    if (!selectedPlatform) return runs;
    return runs.filter((r) => r.platform === selectedPlatform);
  }, [runs, selectedPlatform]);

  // Time series data for chart
  const chartData = useMemo(() => {
    if (selectedPlatform) {
      return filteredRuns.map((r) => ({
        date: new Date(r.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        [selectedPlatform]: r.mention_rate,
      }));
    }

    // Multi-platform: group by date
    const byDate: Record<string, Record<string, number>> = {};
    for (const r of runs) {
      const dateKey = new Date(r.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!byDate[dateKey]) byDate[dateKey] = {};
      byDate[dateKey][r.platform] = r.mention_rate;
    }
    return Object.entries(byDate).map(([date, rates]) => ({ date, ...rates }));
  }, [runs, filteredRuns, selectedPlatform]);

  // Runs available for comparison (dropdown)
  const comparableRuns = useMemo(() => {
    return filteredRuns.filter((r) => r.prompt_count > 0);
  }, [filteredRuns]);

  // Load topic deltas when both compare runs selected
  useEffect(() => {
    if (!compareA || !compareB || !supabaseAnon) {
      setTopicDeltas([]);
      return;
    }

    async function loadDeltas() {
      setLoadingDeltas(true);
      try {
        const [resA, resB] = await Promise.all([
          supabaseAnon!.from('results').select('topic_id, topic_name, client_mentioned').eq('run_id', compareA),
          supabaseAnon!.from('results').select('topic_id, topic_name, client_mentioned').eq('run_id', compareB),
        ]);

        if (resA.error || resB.error) { setTopicDeltas([]); return; }

        const aggregate = (rows: any[]) => {
          const map: Record<string, { name: string; total: number; mentioned: number }> = {};
          for (const r of rows) {
            if (!map[r.topic_id]) map[r.topic_id] = { name: r.topic_name, total: 0, mentioned: 0 };
            map[r.topic_id].total++;
            if (r.client_mentioned) map[r.topic_id].mentioned++;
          }
          return map;
        };

        const mapA = aggregate(resA.data ?? []);
        const mapB = aggregate(resB.data ?? []);
        const allTopics = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);

        const deltas: TopicDelta[] = [];
        for (const tid of allTopics) {
          const a = mapA[tid];
          const b = mapB[tid];
          const rateA = a ? a.mentioned / a.total : 0;
          const rateB = b ? b.mentioned / b.total : 0;
          deltas.push({
            topicId: tid,
            topicName: a?.name ?? b?.name ?? tid,
            rateA,
            rateB,
            delta: rateB - rateA,
          });
        }

        setTopicDeltas(deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)));
      } catch {
        setTopicDeltas([]);
      } finally {
        setLoadingDeltas(false);
      }
    }

    loadDeltas();
  }, [compareA, compareB]);

  // ---------------------------------------------------------------------------
  // Empty / Error / Loading states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#9CA3AF]">
        <div className="animate-pulse">Loading trends data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-[#F59E0B] mb-3" />
        <p className="text-[#E5E7EB] font-medium mb-1">Supabase Connection Required</p>
        <p className="text-[#6B7280] text-sm max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  if (runs.length < 2) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-12 text-center">
        <TrendingUp className="mx-auto h-12 w-12 text-[#6B7280] mb-4" />
        <p className="text-[#E5E7EB] font-medium text-lg mb-2">Complete at least 2 runs to see trends</p>
        <p className="text-[#6B7280] text-sm max-w-lg mx-auto">
          Run batch scripts with <code className="text-[#00D4AA]">--client-id</code> and{' '}
          <code className="text-[#00D4AA]">--library-id</code> flags to save results to Supabase,
          or use the seed script to import existing data.
        </p>
        {runs.length === 1 && (
          <p className="text-[#9CA3AF] text-sm mt-4">
            1 run found ({runs[0].platform}). Need at least 1 more.
          </p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const runLabel = (r: Run) => {
    const d = new Date(r.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    return `${PLATFORM_LABELS[r.platform] ?? r.platform} — ${d} (${formatPercent(r.mention_rate)})`;
  };

  // Compute latest mention rate across all platforms
  const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
  const avgMentionRate = runs.length > 0
    ? runs.reduce((s, r) => s + r.mention_rate, 0) / runs.length
    : 0;

  // Delta summary stats
  const improved = topicDeltas.filter((d) => d.delta > 0).length;
  const declined = topicDeltas.filter((d) => d.delta < 0).length;
  const avgDelta = topicDeltas.length > 0
    ? topicDeltas.reduce((s, d) => s + d.delta, 0) / topicDeltas.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary stat pills */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-4 flex items-center gap-3">
          <div className="rounded-md bg-[#00D4AA]/10 p-2">
            <Activity className="h-4 w-4 text-[#00D4AA]" />
          </div>
          <div>
            <p className="text-xs text-[#6B7280] uppercase tracking-wider">Total Runs</p>
            <p className="text-lg font-semibold font-data text-[#E5E7EB]">{runs.length}</p>
          </div>
        </div>
        <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-4 flex items-center gap-3">
          <div className="rounded-md bg-[#3B82F6]/10 p-2">
            <TrendingUp className="h-4 w-4 text-[#3B82F6]" />
          </div>
          <div>
            <p className="text-xs text-[#6B7280] uppercase tracking-wider">Platforms Tracked</p>
            <p className="text-lg font-semibold font-data text-[#E5E7EB]">{platforms.length}</p>
          </div>
        </div>
        <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-4 flex items-center gap-3">
          <div className="rounded-md bg-[#8B5CF6]/10 p-2">
            <TrendingUp className="h-4 w-4 text-[#8B5CF6]" />
          </div>
          <div>
            <p className="text-xs text-[#6B7280] uppercase tracking-wider">Avg Mention Rate</p>
            <p className="text-lg font-semibold font-data text-[#E5E7EB]">{formatPercent(avgMentionRate)}</p>
          </div>
        </div>
      </div>

      {/* Platform filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedPlatform(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !selectedPlatform
              ? 'bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/40'
              : 'bg-[#1A1D27] text-[#9CA3AF] border border-[#2A2D37] hover:text-[#E5E7EB]'
          }`}
        >
          All Platforms
        </button>
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPlatform(p)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedPlatform === p
                ? 'border'
                : 'bg-[#1A1D27] text-[#9CA3AF] border border-[#2A2D37] hover:text-[#E5E7EB]'
            }`}
            style={
              selectedPlatform === p
                ? {
                    backgroundColor: `${PLATFORM_COLORS[p] ?? '#6B7280'}20`,
                    color: PLATFORM_COLORS[p] ?? '#6B7280',
                    borderColor: `${PLATFORM_COLORS[p] ?? '#6B7280'}60`,
                  }
                : undefined
            }
          >
            {PLATFORM_LABELS[p] ?? p}
          </button>
        ))}
      </div>

      {/* Mention rate over time */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-4">Mention Rate Over Time</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2D37" />
            <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 12 }} />
            <YAxis
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              tick={{ fill: '#6B7280', fontSize: 12 }}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D37', borderRadius: 8 }}
              labelStyle={{ color: '#E5E7EB' }}
              formatter={((value: any, name: any) => [
                value != null ? formatPercent(value) : '—',
                PLATFORM_LABELS[name] ?? name,
              ]) as any}
            />
            <Legend formatter={(value: string) => PLATFORM_LABELS[value] ?? value} />
            {(selectedPlatform ? [selectedPlatform] : platforms).map((p) => (
              <Line
                key={p}
                type="monotone"
                dataKey={p}
                stroke={PLATFORM_COLORS[p] ?? '#6B7280'}
                strokeWidth={2}
                dot={{ r: 4, fill: PLATFORM_COLORS[p] ?? '#6B7280' }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Run comparison */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <h3 className="font-heading text-lg font-semibold text-[#E5E7EB] mb-4">Compare Runs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-1.5">
              Run A (baseline)
            </label>
            <div className="relative">
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="w-full appearance-none rounded-lg border border-[#2A2D37] bg-[#0F1117] px-3 py-2.5 pr-8 text-sm text-[#E5E7EB] hover:border-[#363944] focus:border-[#00D4AA]/40 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="">Select a run...</option>
                {comparableRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {runLabel(r)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] uppercase tracking-wider mb-1.5">
              Run B (compare)
            </label>
            <div className="relative">
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="w-full appearance-none rounded-lg border border-[#2A2D37] bg-[#0F1117] px-3 py-2.5 pr-8 text-sm text-[#E5E7EB] hover:border-[#363944] focus:border-[#00D4AA]/40 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="">Select a run...</option>
                {comparableRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {runLabel(r)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Topic delta chart */}
        {loadingDeltas && (
          <div className="text-center text-[#6B7280] py-8 animate-pulse">Loading topic comparison...</div>
        )}

        {!loadingDeltas && topicDeltas.length > 0 && (
          <>
            {/* Delta summary callout */}
            <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-[#0F1117] border border-[#2A2D37]/60">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">{improved} improved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowDownRight className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-400">{declined} declined</span>
              </div>
              <div className="h-4 w-px bg-[#2A2D37]" />
              <span className="text-sm text-[#9CA3AF]">
                Avg change:{' '}
                <span className={avgDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {avgDelta >= 0 ? '+' : ''}{(avgDelta * 100).toFixed(1)}pt
                </span>
              </span>
            </div>

            <h4 className="text-sm text-[#9CA3AF] mb-3">
              Topic Mention Rate Change (Run A &rarr; Run B)
            </h4>
            <ResponsiveContainer width="100%" height={Math.max(300, topicDeltas.length * 28)}>
              <BarChart
                data={topicDeltas.slice(0, 20)}
                layout="vertical"
                margin={{ top: 5, right: 20, bottom: 5, left: 140 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2D37" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="topicName"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  width={130}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1D27', border: '1px solid #2A2D37', borderRadius: 8 }}
                  formatter={((value: any) => [value != null ? formatPercent(value) : '—', 'Delta']) as any}
                />
                <ReferenceLine x={0} stroke="#6B7280" />
                <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                  {topicDeltas.slice(0, 20).map((entry, i) => (
                    <Cell key={i} fill={entry.delta >= 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Summary table with zebra striping + hover */}
            <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-[#2A2D37]/40">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#1A1D27]">
                  <tr className="text-[#6B7280] border-b border-[#2A2D37]">
                    <th className="text-left py-2.5 px-3 text-xs font-medium uppercase tracking-wider">Topic</th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium uppercase tracking-wider">Run A</th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium uppercase tracking-wider">Run B</th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium uppercase tracking-wider">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {topicDeltas.map((t, i) => (
                    <tr
                      key={t.topicId}
                      className={`border-b border-[#2A2D37]/30 transition-colors hover:bg-[#22252F] ${
                        i % 2 === 0 ? 'bg-[#0F1117]/40' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-[#E5E7EB]">{t.topicName}</td>
                      <td className="py-2 px-3 text-right font-data text-[#9CA3AF]">{formatPercent(t.rateA)}</td>
                      <td className="py-2 px-3 text-right font-data text-[#9CA3AF]">{formatPercent(t.rateB)}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`inline-flex items-center gap-0.5 font-data font-medium ${t.delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {formatPercent(Math.abs(t.delta))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loadingDeltas && compareA && compareB && topicDeltas.length === 0 && (
          <p className="text-center text-[#6B7280] py-8">
            No results found for the selected runs. Make sure both runs have completed results in Supabase.
          </p>
        )}

        {!compareA && !compareB && (
          <p className="text-center text-[#6B7280] py-8">
            Select two runs above to compare topic-level mention rates.
          </p>
        )}
      </div>
    </div>
  );
}
