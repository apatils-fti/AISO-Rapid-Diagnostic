/**
 * Fara Comparison View
 *
 * Shows side-by-side comparison:
 * - Left: API citations (from rawResults.json)
 * - Right: UI citations (from Fara screenshot analysis)
 * - Highlights discrepancies between what API returns vs what users actually see
 *
 * Color coding:
 * - Green checkmark: URL appears in both API and UI
 * - Red X: URL in API but NOT visible in UI (false positive)
 * - Orange warning: URL visible in UI but NOT in API (missing from API data)
 */

'use client';

import { Check, X, AlertTriangle } from 'lucide-react';
import type { FaraVisualCheckResult } from '@/lib/fara-service';
import { cn } from '@/lib/utils';

interface FaraComparisonViewProps {
  apiCitations: string[];
  uiCitations: string[];
  brandMentions: FaraVisualCheckResult['brandMentions'];
}

export function FaraComparisonView({ apiCitations, uiCitations, brandMentions }: FaraComparisonViewProps) {
  // Find URLs in API but not UI (false positives - API says cited but not visible)
  const apiOnly = apiCitations.filter(url => !uiCitations.includes(url));

  // Find URLs in UI but not API (missing from API - visible but not reported)
  const uiOnly = uiCitations.filter(url => !apiCitations.includes(url));

  // Find URLs in both (accurate matches)
  const inBoth = apiCitations.filter(url => uiCitations.includes(url));

  const hasDiscrepancies = apiOnly.length > 0 || uiOnly.length > 0;

  return (
    <div>
      <h3 className="text-sm font-medium text-[#E5E7EB] mb-3 flex items-center gap-2">
        API vs UI Comparison
        {hasDiscrepancies && (
          <span className="flex items-center gap-1 text-xs text-[#F59E0B]">
            <AlertTriangle className="h-3 w-3" />
            {apiOnly.length + uiOnly.length} discrepanc{apiOnly.length + uiOnly.length === 1 ? 'y' : 'ies'} found
          </span>
        )}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: API Citations */}
        <div className="rounded-lg border border-[#2A2D37] overflow-hidden">
          <div className="px-3 py-2 bg-[#22252F] border-b border-[#2A2D37]">
            <span className="text-xs font-medium text-[#9CA3AF]">
              API Citations ({apiCitations.length})
            </span>
            <p className="text-xs text-[#6B7280] mt-0.5">
              What the API returned
            </p>
          </div>
          <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
            {apiCitations.length > 0 ? (
              apiCitations.map((url, i) => {
                const inUI = uiCitations.includes(url);
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 text-xs px-2 py-1.5 rounded',
                      inUI ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'
                    )}
                  >
                    {inUI ? (
                      <Check className="h-3 w-3 text-[#10B981] flex-shrink-0" />
                    ) : (
                      <X className="h-3 w-3 text-[#EF4444] flex-shrink-0" />
                    )}
                    <span className="truncate text-[#9CA3AF]" title={url}>
                      {url}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[#6B7280] italic py-2">No API citations</p>
            )}
          </div>
        </div>

        {/* Right: UI Citations */}
        <div className="rounded-lg border border-[#2A2D37] overflow-hidden">
          <div className="px-3 py-2 bg-[#22252F] border-b border-[#2A2D37]">
            <span className="text-xs font-medium text-[#9CA3AF]">
              UI Citations ({uiCitations.length})
            </span>
            <p className="text-xs text-[#6B7280] mt-0.5">
              What users actually see
            </p>
          </div>
          <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
            {uiCitations.length > 0 ? (
              uiCitations.map((url, i) => {
                const inAPI = apiCitations.includes(url);
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 text-xs px-2 py-1.5 rounded',
                      inAPI ? 'bg-[#10B981]/10' : 'bg-[#F59E0B]/10'
                    )}
                  >
                    {inAPI ? (
                      <Check className="h-3 w-3 text-[#10B981] flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-[#F59E0B] flex-shrink-0" />
                    )}
                    <span className="truncate text-[#9CA3AF]" title={url}>
                      {url}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[#6B7280] italic py-2">No UI citations detected</p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="text-[#10B981]">
            <Check className="h-3 w-3 inline mr-1" />
            {inBoth.length} in both
          </span>
          <span className="text-[#EF4444]">
            <X className="h-3 w-3 inline mr-1" />
            {apiOnly.length} API only
          </span>
          <span className="text-[#F59E0B]">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            {uiOnly.length} UI only
          </span>
        </div>

        {hasDiscrepancies && (
          <span className="text-[#6B7280] italic">
            API ≠ UI: Users see different results than API reports
          </span>
        )}
      </div>

      {/* Explanation of discrepancies */}
      {hasDiscrepancies && (
        <div className="mt-3 p-3 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/20">
          <p className="text-xs text-[#F59E0B] font-medium mb-1">
            Why discrepancies matter:
          </p>
          <ul className="text-xs text-[#F59E0B]/80 space-y-1">
            {apiOnly.length > 0 && (
              <li>
                • {apiOnly.length} URL{apiOnly.length === 1 ? '' : 's'} in API but not visible in UI (may be in collapsed sections or not rendered)
              </li>
            )}
            {uiOnly.length > 0 && (
              <li>
                • {uiOnly.length} URL{uiOnly.length === 1 ? '' : 's'} visible in UI but not reported by API (featured snippets, image results, or UI-only elements)
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
