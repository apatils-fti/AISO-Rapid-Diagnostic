'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Link2, MessageSquare, Sparkles, Bot, Gem, Search } from 'lucide-react';
import { FaraVisualCheckButton } from './FaraVisualCheckButton';
import { GoogleAIOverviewButton } from './GoogleAIOverviewButton';
import { FARA_CONFIG } from '@/lib/fara-config';
import { SERPAPI_CONFIG } from '@/lib/serpapi-config';
import { FilterBar, FilterDropdown, SearchInput, Badge } from '@/components/shared';
import {
  getPromptResponses,
  getAllResponsesForPlatform,
  getAllPlatformStats,
  getPlatformMeta,
  getPlatformKeys,
  type PromptResponse,
  type PlatformStats,
} from '@/lib/platform-data';
import { cn, truncate } from '@/lib/utils';
import { getHeatmapTextClass } from '@/lib/colors';
import { ISOTOPE_TYPES, ISOTOPE_LABELS } from '@/lib/taxonomy';
import type { IsotopeType } from '@/lib/types';
import type { PromptResultRow } from '@/lib/db';

export type PromptTableMode = 'citations' | 'mentions';

interface PromptRowData {
  promptId: string;
  promptText: string;
  topicId: string;
  topicName: string;
  isotope: IsotopeType;
  runs: number;
  runsWithCitation: number;
  runsWithMention: number;
  citationCount: number;
  topCompetitor: string;
  mentionRate: number;
  consistency: number;
}

const PLATFORM_PILL_ICONS: Record<string, typeof Sparkles> = {
  perplexity: Sparkles,
  chatgpt_search: Bot,
  gemini: Gem,
  claude: Bot,
  google_ai_overview: Search,
};

interface PromptTableProps {
  serverData?: PromptResultRow[];
  clientName?: string;
  /** Used by the Google AI Overview feature for client citation detection.
   * Wired through from prompts/page.tsx via clients.config.clientDomains. */
  clientDomains?: string[];
}

export function PromptTable({ serverData, clientName, clientDomains }: PromptTableProps) {
  const [mode, setMode] = useState<PromptTableMode>('mentions');
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [isotopeFilter, setIsotopeFilter] = useState('all');
  const [citedFilter, setCitedFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('perplexity');
  const [platformResponseMap, setPlatformResponseMap] = useState<Record<string, PromptResponse>>({});
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);

  // Load platform stats and default to platform with most data
  useEffect(() => {
    getAllPlatformStats().then((stats) => {
      setPlatformStats(stats);
      const best = stats
        .filter((s) => s.available)
        .sort((a, b) => b.totalPrompts - a.totalPrompts)[0];
      if (best) setSelectedPlatform(best.platform);
    });
  }, []);

  // Load all responses for selected platform
  useEffect(() => {
    getAllResponsesForPlatform(selectedPlatform).then(setPlatformResponseMap);
  }, [selectedPlatform]);

  // Build row data from server-fetched Supabase results.
  const rowData: PromptRowData[] = useMemo(() => {
    if (!serverData) return [];

    return serverData.map((row) => {
      const results = row.results;
      const runs = results.length;
      const runsWithCitation = results.filter((r) => r.citations && r.citations.length > 0).length;
      const runsWithMention = results.filter((r) => r.clientMentioned).length;
      const citationCount = results.reduce((sum, r) => sum + (r.citations?.length ?? 0), 0);

      // Top competitor = whichever competitor accumulates the most mentions
      // across all platforms for this prompt (source: results.competitor_mentions
      // JSONB, populated by scripts/enrich-competitor-mentions.js).
      const competitorTotals = new Map<string, number>();
      for (const r of results) {
        for (const [name, count] of Object.entries(r.competitorMentions ?? {})) {
          competitorTotals.set(name, (competitorTotals.get(name) ?? 0) + (count ?? 0));
        }
      }
      const topComp = [...competitorTotals.entries()].sort((a, b) => b[1] - a[1])[0];

      return {
        promptId: row.promptId,
        promptText: row.promptText || `(prompt text unavailable: ${row.promptId})`,
        topicId: row.topicId,
        topicName: row.topicName,
        isotope: (row.isotope || 'informational') as IsotopeType,
        runs,
        runsWithCitation,
        runsWithMention,
        citationCount,
        topCompetitor: topComp ? topComp[0] : '—',
        mentionRate: runs > 0 ? runsWithMention / runs : 0,
        consistency: runs > 0 ? runsWithCitation / runs : 0,
      };
    });
  }, [serverData]);

  // Filter options derived from the data that's actually loaded
  const topicOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rowData) {
      if (row.topicId && !seen.has(row.topicId)) seen.set(row.topicId, row.topicName);
    }
    return [
      { value: 'all', label: 'All Topics' },
      ...[...seen.entries()].map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [rowData]);

  const isotopeOptions = [
    { value: 'all', label: 'All Isotopes' },
    ...ISOTOPE_TYPES.map((i) => ({ value: i, label: ISOTOPE_LABELS[i] })),
  ];

  const citedOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'cited', label: 'Has citations' },
    { value: 'not-cited', label: 'No citations' },
  ];

  // Apply filters
  const filteredRows = useMemo(() => {
    return rowData.filter((row) => {
      const matchesSearch =
        row.promptText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.topicName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTopic = topicFilter === 'all' || row.topicId === topicFilter;
      const matchesIsotope = isotopeFilter === 'all' || row.isotope === isotopeFilter;
      const matchesCited =
        citedFilter === 'all' ||
        (citedFilter === 'cited' && row.runsWithCitation > 0) ||
        (citedFilter === 'not-cited' && row.runsWithCitation === 0);

      return matchesSearch && matchesTopic && matchesIsotope && matchesCited;
    });
  }, [rowData, searchQuery, topicFilter, isotopeFilter, citedFilter]);

  if (!serverData || serverData.length === 0) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] py-12 text-center">
        <p className="text-lg text-[#9CA3AF]">No prompt results found.</p>
        <p className="mt-2 text-sm text-[#6B7280]">
          Run batch collection for this client, then check back.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Platform Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#6B7280] mr-1">Platform:</span>
        {getPlatformKeys().map((platform) => {
          const meta = getPlatformMeta(platform);
          const Icon = PLATFORM_PILL_ICONS[platform] ?? Bot;
          const isActive = platform === selectedPlatform;
          const stats = platformStats.find((s) => s.platform === platform);
          const hasData = stats?.available ?? false;

          return (
            <button
              key={platform}
              onClick={() => hasData && setSelectedPlatform(platform)}
              disabled={!hasData}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                isActive
                  ? 'border-current'
                  : hasData
                  ? 'border-[#2A2D37] bg-transparent text-[#6B7280] hover:text-[#9CA3AF]'
                  : 'border-[#2A2D37] bg-transparent text-[#3A3D47] cursor-not-allowed'
              )}
              style={
                isActive
                  ? { color: meta.color, borderColor: meta.color, backgroundColor: `${meta.color}15` }
                  : undefined
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.displayName}
              {stats && hasData && (
                <span className="text-[10px] opacity-60 ml-0.5">
                  ({stats.totalPrompts})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mode Toggle and Filters */}
      <div className="flex items-center justify-between gap-4">
        <FilterBar>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search prompts..."
            className="w-64"
          />
          <FilterDropdown
            label="Topic"
            options={topicOptions}
            value={topicFilter}
            onChange={setTopicFilter}
          />
          <FilterDropdown
            label="Isotope"
            options={isotopeOptions}
            value={isotopeFilter}
            onChange={setIsotopeFilter}
          />
          <FilterDropdown
            label="Status"
            options={citedOptions}
            value={citedFilter}
            onChange={setCitedFilter}
          />
          <div className="ml-auto text-sm text-[#6B7280]">
            {filteredRows.length} of {rowData.length} prompts
          </div>
        </FilterBar>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-1">
          <button
            onClick={() => setMode('citations')}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
              mode === 'citations'
                ? 'bg-[#00D4AA]/10 text-[#00D4AA]'
                : 'text-[#9CA3AF] hover:text-[#E5E7EB]'
            )}
          >
            <Link2 className="h-4 w-4" />
            Citations
          </button>
          <button
            onClick={() => setMode('mentions')}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
              mode === 'mentions'
                ? 'bg-[#00D4AA]/10 text-[#00D4AA]'
                : 'text-[#9CA3AF] hover:text-[#E5E7EB]'
            )}
          >
            <MessageSquare className="h-4 w-4" />
            Mentions
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2A2D37] bg-[#22252F]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                Topic
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                Prompt
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                Isotope
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                Platform
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                {mode === 'citations' ? 'Cited' : 'Mentioned'}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                {mode === 'citations' ? 'Consistency' : 'Mention Rate'}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                Top Competitor
              </th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2D37]">
            {filteredRows.map((row) => (
              <PromptRow
                key={row.promptId}
                row={row}
                mode={mode}
                isExpanded={expandedRow === row.promptId}
                onToggle={() => setExpandedRow(expandedRow === row.promptId ? null : row.promptId)}
                selectedPlatform={selectedPlatform}
                platformResponse={platformResponseMap[row.promptId]}
                clientName={clientName}
                clientDomains={clientDomains}
              />
            ))}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="py-12 text-center text-[#6B7280]">
            No prompts found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}

interface PromptRowProps {
  row: PromptRowData;
  mode: PromptTableMode;
  isExpanded: boolean;
  onToggle: () => void;
  selectedPlatform: string;
  platformResponse?: PromptResponse;
  clientName?: string;
  clientDomains?: string[];
}

function PromptRow({ row, mode, isExpanded, onToggle, selectedPlatform, platformResponse, clientName, clientDomains }: PromptRowProps) {
  // Use selected-platform data if available, otherwise fall back to the
  // prompt-level aggregate so the row still renders useful info.
  const hasPlatformData = !!platformResponse;
  const displayCited = hasPlatformData
    ? (mode === 'citations' ? platformResponse.clientCited : platformResponse.clientMentioned)
    : (mode === 'citations' ? row.runsWithCitation > 0 : row.runsWithMention > 0);
  const displayValue = hasPlatformData
    ? (mode === 'citations' ? (platformResponse.clientCited ? 1 : 0) : (platformResponse.clientMentioned ? 1 : 0))
    : (mode === 'citations' ? row.consistency : row.mentionRate);

  return (
    <>
      <tr
        className="hover:bg-[#22252F] cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-[#E5E7EB]">{row.topicName || '—'}</div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm text-[#9CA3AF] max-w-md">
            {truncate(row.promptText, 80)}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <Badge variant="outline" size="sm">
            {ISOTOPE_LABELS[row.isotope] ?? row.isotope}
          </Badge>
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex justify-center">
            {hasPlatformData ? (
              (() => {
                const meta = getPlatformMeta(selectedPlatform);
                const Icon = PLATFORM_PILL_ICONS[selectedPlatform] ?? Bot;
                return (
                  <span className="flex items-center gap-1 text-xs" style={{ color: meta.color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                );
              })()
            ) : (
              <span className="text-xs text-[#4A4D57]">—</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          {!hasPlatformData ? (
            <span className="text-xs text-[#4A4D57]">—</span>
          ) : displayCited ? (
            <Check className="h-5 w-5 text-emerald-400 mx-auto" />
          ) : (
            <X className="h-5 w-5 text-red-400 mx-auto" />
          )}
        </td>
        <td className="px-4 py-3 text-center">
          {!hasPlatformData ? (
            <span className="text-xs text-[#4A4D57]">—</span>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <div className="w-16 h-1.5 bg-[#22252F] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${displayValue * 100}%`,
                    backgroundColor:
                      displayValue === 0
                        ? '#EF4444'
                        : displayValue < 0.33
                        ? '#F59E0B'
                        : '#10B981',
                  }}
                />
              </div>
              <span className={cn('text-sm', getHeatmapTextClass(displayValue))}>
                {displayValue > 0 ? 'Yes' : 'No'}
              </span>
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-center text-sm text-[#9CA3AF]">
          {row.topCompetitor}
        </td>
        <td className="px-4 py-3">
          <ChevronDown
            className={cn(
              'h-5 w-5 text-[#6B7280] transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="bg-[#22252F] px-4 py-4">
            <ExpandedPromptDetail row={row} clientName={clientName} clientDomains={clientDomains} />
          </td>
        </tr>
      )}
    </>
  );
}

const PLATFORM_ORDER = ['perplexity', 'chatgpt_search', 'gemini', 'claude', 'google_ai_overview'] as const;

const PLATFORM_ICONS: Record<string, typeof Sparkles> = {
  perplexity: Sparkles,
  chatgpt_search: Bot,
  gemini: Gem,
  claude: Bot,
  google_ai_overview: Search,
};

interface ExpandedPromptDetailProps {
  row: PromptRowData;
  clientName?: string;
  clientDomains?: string[];
}

function ExpandedPromptDetail({ row, clientName, clientDomains }: ExpandedPromptDetailProps) {
  const [responses, setResponses] = useState<PromptResponse[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Load all platform responses for this prompt
  useEffect(() => {
    let cancelled = false;

    getPromptResponses(row.promptId).then((data) => {
      if (cancelled) return;
      setResponses(data);

      // Default to first platform that has data
      const first = PLATFORM_ORDER.find((p) => data.some((r) => r.platform === p));
      if (first) setSelectedPlatform(first);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [row.promptId]);

  const currentResponse = responses.find((r) => r.platform === selectedPlatform);
  const platformsWithData = new Set(responses.map((r) => r.platform));

  return (
    <div className="space-y-4">
      {/* Full prompt */}
      <div>
        <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-1">
          Full Prompt
        </div>
        <p className="text-sm text-[#E5E7EB] bg-[#1A1D27] rounded p-3">
          &ldquo;{row.promptText}&rdquo;
        </p>
      </div>

      {/* Platform tabs */}
      <div>
        <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-2">
          AI Responses — {platformsWithData.size} of {PLATFORM_ORDER.length} platforms
        </div>

        <div className="flex border-b border-[#2A2D37]">
          {PLATFORM_ORDER.map((platform) => {
            const meta = getPlatformMeta(platform);
            const Icon = PLATFORM_ICONS[platform] ?? Bot;
            const hasData = platformsWithData.has(platform);
            const isSelected = platform === selectedPlatform;

            return (
              <button
                key={platform}
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasData) setSelectedPlatform(platform);
                }}
                disabled={!hasData}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                  isSelected
                    ? 'border-current'
                    : hasData
                    ? 'border-transparent text-[#6B7280] hover:text-[#9CA3AF]'
                    : 'border-transparent text-[#3A3D47] cursor-not-allowed'
                )}
                style={isSelected ? { borderColor: meta.color, color: meta.color } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.displayName}
                {hasData ? (
                  <span className={cn(
                    'ml-1 h-1.5 w-1.5 rounded-full',
                    isSelected ? 'bg-current' : 'bg-[#6B7280]'
                  )} />
                ) : (
                  <span className="ml-1 text-[10px]">—</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Response content */}
        {loading ? (
          <div className="text-sm text-[#6B7280] py-6 text-center bg-[#1A1D27] rounded-b">
            Loading responses...
          </div>
        ) : currentResponse ? (
          <div className="bg-[#1A1D27] rounded-b">
            {/* Metadata bar */}
            <div className="flex items-center gap-3 px-3 py-2 border-b border-[#2A2D37] text-xs text-[#6B7280]">
              {currentResponse.clientMentioned ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Check className="h-3 w-3" /> Brand Mentioned
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400">
                  <X className="h-3 w-3" /> Not Mentioned
                </span>
              )}
              {currentResponse.competitorsMentioned.length > 0 && (
                <span>Competitors: {currentResponse.competitorsMentioned.join(', ')}</span>
              )}
              {currentResponse.citations.length > 0 && (
                <span>{currentResponse.citations.length} citations</span>
              )}
            </div>

            {/* Response text with brand highlighting */}
            <div className="p-3 max-h-64 overflow-y-auto">
              <div className="text-sm text-[#C9CDD5] whitespace-pre-wrap leading-relaxed">
                {highlightBrand(currentResponse.responseText, clientName)}
              </div>
            </div>

            {/* Citations (if any) */}
            {currentResponse.citations.length > 0 && (
              <div className="px-3 pb-3 border-t border-[#2A2D37] pt-2">
                <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-1">
                  Citations ({currentResponse.citations.length})
                </div>
                <div className="space-y-1">
                  {currentResponse.citations.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-[#9CA3AF]">[{i + 1}]</span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:underline text-blue-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {url}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : selectedPlatform ? (
          <div className="text-sm text-[#6B7280] py-6 text-center bg-[#1A1D27] rounded-b italic">
            No response collected for {getPlatformMeta(selectedPlatform).displayName} on this prompt.
          </div>
        ) : (
          <div className="text-sm text-[#6B7280] py-6 text-center bg-[#1A1D27] rounded-b italic">
            No AI responses collected for this prompt.
          </div>
        )}
      </div>

      {/* Fara Visual Check - Feature Flagged */}
      {FARA_CONFIG.ENABLED && (
        <FaraVisualCheckButton
          promptId={row.promptId}
          promptText={row.promptText}
          platformResult={undefined}
        />
      )}

      {/* Google AI Overview Check - Feature Flagged */}
      {SERPAPI_CONFIG.ENABLED && (
        <GoogleAIOverviewButton
          promptId={row.promptId}
          topicId={row.topicId}
          promptText={row.promptText}
          brandContext={
            clientName
              ? { brandName: clientName, clientDomains: clientDomains ?? [] }
              : undefined
          }
        />
      )}
    </div>
  );
}

// Highlight each occurrence of the current client's brand name. Case-
// insensitive; falls back to returning the raw text when clientName is empty
// (e.g. during the short window before Supabase config loads).
function highlightBrand(text: string, clientName?: string): React.ReactNode {
  if (!text) return null;
  if (!clientName) return text;

  // Escape regex special chars in the brand name so "Digital.ai" matches
  // literally instead of treating "." as "any character."
  const escaped = clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(pattern);

  return parts.map((part, idx) =>
    pattern.test(part) ? (
      <span key={idx} className="text-[#00D4AA] font-medium bg-[#00D4AA]/10 px-0.5 rounded">
        {part}
      </span>
    ) : (
      part
    )
  );
}
