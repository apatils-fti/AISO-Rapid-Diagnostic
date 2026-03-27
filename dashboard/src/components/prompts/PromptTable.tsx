'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Check, X, ExternalLink } from 'lucide-react';
import { FilterBar, FilterDropdown, SearchInput, Badge, StatusBadge } from '@/components/shared';
import { PlatformIcon } from '@/components/shared';
import { promptLibrary, analyzedMetrics, rawResults, ISOTOPE_TYPES, ISOTOPE_LABELS, getTopicCategories } from '@/lib/fixtures';
import { cn, truncate } from '@/lib/utils';
import { getHeatmapTextClass } from '@/lib/colors';
import type { IsotopeType } from '@/lib/types';

interface PromptRowData {
  promptId: string;
  promptText: string;
  topicId: string;
  topicName: string;
  category: string;
  isotope: IsotopeType;
  cited: boolean;
  consistency: number;
  runs: number;
  runsWithCitation: number;
  citationCount: number;
  topCompetitor: string;
}

export function PromptTable() {
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [isotopeFilter, setIsotopeFilter] = useState('all');
  const [citedFilter, setCitedFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Build row data from fixtures
  const rowData: PromptRowData[] = useMemo(() => {
    const rows: PromptRowData[] = [];

    for (const topic of promptLibrary.topics) {
      const topicResult = analyzedMetrics.topicResults.find(t => t.topicId === topic.id);
      if (!topicResult) continue;

      for (const prompt of topic.prompts) {
        const isotopeResult = topicResult.isotopeResults[prompt.isotope as IsotopeType];

        // Find top competitor for this isotope
        const competitorCitations = isotopeResult.competitorCitations;
        const topCompetitor = Object.entries(competitorCitations)
          .sort(([, a], [, b]) => b - a)[0];

        rows.push({
          promptId: prompt.id,
          promptText: prompt.text,
          topicId: topic.id,
          topicName: topic.name,
          category: topic.category,
          isotope: prompt.isotope as IsotopeType,
          cited: isotopeResult.cited,
          consistency: isotopeResult.consistency,
          runs: isotopeResult.runs,
          runsWithCitation: isotopeResult.runsWithCitation,
          citationCount: isotopeResult.citationCount,
          topCompetitor: topCompetitor ? topCompetitor[0] : '-',
        });
      }
    }

    return rows;
  }, []);

  // Filter options
  const topicOptions = [
    { value: 'all', label: 'All Topics' },
    ...promptLibrary.topics.map(t => ({ value: t.id, label: t.name })),
  ];

  const isotopeOptions = [
    { value: 'all', label: 'All Isotopes' },
    ...ISOTOPE_TYPES.map(i => ({ value: i, label: ISOTOPE_LABELS[i] })),
  ];

  const citedOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'cited', label: 'Cited' },
    { value: 'not-cited', label: 'Not Cited' },
  ];

  // Apply filters
  const filteredRows = useMemo(() => {
    return rowData.filter(row => {
      const matchesSearch = row.promptText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.topicName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTopic = topicFilter === 'all' || row.topicId === topicFilter;
      const matchesIsotope = isotopeFilter === 'all' || row.isotope === isotopeFilter;
      const matchesCited = citedFilter === 'all' ||
        (citedFilter === 'cited' && row.cited) ||
        (citedFilter === 'not-cited' && !row.cited);

      return matchesSearch && matchesTopic && matchesIsotope && matchesCited;
    });
  }, [rowData, searchQuery, topicFilter, isotopeFilter, citedFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
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
                Cited
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                Consistency
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
                Top Competitor
              </th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2D37]">
            {filteredRows.map(row => (
              <PromptRow
                key={row.promptId}
                row={row}
                isExpanded={expandedRow === row.promptId}
                onToggle={() => setExpandedRow(expandedRow === row.promptId ? null : row.promptId)}
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
  isExpanded: boolean;
  onToggle: () => void;
}

function PromptRow({ row, isExpanded, onToggle }: PromptRowProps) {
  const rawResult = rawResults.results.find(r => r.promptId === row.promptId);

  return (
    <>
      <tr
        className="hover:bg-[#22252F] cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-[#E5E7EB]">{row.topicName}</div>
          <div className="text-xs text-[#6B7280]">{row.category}</div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm text-[#9CA3AF] max-w-md">
            {truncate(row.promptText, 80)}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <Badge variant="outline" size="sm">
            {ISOTOPE_LABELS[row.isotope]}
          </Badge>
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex justify-center">
            <PlatformIcon platform="perplexity" size="sm" />
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          {row.cited ? (
            <Check className="h-5 w-5 text-emerald-400 mx-auto" />
          ) : (
            <X className="h-5 w-5 text-red-400 mx-auto" />
          )}
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-16 h-1.5 bg-[#22252F] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.consistency * 100}%`,
                  backgroundColor: row.consistency === 0 ? '#EF4444' :
                    row.consistency < 0.67 ? '#F59E0B' : '#10B981',
                }}
              />
            </div>
            <span className={cn('text-sm', getHeatmapTextClass(row.consistency))}>
              {row.runsWithCitation}/{row.runs}
            </span>
          </div>
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
            <ExpandedPromptDetail row={row} rawResult={rawResult} />
          </td>
        </tr>
      )}
    </>
  );
}

interface ExpandedPromptDetailProps {
  row: PromptRowData;
  rawResult?: typeof rawResults.results[0];
}

function ExpandedPromptDetail({ row, rawResult }: ExpandedPromptDetailProps) {
  return (
    <div className="space-y-4">
      {/* Full prompt */}
      <div>
        <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-1">
          Full Prompt
        </div>
        <p className="text-sm text-[#E5E7EB] bg-[#1A1D27] rounded p-3">
          "{row.promptText}"
        </p>
      </div>

      {rawResult ? (
        <>
          {/* Response */}
          <div>
            <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-1">
              AI Response
            </div>
            <div className="text-sm text-[#9CA3AF] bg-[#1A1D27] rounded p-3 max-h-48 overflow-y-auto">
              {rawResult.response.text}
            </div>
          </div>

          {/* Citations */}
          <div>
            <div className="text-xs text-[#6B7280] uppercase tracking-wider mb-2">
              Citations ({rawResult.response.citations.length})
            </div>
            <div className="space-y-1">
              {rawResult.response.citations.map((url, i) => {
                const isClient = url.includes('techflow');
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 text-sm rounded px-2 py-1',
                      isClient ? 'bg-[#00D4AA]/10' : 'bg-[#1A1D27]'
                    )}
                  >
                    <span className={cn(
                      'font-mono text-xs',
                      isClient ? 'text-[#00D4AA]' : 'text-[#9CA3AF]'
                    )}>
                      [{i + 1}]
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'flex-1 truncate hover:underline',
                        isClient ? 'text-[#00D4AA]' : 'text-blue-400'
                      )}
                      onClick={e => e.stopPropagation()}
                    >
                      {url}
                    </a>
                    <ExternalLink className="h-3 w-3 text-[#6B7280]" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Analysis summary */}
          <div className="flex items-center gap-6 text-sm pt-2 border-t border-[#2A2D37]">
            <div>
              <span className="text-[#6B7280]">Client Cited: </span>
              <span className={rawResult.analysis.clientCited ? 'text-emerald-400' : 'text-red-400'}>
                {rawResult.analysis.clientCited ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280]">Mentioned in Text: </span>
              <span className={rawResult.analysis.clientMentionedInText ? 'text-emerald-400' : 'text-red-400'}>
                {rawResult.analysis.clientMentionedInText ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-[#6B7280]">Competitors Cited: </span>
              <span className="text-[#E5E7EB]">
                {rawResult.analysis.competitorsCited.join(', ') || 'None'}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-[#6B7280] italic">
          Detailed response data not available for this prompt.
        </div>
      )}
    </div>
  );
}
