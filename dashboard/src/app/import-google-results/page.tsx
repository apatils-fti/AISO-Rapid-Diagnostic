'use client';

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SerpApiService } from '@/lib/serpapi-service';

export default function ImportGoogleResultsPage() {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [autoImported, setAutoImported] = useState(false);

  // Auto-import on mount
  useEffect(() => {
    const hasImported = localStorage.getItem('google-ai-imported');
    if (!hasImported && !autoImported) {
      setAutoImported(true);
      handleImport();
    }
  }, []);

  const handleImport = async () => {
    setImporting(true);
    setError(null);

    try {
      // Fetch the batch results file
      const response = await fetch('/scripts/google-batch-results.json');

      if (!response.ok) {
        throw new Error('Batch results file not found. Run the batch script first.');
      }

      const data = await response.json();

      // Import each result into localStorage using SerpApiService
      let importCount = 0;
      for (const result of data.results) {
        try {
          SerpApiService.saveResult(result);
          importCount++;
        } catch (err) {
          console.error(`Failed to import result for ${result.promptId}:`, err);
        }
      }

      // Update search counter
      const currentCount = SerpApiService.getSearchesUsed();
      const newCount = currentCount + data.metadata.searchesUsed;
      localStorage.setItem('serpapi-search-count', newCount.toString());

      setStats({
        imported: importCount,
        overviewsFound: data.results.filter((r: any) => r.hasOverview).length,
        clientMentions: data.results.filter((r: any) => r.clientMentioned).length,
        totalCitations: data.results.reduce((sum: number, r: any) => sum + r.citedSources.length, 0),
        searchesUsed: data.metadata.searchesUsed,
      });

      // Mark as imported to prevent re-import
      localStorage.setItem('google-ai-imported', 'true');
      setImported(true);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[Import] Error:', err);
    } finally {
      setImporting(false);
    }
  };

  const handleViewResults = () => {
    router.push('/compare');
  };

  return (
    <div className="min-h-screen bg-[#0D0F14] p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-[#E5E7EB] mb-2">
            Import Google AI Overview Results
          </h1>
          <p className="text-[#6B7280]">
            Load batch processing results into the dashboard
          </p>
        </div>

        <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-8">
          {!imported && !error && (
            <>
              <div className="flex items-start gap-4 mb-6">
                <div className="flex items-center justify-center rounded-lg bg-[#4285F4]/10 p-3">
                  <Upload className="h-6 w-6 text-[#4285F4]" />
                </div>
                <div className="flex-1">
                  <h2 className="font-heading text-xl font-semibold text-[#E5E7EB] mb-2">
                    Import Batch Results
                  </h2>
                  <p className="text-sm text-[#6B7280] mb-4">
                    This will load the results from <code className="px-2 py-1 rounded bg-[#22252F] text-[#00D4AA]">
                      scripts/google-batch-results.json
                    </code> into localStorage and update the search counter.
                  </p>
                  <div className="bg-[#22252F] rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-medium text-[#E5E7EB] mb-2">Prerequisites:</h3>
                    <ol className="text-sm text-[#6B7280] space-y-1 list-decimal list-inside">
                      <li>Run the batch script: <code className="text-[#00D4AA]">node scripts/batch-google-check.js</code></li>
                      <li>Wait for all 50 prompts to be processed (~2-3 minutes)</li>
                      <li>Click the import button below</li>
                    </ol>
                  </div>
                </div>
              </div>

              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-[#4285F4] text-white font-medium hover:bg-[#3B78E7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Import Results
                  </>
                )}
              </button>
            </>
          )}

          {imported && stats && (
            <>
              <div className="flex items-start gap-4 mb-6">
                <div className="flex items-center justify-center rounded-lg bg-[#10B981]/10 p-3">
                  <CheckCircle className="h-6 w-6 text-[#10B981]" />
                </div>
                <div className="flex-1">
                  <h2 className="font-heading text-xl font-semibold text-[#E5E7EB] mb-2">
                    Import Successful!
                  </h2>
                  <p className="text-sm text-[#6B7280] mb-4">
                    Google AI Overview results have been loaded into localStorage.
                  </p>
                </div>
              </div>

              <div className="bg-[#22252F] rounded-lg p-6 mb-6">
                <h3 className="text-sm font-medium text-[#E5E7EB] mb-4">Import Statistics:</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-[#6B7280] mb-1">Prompts Imported</div>
                    <div className="text-2xl font-semibold text-[#00D4AA]">{stats.imported}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[#6B7280] mb-1">AI Overviews Found</div>
                    <div className="text-2xl font-semibold text-[#4285F4]">{stats.overviewsFound}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[#6B7280] mb-1">Client Mentions</div>
                    <div className="text-2xl font-semibold text-[#10B981]">{stats.clientMentions}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[#6B7280] mb-1">Total Citations</div>
                    <div className="text-2xl font-semibold text-[#E5E7EB]">{stats.totalCitations}</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#2A2D37]">
                  <div className="text-sm text-[#6B7280]">
                    Searches Used: <span className="text-[#E5E7EB] font-medium">{stats.searchesUsed} / 250</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleViewResults}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-[#00D4AA] text-[#0D0F14] font-medium hover:bg-[#00BF99] transition-colors"
              >
                View Platform Comparison
                <ArrowRight className="h-5 w-5" />
              </button>
            </>
          )}

          {error && (
            <>
              <div className="flex items-start gap-4 mb-6">
                <div className="flex items-center justify-center rounded-lg bg-[#EF4444]/10 p-3">
                  <AlertCircle className="h-6 w-6 text-[#EF4444]" />
                </div>
                <div className="flex-1">
                  <h2 className="font-heading text-xl font-semibold text-[#E5E7EB] mb-2">
                    Import Failed
                  </h2>
                  <p className="text-sm text-[#EF4444] mb-4">
                    {error}
                  </p>
                </div>
              </div>

              <button
                onClick={handleImport}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-[#4285F4] text-white font-medium hover:bg-[#3B78E7] transition-colors"
              >
                <Upload className="h-5 w-5" />
                Try Again
              </button>
            </>
          )}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-[#22252F] border border-[#2A2D37]">
          <h3 className="text-sm font-medium text-[#E5E7EB] mb-2">What happens during import?</h3>
          <ul className="text-sm text-[#6B7280] space-y-1 list-disc list-inside">
            <li>Reads results from <code className="text-[#00D4AA]">google-batch-results.json</code></li>
            <li>Stores each result in localStorage using SerpApiService</li>
            <li>Updates the search counter (increments by searches used)</li>
            <li>Google AI data will appear in Compare Platforms view</li>
            <li>Existing Perplexity and ChatGPT data remains unchanged</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
