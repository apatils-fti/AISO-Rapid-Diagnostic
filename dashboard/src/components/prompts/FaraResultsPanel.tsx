/**
 * Fara Results Panel
 *
 * Displays visual check results in a full-screen overlay.
 * Shows:
 * - Screenshot of actual Perplexity UI (when available)
 * - List of URLs cited in UI (extracted by Fara)
 * - Brand mentions and positioning
 * - Comparison: API citations vs UI citations
 * - Raw Fara analysis (collapsible, for debugging)
 */

'use client';

import { X, ExternalLink } from 'lucide-react';
import { FaraComparisonView } from './FaraComparisonView';
import type { FaraVisualCheckResult } from '@/lib/fara-service';
import type { RawResult } from '@/lib/types';
import { cn } from '@/lib/utils';

interface FaraResultsPanelProps {
  result: FaraVisualCheckResult;
  apiResult?: RawResult; // For API vs UI comparison
  onClose: () => void;
}

export function FaraResultsPanel({ result, apiResult, onClose }: FaraResultsPanelProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1A1D27] rounded-lg border border-[#2A2D37] max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2A2D37]">
          <div>
            <h2 className="text-lg font-semibold text-[#E5E7EB]">Visual Check Results</h2>
            <p className="text-xs text-[#6B7280] mt-1">
              Screenshot captured at {new Date(result.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-[#22252F] transition-colors"
          >
            <X className="h-5 w-5 text-[#9CA3AF]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Screenshot */}
          {result.screenshot && (
            <div>
              <h3 className="text-sm font-medium text-[#E5E7EB] mb-2">
                Actual Perplexity UI
              </h3>
              <div className="rounded-lg border border-[#2A2D37] overflow-hidden">
                <img
                  src={`data:image/png;base64,${result.screenshot}`}
                  alt="Perplexity screenshot"
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Cited URLs from UI */}
          <div>
            <h3 className="text-sm font-medium text-[#E5E7EB] mb-2">
              URLs Cited in UI ({result.citedUrls.length})
            </h3>
            {result.citedUrls.length > 0 ? (
              <div className="space-y-1">
                {result.citedUrls.map((url, i) => {
                  const isClient = url.includes('jcrew.com') || url.includes('j-crew');
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded',
                        isClient
                          ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/20'
                          : 'bg-[#22252F]'
                      )}
                    >
                      <span
                        className={cn(
                          'font-mono text-xs',
                          isClient ? 'text-[#00D4AA]' : 'text-[#9CA3AF]'
                        )}
                      >
                        [{i + 1}]
                      </span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'flex-1 text-sm truncate hover:underline',
                          isClient ? 'text-[#00D4AA]' : 'text-blue-400'
                        )}
                      >
                        {url}
                      </a>
                      <ExternalLink className="h-3 w-3 text-[#6B7280] flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[#6B7280] italic">No URLs detected in UI</p>
            )}
          </div>

          {/* Brand Mentions */}
          {result.brandMentions.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[#E5E7EB] mb-2">
                Brand Mentions Detected
              </h3>
              <div className="space-y-2">
                {result.brandMentions.map((mention, i) => {
                  const isClient = mention.brand.toLowerCase().includes('j.crew') ||
                                  mention.brand.toLowerCase().includes('jcrew');
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded',
                        isClient ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/20' : 'bg-[#22252F]'
                      )}
                    >
                      <span className={cn(
                        'text-sm font-medium',
                        isClient ? 'text-[#00D4AA]' : 'text-[#E5E7EB]'
                      )}>
                        {mention.brand}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#6B7280]">
                          Position #{mention.position}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded',
                            mention.prominence === 'high'
                              ? 'bg-[#10B981]/10 text-[#10B981]'
                              : mention.prominence === 'medium'
                              ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                              : 'bg-[#6B7280]/10 text-[#6B7280]'
                          )}
                        >
                          {mention.prominence}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* API vs UI Comparison */}
          {apiResult && (
            <FaraComparisonView
              apiCitations={apiResult.response.citations}
              uiCitations={result.citedUrls}
              brandMentions={result.brandMentions}
            />
          )}

          {/* Raw Fara Analysis (collapsible) */}
          {result.rawAnalysis && (
            <details className="rounded border border-[#2A2D37] overflow-hidden">
              <summary className="px-3 py-2 bg-[#22252F] cursor-pointer text-sm text-[#9CA3AF] hover:text-[#E5E7EB] transition-colors">
                Raw Fara Analysis (for debugging)
              </summary>
              <div className="p-3 text-xs text-[#6B7280] font-mono whitespace-pre-wrap bg-[#0F1117] max-h-96 overflow-y-auto">
                {result.rawAnalysis}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
