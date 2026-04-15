/**
 * Fara Visual Check Button
 *
 * Triggers Fara-7B screenshot + analysis of Perplexity search result.
 * Shows:
 * - Camera icon button
 * - Remaining quota (X/5)
 * - Countdown timer when rate-limited
 * - Loading spinner during execution (up to 45s)
 * - Error messages with actionable guidance
 */

'use client';

import { useState, useEffect } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { FaraService, type FaraVisualCheckResult } from '@/lib/fara-service';
import { FaraResultsPanel } from './FaraResultsPanel';
import type { RawResult } from '@/lib/types';

interface FaraVisualCheckButtonProps {
  promptId: string;
  promptText: string;
  platformResult?: RawResult; // Optional - for API vs UI comparison
}

export function FaraVisualCheckButton({ promptId, promptText, platformResult }: FaraVisualCheckButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FaraVisualCheckResult | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for rate limiting
  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = FaraService.getSecondsUntilNextQuery();
      setCountdown(seconds);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = async () => {
    setError(null);
    setLoading(true);

    try {
      // Health check first
      const healthy = await FaraService.checkHealth();
      if (!healthy) {
        setError('Ollama is not running. Start it with: ollama serve');
        setLoading(false);
        return;
      }

      // Build Perplexity search URL from prompt
      const searchUrl = buildPerplexityUrl(promptText);

      // Run visual check
      const checkResult = await FaraService.runVisualCheck({
        promptText,
        searchUrl,
      });

      if (checkResult.success) {
        setResult(checkResult);
      } else {
        setError(checkResult.error || 'Visual check failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const remaining = FaraService.getRemainingQueries();
  const canQuery = remaining > 0 && countdown === 0 && !loading;

  return (
    <>
      <div className="mt-4 pt-4 border-t border-[#2A2D37]">
        <div className="flex items-center justify-between">
          <div className="text-xs text-[#6B7280] uppercase tracking-wider">
            Visual Check (Fara-7B)
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#9CA3AF]">
              {remaining}/5 remaining
              {countdown > 0 && ` • Wait ${countdown}s`}
            </span>

            <button
              onClick={handleClick}
              disabled={!canQuery}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#00D4AA]/10 text-[#00D4AA] hover:bg-[#00D4AA]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  <span>Visual Check</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <p className="font-medium mb-1">Error</p>
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {loading && (
          <div className="mt-3 p-3 rounded-md bg-[#00D4AA]/10 border border-[#00D4AA]/20 text-sm text-[#00D4AA]">
            <p className="font-medium mb-1">Running visual check...</p>
            <p className="text-xs text-[#00D4AA]/80">
              This may take up to 45 seconds. Fara-7B is analyzing the Perplexity UI.
            </p>
          </div>
        )}
      </div>

      {result && (
        <FaraResultsPanel
          result={result}
          apiResult={platformResult}
          onClose={() => setResult(null)}
        />
      )}
    </>
  );
}

/**
 * Build Perplexity search URL from prompt text
 */
function buildPerplexityUrl(promptText: string): string {
  const encoded = encodeURIComponent(promptText);
  return `https://www.perplexity.ai/search?q=${encoded}`;
}
