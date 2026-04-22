/**
 * Google AI Overview Check Button
 *
 * Allows users to check Google AI Overview visibility for a specific prompt.
 * - Shows existing result if already checked
 * - "Check with Google AI" button to run new check
 * - Displays cited sources and client mention status
 * - Shows search credit counter
 */

'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { SerpApiService, type GoogleAIOverviewResult, type SerpApiBrandContext } from '@/lib/serpapi-service';
import { SERPAPI_CONFIG } from '@/lib/serpapi-config';
import { cn } from '@/lib/utils';

interface GoogleAIOverviewButtonProps {
  promptId: string;
  topicId: string;
  promptText: string;
  /** Used for client-mention detection in the AI overview response. Omitted
   * means "don't flag anything as a client cite" — acceptable when the
   * feature flag is off and nobody's looking at the results. */
  brandContext?: SerpApiBrandContext;
}

export function GoogleAIOverviewButton({
  promptId,
  topicId,
  promptText,
  brandContext,
}: GoogleAIOverviewButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GoogleAIOverviewResult | null>(null);
  const [searchesUsed, setSearchesUsed] = useState(0);

  // Load existing result and search count on mount
  useEffect(() => {
    const existingResult = SerpApiService.getResult(promptId);
    if (existingResult) {
      setResult(existingResult);
    }
    setSearchesUsed(SerpApiService.getSearchesUsed());
  }, [promptId]);

  const handleCheck = async () => {
    setError(null);
    setLoading(true);

    try {
      const checkResult = await SerpApiService.checkAIOverview(promptText, promptId, topicId, brandContext);
      setResult(checkResult);
      setSearchesUsed(SerpApiService.getSearchesUsed());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[GoogleAIOverviewButton] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const remaining = SerpApiService.getRemainingSearches();
  const isLimitReached = remaining === 0;

  return (
    <div className="mt-6 rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-[#E5E7EB] flex items-center gap-2">
          <Search className="h-4 w-4 text-[#4285F4]" />
          Google AI Overview Check
        </h4>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded',
              remaining < 50
                ? 'bg-[#EF4444]/10 text-[#EF4444]'
                : 'bg-[#4285F4]/10 text-[#4285F4]'
            )}
          >
            {searchesUsed} / {SERPAPI_CONFIG.MAX_SEARCHES} searches used
          </span>
        </div>
      </div>

      {!result && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#6B7280]">
            Check if this prompt triggers a Google AI Overview
          </p>
          <button
            onClick={handleCheck}
            disabled={loading || isLimitReached}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              loading || isLimitReached
                ? 'bg-[#22252F] text-[#6B7280] cursor-not-allowed'
                : 'bg-[#4285F4] text-white hover:bg-[#3B78E7]'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : isLimitReached ? (
              'Limit Reached'
            ) : (
              <>
                <Search className="h-4 w-4" />
                Check with Google AI
              </>
            )}
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {result.hasOverview ? (
              <CheckCircle className="h-5 w-5 text-[#10B981]" />
            ) : (
              <XCircle className="h-5 w-5 text-[#6B7280]" />
            )}
            <span className="text-sm font-medium text-[#E5E7EB]">
              {result.hasOverview
                ? 'AI Overview Found'
                : 'No AI Overview for this query'}
            </span>
          </div>

          {result.hasOverview && (
            <>
              {/* Client Mention Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#6B7280]">Client Mentioned:</span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    result.clientMentioned ? 'text-[#00D4AA]' : 'text-[#EF4444]'
                  )}
                >
                  {result.clientMentioned ? 'Yes' : 'No'}
                </span>
              </div>

              {/* Cited Sources */}
              {result.citedSources.length > 0 && (
                <div>
                  <span className="text-sm text-[#6B7280] mb-2 block">
                    Cited Sources ({result.citedSources.length}):
                  </span>
                  <div className="space-y-1">
                    {result.citedSources.map((url, i) => {
                      const lowerUrl = url.toLowerCase();
                      const isClient = (brandContext?.clientDomains ?? []).some((d) =>
                        lowerUrl.includes(d.toLowerCase())
                      );
                      return (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center gap-2 text-xs px-2 py-1 rounded',
                            isClient
                              ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/20'
                              : 'bg-[#22252F]'
                          )}
                        >
                          <span
                            className={cn(
                              'font-mono',
                              isClient ? 'text-[#00D4AA]' : 'text-[#6B7280]'
                            )}
                          >
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
                            title={url}
                          >
                            {url}
                          </a>
                          <ExternalLink className="h-3 w-3 text-[#6B7280] flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Overview Text Preview */}
              {result.overviewText && (
                <div>
                  <span className="text-sm text-[#6B7280] mb-1 block">Overview Text:</span>
                  <p className="text-xs text-[#9CA3AF] bg-[#22252F] p-2 rounded border border-[#2A2D37] line-clamp-3">
                    {result.overviewText}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Timestamp */}
          <div className="text-xs text-[#6B7280] pt-2 border-t border-[#2A2D37]">
            Checked at {new Date(result.timestamp).toLocaleString()}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-md bg-[#EF4444]/10 border border-[#EF4444]/20">
          <p className="text-sm text-[#EF4444]">{error}</p>
        </div>
      )}
    </div>
  );
}
