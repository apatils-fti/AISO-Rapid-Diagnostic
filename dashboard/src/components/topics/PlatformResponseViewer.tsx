'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Bot, Gem, Search, ChevronDown } from 'lucide-react';
import { getTopicResponses, getPlatformMeta, type PromptResponse } from '@/lib/platform-data';
import { cn } from '@/lib/utils';

const PLATFORM_ICONS: Record<string, typeof Sparkles> = {
  perplexity: Sparkles,
  chatgpt_search: Bot,
  gemini: Gem,
  claude: Bot,
  google_ai_overview: Search,
};

const PLATFORM_ORDER = ['perplexity', 'chatgpt_search', 'gemini', 'claude', 'google_ai_overview'];

interface PlatformResponseViewerProps {
  topicId: string;
}

export function PlatformResponseViewer({ topicId }: PlatformResponseViewerProps) {
  const [byPlatform, setByPlatform] = useState<Record<string, PromptResponse[]>>({});
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [selectedPromptIdx, setSelectedPromptIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    getTopicResponses(topicId).then((data) => {
      setByPlatform(data);

      // Default to first platform that has data
      const firstPlatform = PLATFORM_ORDER.find((p) => data[p]?.length > 0);
      if (firstPlatform) setSelectedPlatform(firstPlatform);
      setLoading(false);
    });
  }, [topicId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <div className="text-sm text-[#6B7280] text-center py-8">
          Loading platform responses...
        </div>
      </div>
    );
  }

  const availablePlatforms = PLATFORM_ORDER.filter(
    (p) => byPlatform[p]?.length > 0
  );

  if (availablePlatforms.length === 0) {
    return (
      <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] p-6">
        <div className="text-sm text-[#6B7280] text-center py-8">
          No AI responses available for this topic.
        </div>
      </div>
    );
  }

  const currentResponses = byPlatform[selectedPlatform] || [];
  const currentResponse = currentResponses[selectedPromptIdx];
  const meta = getPlatformMeta(selectedPlatform);

  return (
    <div className="rounded-lg border border-[#2A2D37] bg-[#1A1D27] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#2A2D37]">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-[#E5E7EB]">
            AI Responses
          </h2>
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            {availablePlatforms.length} of 4 platforms have data
          </div>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex border-b border-[#2A2D37] bg-[#22252F]">
        {PLATFORM_ORDER.map((platform) => {
          const pmeta = getPlatformMeta(platform);
          const Icon = PLATFORM_ICONS[platform] ?? Bot;
          const hasData = byPlatform[platform]?.length > 0;
          const count = byPlatform[platform]?.length ?? 0;
          const isSelected = platform === selectedPlatform;

          return (
            <button
              key={platform}
              onClick={() => {
                if (hasData) {
                  setSelectedPlatform(platform);
                  setSelectedPromptIdx(0);
                }
              }}
              disabled={!hasData}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                isSelected
                  ? 'border-current text-[#E5E7EB]'
                  : hasData
                  ? 'border-transparent text-[#6B7280] hover:text-[#9CA3AF]'
                  : 'border-transparent text-[#3A3D47] cursor-not-allowed'
              )}
              style={isSelected ? { borderColor: pmeta.color, color: pmeta.color } : undefined}
            >
              <Icon className="h-4 w-4" />
              <span>{pmeta.displayName}</span>
              {hasData && (
                <span
                  className={cn(
                    'text-xs rounded-full px-1.5 py-0.5',
                    isSelected ? 'bg-white/10' : 'bg-[#2A2D37]'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Prompt selector (if multiple prompts) */}
      {currentResponses.length > 1 && (
        <div className="px-4 py-3 border-b border-[#2A2D37] bg-[#1A1D27]">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#6B7280] whitespace-nowrap">Prompt:</span>
            <div className="relative flex-1">
              <select
                value={selectedPromptIdx}
                onChange={(e) => setSelectedPromptIdx(Number(e.target.value))}
                className="w-full appearance-none rounded border border-[#2A2D37] bg-[#22252F] px-3 py-2 pr-8 text-sm text-[#E5E7EB] focus:outline-none focus:border-[#00D4AA]"
              >
                {currentResponses.map((resp, idx) => (
                  <option key={idx} value={idx}>
                    {resp.promptId} {resp.clientMentioned ? '✓ Mentioned' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280] pointer-events-none" />
            </div>
            <div className="flex items-center gap-4 text-xs text-[#6B7280] whitespace-nowrap">
              <span>
                {selectedPromptIdx + 1} / {currentResponses.length}
              </span>
              <button
                onClick={() =>
                  setSelectedPromptIdx((prev) =>
                    prev > 0 ? prev - 1 : currentResponses.length - 1
                  )
                }
                className="px-2 py-1 rounded border border-[#2A2D37] hover:border-[#363944] text-[#9CA3AF]"
              >
                ← Prev
              </button>
              <button
                onClick={() =>
                  setSelectedPromptIdx((prev) =>
                    prev < currentResponses.length - 1 ? prev + 1 : 0
                  )
                }
                className="px-2 py-1 rounded border border-[#2A2D37] hover:border-[#363944] text-[#9CA3AF]"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Response content */}
      {currentResponse && (
        <div className="p-6">
          {/* Metadata bar */}
          <div className="flex items-center gap-4 mb-4 text-xs text-[#6B7280]">
            <span className="font-mono bg-[#22252F] px-2 py-1 rounded text-[#9CA3AF]">
              {currentResponse.promptId}
            </span>
            {currentResponse.clientMentioned ? (
              <span className="text-[#10B981]">Brand Mentioned</span>
            ) : (
              <span className="text-[#EF4444]">Not Mentioned</span>
            )}
            {currentResponse.competitorsMentioned.length > 0 && (
              <span>
                Competitors:{' '}
                {currentResponse.competitorsMentioned.join(', ')}
              </span>
            )}
            {currentResponse.citations.length > 0 && (
              <span>{currentResponse.citations.length} citations</span>
            )}
          </div>

          {/* Response text */}
          <div className="rounded-lg border border-[#2A2D37] bg-[#22252F] p-4 max-h-[500px] overflow-y-auto">
            <div
              className="prose prose-sm prose-invert max-w-none text-[#C9CDD5] leading-relaxed whitespace-pre-wrap"
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              {highlightBrandMentions(currentResponse.responseText)}
            </div>
          </div>

          {/* Citations */}
          {currentResponse.citations.length > 0 && (
            <div className="mt-4">
              <span className="text-xs text-[#6B7280] uppercase tracking-wider">
                Citations
              </span>
              <div className="mt-2 space-y-1">
                {currentResponse.citations.map((url, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-[#3B82F6] truncate"
                  >
                    [{idx + 1}] {url}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function highlightBrandMentions(text: string): React.ReactNode {
  if (!text) return null;

  // Highlight J.Crew mentions
  const parts = text.split(/(J\.?\s*Crew)/gi);
  return parts.map((part, idx) =>
    /J\.?\s*Crew/i.test(part) ? (
      <span key={idx} className="text-[#00D4AA] font-medium bg-[#00D4AA]/10 px-0.5 rounded">
        {part}
      </span>
    ) : (
      part
    )
  );
}
