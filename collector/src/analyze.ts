#!/usr/bin/env node
/**
 * AISO Analysis Pipeline
 *
 * Reads raw collection results and produces the computed metrics
 * that the dashboard consumes.
 *
 * Usage:
 *   npm run analyze -- --input data/raw-results/2026-03-02T14-30-00-000Z
 *   npm run analyze -- --input data/raw-results/2026-03-02T14-30-00-000Z --output ../dashboard/src/fixtures
 */

import { join, resolve } from 'node:path';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import {
  loadPromptLibrary,
  ensureDir,
  writeJSON,
  formatDuration,
} from './utils.js';
import type {
  PromptResult,
  CollectionManifest,
  PromptLibrary,
} from './types.js';
import {
  analyzeTextMentions,
  aggregateTextMetrics,
  type TextAnalysisResult,
  type AggregatedTextMetrics,
} from './text-analysis.js';
import {
  getIndustryProfile,
  type IndustryProfile,
} from './industry-profiles.js';

// ── Types for the dashboard's analyzedMetrics.json ──

interface IsotopeResult {
  cited: boolean;
  citationCount: number;
  avgPosition: number | null;
  consistency: number;
  runs: number;
  runsWithCitation: number;
  competitorCitations: Record<string, number>;
}

interface ParametricPresence {
  mentioned: boolean;
  mentionRate: number;
  sentiment: string;
  position: string;
}

interface TopicResult {
  topicId: string;
  topicName: string;
  category: string;
  overallScore: number;
  isotopeResults: Record<string, IsotopeResult>;
  robustnessScore: number;
  parametricPresence: ParametricPresence;
}

interface CompetitorOverview {
  name: string;
  isClient: boolean;
  overallCitationShare: number;
  topicShares: Record<string, number>;
  strongestTopics: string[];
  weakestTopics: string[];
  avgCitationPosition: number;
  parametricMentionRate: number;
}

interface PlatformBreakdown {
  available: boolean;
  comingSoon?: boolean;
  citationShare?: number;
  promptsCited?: number;
  totalPrompts?: number;
  avgCitationPosition?: number;
  brandMentionRate?: number;
}

interface AnalyzedMetrics {
  summary: {
    overallScore: number;
    totalPrompts: number;
    totalCitations: number;
    clientCitations: number;
    citationShare: number;
    parametricMentionRate: number;
    ragCitationRate: number;
    topCompetitor: { name: string; citationShare: number };
    platformBreakdown: Record<string, PlatformBreakdown>;
    // NEW: Text-based metrics
    brandMentionRate: number;      // % of responses mentioning client
    firstMentionRate: number;      // % where client is mentioned first
    avgMentionPosition: number;    // Average position (1 = first)
    shareOfVoice: number;          // Client mentions / all brand mentions
    // Industry context
    industry: {
      id: string;
      name: string;
      citationExpectation: string;
    };
  };
  topicResults: TopicResult[];
  competitorOverview: CompetitorOverview[];
  gapAnalysis: {
    quadrant: string;
    parametricScore: number;
    ragScore: number;
    insight: string;
    recommendations: string[];
  };
  // NEW: Detailed text metrics
  textMetrics: {
    overall: AggregatedTextMetrics;
    byTopic: Record<string, AggregatedTextMetrics>;
  };
}

// ── CLI Arguments ──

interface AnalyzeOptions {
  inputDir: string;
  outputDir: string;
  promptLibraryPath: string;
}

function parseArgs(): AnalyzeOptions {
  const args = process.argv.slice(2);
  const opts: AnalyzeOptions = {
    inputDir: '',
    outputDir: resolve(import.meta.dirname ?? '.', '../../dashboard/src/fixtures'),
    promptLibraryPath: resolve(import.meta.dirname ?? '.', '../prompts/jcrew-prompt-library.json'),
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        opts.inputDir = resolve(args[++i]);
        break;
      case '--output':
        opts.outputDir = resolve(args[++i]);
        break;
      case '--prompts':
        opts.promptLibraryPath = resolve(args[++i]);
        break;
    }
  }

  if (!opts.inputDir) {
    // Find the most recent results directory
    const baseDir = resolve(import.meta.dirname ?? '.', '../data/raw-results');
    if (existsSync(baseDir)) {
      const dirs = readdirSync(baseDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort()
        .reverse();

      if (dirs.length > 0) {
        opts.inputDir = join(baseDir, dirs[0]);
      }
    }

    if (!opts.inputDir) {
      console.error('✘  No input directory found. Use --input <path> or run collection first.');
      process.exit(1);
    }
  }

  return opts;
}

// ── Helpers ──

function readResultFiles(dir: string): PromptResult[] {
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'));

  const results: PromptResult[] = [];
  for (const file of files) {
    const raw = JSON.parse(
      readFileSync(join(dir, file), 'utf-8')
    ) as PromptResult;
    results.push(raw);
  }

  return results;
}

/** Check if a citation URL belongs to any of the given domains. */
function urlMatchesDomains(url: string, domains: string[]): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return domains.some(d => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Check if the response text mentions the client name. */
function textMentionsClient(text: string, clientName: string): boolean {
  return text.toLowerCase().includes(clientName.toLowerCase());
}

/** Extract response text from either Perplexity or unified PlatformResponse format. */
function getResponseText(response: any): string {
  // Try unified PlatformResponse format first (content directly on response)
  if (typeof response.content === 'string' && response.content.length > 0) {
    return response.content;
  }
  // Fall back to Perplexity format (choices[0].message.content)
  const perplexityContent = response.choices?.[0]?.message?.content;
  if (perplexityContent) {
    return perplexityContent;
  }
  // Fall back to ChatGPT rawResponse extraction (for data collected with broken normalizer)
  if (response.rawResponse?.output) {
    const textParts: string[] = [];
    for (const block of response.rawResponse.output) {
      if (block.type === 'message' && Array.isArray(block.content)) {
        for (const contentItem of block.content) {
          if (contentItem.type === 'output_text' && contentItem.text) {
            textParts.push(contentItem.text);
          }
        }
      }
    }
    if (textParts.length > 0) {
      return textParts.join('\n');
    }
  }
  return '';
}

/** Extract citations from response, with fallback to rawResponse for ChatGPT data. */
function getResponseCitations(response: any): string[] {
  // Try direct citations array first
  if (Array.isArray(response.citations) && response.citations.length > 0) {
    return response.citations;
  }
  // Fall back to ChatGPT rawResponse extraction (annotations contain url_citation)
  if (response.rawResponse?.output) {
    const citations: string[] = [];
    for (const block of response.rawResponse.output) {
      if (block.type === 'message' && Array.isArray(block.content)) {
        for (const contentItem of block.content) {
          if (contentItem.type === 'output_text' && Array.isArray(contentItem.annotations)) {
            for (const annotation of contentItem.annotations) {
              if (annotation.type === 'url_citation' && annotation.url) {
                // Remove tracking params and dedupe
                const cleanUrl = annotation.url.split('?utm_source=')[0];
                if (!citations.includes(cleanUrl)) {
                  citations.push(cleanUrl);
                }
              }
            }
          }
        }
      }
    }
    return citations;
  }
  return response.citations ?? [];
}

/** Infer platform from model name (useful when platform tag is missing or incorrect). */
function inferPlatformFromModel(model: string): 'perplexity' | 'chatgpt_search' {
  const modelLower = model.toLowerCase();
  if (modelLower.includes('sonar')) {
    return 'perplexity';
  }
  if (modelLower.includes('gpt') && modelLower.includes('search')) {
    return 'chatgpt_search';
  }
  // Default based on other patterns
  if (modelLower.includes('pplx') || modelLower.includes('perplexity')) {
    return 'perplexity';
  }
  if (modelLower.includes('openai') || modelLower.includes('gpt')) {
    return 'chatgpt_search';
  }
  // Fallback to perplexity for backward compatibility
  return 'perplexity';
}

// ── Main Analysis ──

async function main() {
  const opts = parseArgs();

  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   AISO Analysis Pipeline                     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Input:   ${opts.inputDir}`);
  console.log(`  Output:  ${opts.outputDir}`);
  console.log('');

  // Load prompt library for metadata
  const library = loadPromptLibrary(opts.promptLibraryPath);
  const clientName = library.client.name;
  const clientDomains = library.client.domains;
  const competitors = library.competitors;
  const competitorNames = competitors.map(c => c.name);
  const allCompetitors = [
    { name: clientName, domains: clientDomains, isClient: true },
    ...competitors.map(c => ({ ...c, isClient: false })),
  ];

  // Get industry profile for scoring weights
  const industryId = (library.client as { industry?: string }).industry ?? 'default';
  const industryProfile = getIndustryProfile(industryId);
  console.log(`  Industry: ${industryProfile.name} (${industryProfile.citationExpectation} citation expectation)`);
  console.log('');

  // Load all result files
  const results = readResultFiles(opts.inputDir);
  console.log(`  Loaded ${results.length} prompt results`);

  // ── Compute text-based metrics ──
  const allTextAnalyses: TextAnalysisResult[] = [];
  const textAnalysesByTopic: Record<string, TextAnalysisResult[]> = {};

  for (const result of results) {
    for (const run of result.runs) {
      const responseText = getResponseText(run.response);
      if (responseText) {
        const analysis = analyzeTextMentions(responseText, clientName, competitorNames);
        allTextAnalyses.push(analysis);

        // Track by topic
        if (!textAnalysesByTopic[result.topicId]) {
          textAnalysesByTopic[result.topicId] = [];
        }
        textAnalysesByTopic[result.topicId].push(analysis);
      }
    }
  }

  const overallTextMetrics = aggregateTextMetrics(allTextAnalyses, clientName);
  const textMetricsByTopic: Record<string, AggregatedTextMetrics> = {};
  for (const [topicId, analyses] of Object.entries(textAnalysesByTopic)) {
    textMetricsByTopic[topicId] = aggregateTextMetrics(analyses, clientName);
  }
  console.log(`  Analyzed ${allTextAnalyses.length} responses for text mentions`);
  console.log(`  Loaded ${results.length} prompt results`);

  // ── Aggregate per-topic, per-isotope ──

  let totalCitations = 0;
  let clientCitations = 0;
  let clientPromptsCited = 0;
  const competitorCitationCounts: Record<string, number> = {};
  const competitorTopicCounts: Record<string, Record<string, number>> = {};
  const positionSums: Record<string, { sum: number; count: number }> = {};

  // ── Per-platform tracking ──
  const platformMetrics: Record<string, {
    totalCitations: number;
    clientCitations: number;
    promptsCited: number;
    totalPrompts: number;
    positionSum: number;
    positionCount: number;
    textAnalyses: TextAnalysisResult[];
  }> = {
    perplexity: { totalCitations: 0, clientCitations: 0, promptsCited: 0, totalPrompts: 0, positionSum: 0, positionCount: 0, textAnalyses: [] },
    chatgpt_search: { totalCitations: 0, clientCitations: 0, promptsCited: 0, totalPrompts: 0, positionSum: 0, positionCount: 0, textAnalyses: [] },
  };

  // ── Count platform metrics for ALL results (independent of topic matching) ──
  for (const result of results) {
    const platform = inferPlatformFromModel(result.model);
    if (!platformMetrics[platform]) continue;

    platformMetrics[platform].totalPrompts++;

    let promptCitedOnThisPlatform = false;
    for (const run of result.runs) {
      const citations = getResponseCitations(run.response);
      const responseText = getResponseText(run.response);

      platformMetrics[platform].totalCitations += citations.length;

      // Track text analysis per platform
      if (responseText) {
        const analysis = analyzeTextMentions(responseText, clientName, competitorNames);
        platformMetrics[platform].textAnalyses.push(analysis);
      }

      // Check for client citations
      for (let i = 0; i < citations.length; i++) {
        if (urlMatchesDomains(citations[i], clientDomains)) {
          platformMetrics[platform].clientCitations++;
          platformMetrics[platform].positionSum += (i + 1);
          platformMetrics[platform].positionCount++;
          promptCitedOnThisPlatform = true;
        }
      }
    }

    if (promptCitedOnThisPlatform) {
      platformMetrics[platform].promptsCited++;
    }
  }

  console.log(`  Platform breakdown: Perplexity=${platformMetrics.perplexity.totalPrompts}, ChatGPT=${platformMetrics.chatgpt_search.totalPrompts}`);

  for (const comp of allCompetitors) {
    competitorCitationCounts[comp.name] = 0;
    competitorTopicCounts[comp.name] = {};
    positionSums[comp.name] = { sum: 0, count: 0 };
  }

  const topicResults: TopicResult[] = [];
  const topicMap = new Map<string, typeof library.topics[0]>();
  for (const t of library.topics) topicMap.set(t.id, t);

  // Group results by topic
  const resultsByTopic = new Map<string, PromptResult[]>();
  for (const r of results) {
    const list = resultsByTopic.get(r.topicId) ?? [];
    list.push(r);
    resultsByTopic.set(r.topicId, list);
  }

  for (const topic of library.topics) {
    const topicPrompts = resultsByTopic.get(topic.id) ?? [];
    const isotopeResults: Record<string, IsotopeResult> = {};

    let topicClientCitations = 0;
    let topicTotalCitations = 0;
    let isotopesWithCitation = 0;
    let parametricMentions = 0;
    let parametricTotal = 0;

    for (const prompt of topic.prompts) {
      const result = topicPrompts.find(r => r.promptId === prompt.id);
      if (!result) {
        // No data for this prompt
        isotopeResults[prompt.isotope] = {
          cited: false,
          citationCount: 0,
          avgPosition: null,
          consistency: 0,
          runs: 0,
          runsWithCitation: 0,
          competitorCitations: Object.fromEntries(competitors.map(c => [c.name, 0])),
        };
        continue;
      }

      let runsWithClientCitation = 0;
      let clientCitationTotal = 0;
      let clientPositionSum = 0;
      let clientPositionCount = 0;
      const perRunCompetitorCitations: Record<string, number> = {};
      for (const comp of competitors) perRunCompetitorCitations[comp.name] = 0;

      // Note: Platform metrics are computed in a separate loop above for all results
      // Here we only track topic-level and competitor metrics

      for (const run of result.runs) {
        const citations = getResponseCitations(run.response);
        const responseText = getResponseText(run.response);

        // Count total citations
        totalCitations += citations.length;
        topicTotalCitations += citations.length;

        // Check client citations
        let clientCitedInRun = false;
        for (let i = 0; i < citations.length; i++) {
          const url = citations[i];

          if (urlMatchesDomains(url, clientDomains)) {
            clientCitations++;
            topicClientCitations++;
            clientCitationTotal++;
            clientCitedInRun = true;
            clientPositionSum += (i + 1);
            clientPositionCount++;
          }

          // Check competitor citations
          for (const comp of competitors) {
            if (urlMatchesDomains(url, comp.domains)) {
              competitorCitationCounts[comp.name]++;
              perRunCompetitorCitations[comp.name]++;

              if (!competitorTopicCounts[comp.name][topic.id]) {
                competitorTopicCounts[comp.name][topic.id] = 0;
              }
              competitorTopicCounts[comp.name][topic.id]++;

              positionSums[comp.name].sum += (i + 1);
              positionSums[comp.name].count++;
            }
          }
        }

        if (clientCitedInRun) runsWithClientCitation++;

        // Parametric: check if client mentioned in the text without citations
        parametricTotal++;
        if (textMentionsClient(responseText, clientName)) {
          parametricMentions++;
        }
      }

      const runs = result.runs.length;
      const consistency = runs > 0 ? runsWithClientCitation / runs : 0;
      const cited = runsWithClientCitation > 0;

      if (cited) {
        isotopesWithCitation++;
        clientPromptsCited++;
      }

      isotopeResults[prompt.isotope] = {
        cited,
        citationCount: clientCitationTotal,
        avgPosition: clientPositionCount > 0 ? clientPositionSum / clientPositionCount : null,
        consistency,
        runs,
        runsWithCitation: runsWithClientCitation,
        competitorCitations: perRunCompetitorCitations,
      };
    }

    const totalIsotopes = topic.prompts.length;
    const robustnessScore = totalIsotopes > 0 ? isotopesWithCitation / totalIsotopes : 0;
    const parametricMentionRate = parametricTotal > 0 ? parametricMentions / parametricTotal : 0;

    // Score: weighted combination of consistency, robustness, and citation count
    const avgConsistency = Object.values(isotopeResults)
      .reduce((s, ir) => s + ir.consistency, 0) / totalIsotopes;
    const overallScore = Math.round(
      avgConsistency * 40 +
      robustnessScore * 40 +
      Math.min(1, topicClientCitations / Math.max(1, topicTotalCitations) * 10) * 20
    );

    topicResults.push({
      topicId: topic.id,
      topicName: topic.name,
      category: topic.category,
      overallScore,
      isotopeResults,
      robustnessScore,
      parametricPresence: {
        mentioned: parametricMentionRate > 0.1,
        mentionRate: parametricMentionRate,
        sentiment: 'neutral',
        position: parametricMentionRate > 0.3 ? 'primary' :
                  parametricMentionRate > 0.1 ? 'secondary' :
                  parametricMentionRate > 0 ? 'mentioned' : 'absent',
      },
    });
  }

  // ── Build competitor overview ──

  const overallCitationShare = totalCitations > 0 ? clientCitations / totalCitations : 0;
  const competitorOverview: CompetitorOverview[] = allCompetitors.map(comp => {
    const citations = comp.isClient ? clientCitations : (competitorCitationCounts[comp.name] ?? 0);
    const share = totalCitations > 0 ? citations / totalCitations : 0;

    // Topic-level shares
    const topicShares: Record<string, number> = {};
    for (const topic of library.topics) {
      if (comp.isClient) {
        const tr = topicResults.find(t => t.topicId === topic.id);
        const topicClientCits = tr ? Object.values(tr.isotopeResults).reduce((s, ir) => s + ir.citationCount, 0) : 0;
        const topicTotalFromIsotopes = totalCitations > 0 ? topicClientCits / (totalCitations / library.topics.length) : 0;
        topicShares[topic.id] = Math.min(1, topicTotalFromIsotopes);
      } else {
        const topicCits = competitorTopicCounts[comp.name]?.[topic.id] ?? 0;
        const perTopicTotal = totalCitations / library.topics.length;
        topicShares[topic.id] = perTopicTotal > 0 ? Math.min(1, topicCits / perTopicTotal) : 0;
      }
    }

    // Find strongest/weakest topics by share
    const sortedTopics = Object.entries(topicShares).sort(([, a], [, b]) => b - a);
    const strongestTopics = sortedTopics.slice(0, 3).map(([id]) => id);
    const weakestTopics = sortedTopics.slice(-3).reverse().map(([id]) => id);

    const pos = positionSums[comp.name];
    const avgPosition = pos && pos.count > 0 ? pos.sum / pos.count : 99;

    // Parametric: for client use our computed rate, for competitors estimate from text mentions
    let parametricRate = 0;
    if (comp.isClient) {
      const allMentions = topicResults.reduce((s, t) => s + t.parametricPresence.mentionRate, 0);
      parametricRate = topicResults.length > 0 ? allMentions / topicResults.length : 0;
    } else {
      // Count how often this competitor is mentioned in response texts
      let mentions = 0;
      let total = 0;
      for (const r of results) {
        for (const run of r.runs) {
          total++;
          const text = getResponseText(run.response);
          if (textMentionsClient(text, comp.name)) {
            mentions++;
          }
        }
      }
      parametricRate = total > 0 ? mentions / total : 0;
    }

    return {
      name: comp.name,
      isClient: comp.isClient,
      overallCitationShare: share,
      topicShares,
      strongestTopics,
      weakestTopics,
      avgCitationPosition: avgPosition,
      parametricMentionRate: parametricRate,
    };
  });

  // ── Summary ──

  // Legacy score (for backward compatibility with topic-level metrics)
  const legacyOverallScore = topicResults.length > 0
    ? Math.round(topicResults.reduce((s, t) => s + t.overallScore, 0) / topicResults.length)
    : 0;

  const avgParametric = topicResults.length > 0
    ? topicResults.reduce((s, t) => s + t.parametricPresence.mentionRate, 0) / topicResults.length
    : 0;

  const avgRag = topicResults.length > 0
    ? topicResults.reduce((s, t) => s + t.robustnessScore, 0) / topicResults.length
    : 0;

  // Find top competitor
  const topCompetitor = competitorOverview
    .filter(c => !c.isClient)
    .sort((a, b) => b.overallCitationShare - a.overallCitationShare)[0];

  const clientPos = positionSums[clientName];
  const avgClientPosition = clientPos && clientPos.count > 0 ? clientPos.sum / clientPos.count : 0;

  // NEW: Industry-weighted scoring using text metrics
  const { domainCitationWeight, brandMentionWeight, positionWeight, shareOfVoiceWeight } = industryProfile.metrics;

  // Normalize position score (1st place = 100%, 5th place = 0%)
  const positionScore = overallTextMetrics.avgMentionPosition > 0
    ? Math.max(0, 1 - (overallTextMetrics.avgMentionPosition - 1) / 4)
    : 0;

  // Calculate weighted overall score using industry-specific weights
  const overallScore = Math.round(
    (overallCitationShare * domainCitationWeight) +
    (overallTextMetrics.brandMentionRate * brandMentionWeight) +
    (positionScore * positionWeight) +
    (overallTextMetrics.shareOfVoice * shareOfVoiceWeight)
  );

  // ── Gap analysis ──

  const parametricScore = Math.round(avgParametric * 100);
  const ragScore = Math.round(avgRag * 100);
  const quadrant =
    parametricScore >= 50 && ragScore >= 50 ? 'high-parametric-high-rag' :
    parametricScore >= 50 && ragScore < 50 ? 'high-parametric-low-rag' :
    parametricScore < 50 && ragScore >= 50 ? 'low-parametric-high-rag' :
    parametricScore < 25 && ragScore >= 20 ? 'low-parametric-moderate-rag' :
    'low-parametric-low-rag';

  const analyzedMetrics: AnalyzedMetrics = {
    summary: {
      overallScore,
      totalPrompts: results.length,
      totalCitations,
      clientCitations,
      citationShare: overallCitationShare,
      parametricMentionRate: avgParametric,
      ragCitationRate: avgRag,
      topCompetitor: topCompetitor
        ? { name: topCompetitor.name, citationShare: topCompetitor.overallCitationShare }
        : { name: 'N/A', citationShare: 0 },
      platformBreakdown: {
        perplexity: platformMetrics.perplexity.totalPrompts > 0 ? {
          available: true,
          citationShare: platformMetrics.perplexity.totalCitations > 0
            ? platformMetrics.perplexity.clientCitations / platformMetrics.perplexity.totalCitations
            : 0,
          promptsCited: platformMetrics.perplexity.promptsCited,
          totalPrompts: platformMetrics.perplexity.totalPrompts,
          avgCitationPosition: platformMetrics.perplexity.positionCount > 0
            ? platformMetrics.perplexity.positionSum / platformMetrics.perplexity.positionCount
            : undefined,
          brandMentionRate: platformMetrics.perplexity.textAnalyses.length > 0
            ? aggregateTextMetrics(platformMetrics.perplexity.textAnalyses, clientName).brandMentionRate
            : 0,
        } : { available: false, comingSoon: true },
        google_ai_overview: { available: false, comingSoon: true },
        chatgpt_search: platformMetrics.chatgpt_search.totalPrompts > 0 ? {
          available: true,
          citationShare: platformMetrics.chatgpt_search.totalCitations > 0
            ? platformMetrics.chatgpt_search.clientCitations / platformMetrics.chatgpt_search.totalCitations
            : 0,
          promptsCited: platformMetrics.chatgpt_search.promptsCited,
          totalPrompts: platformMetrics.chatgpt_search.totalPrompts,
          avgCitationPosition: platformMetrics.chatgpt_search.positionCount > 0
            ? platformMetrics.chatgpt_search.positionSum / platformMetrics.chatgpt_search.positionCount
            : undefined,
          brandMentionRate: platformMetrics.chatgpt_search.textAnalyses.length > 0
            ? aggregateTextMetrics(platformMetrics.chatgpt_search.textAnalyses, clientName).brandMentionRate
            : 0,
        } : { available: false, comingSoon: true },
        claude_search: { available: false, comingSoon: true },
      },
      // NEW: Text-based metrics
      brandMentionRate: overallTextMetrics.brandMentionRate,
      firstMentionRate: overallTextMetrics.firstMentionRate,
      avgMentionPosition: overallTextMetrics.avgMentionPosition,
      shareOfVoice: overallTextMetrics.shareOfVoice,
      // Industry context
      industry: {
        id: industryProfile.id,
        name: industryProfile.name,
        citationExpectation: industryProfile.citationExpectation,
      },
    },
    topicResults,
    competitorOverview,
    gapAnalysis: {
      quadrant,
      parametricScore,
      ragScore,
      insight: generateInsight(clientName, parametricScore, ragScore, topCompetitor?.name ?? 'competitors'),
      recommendations: generateRecommendations(parametricScore, ragScore, clientName, topicResults),
    },
    // NEW: Detailed text metrics
    textMetrics: {
      overall: overallTextMetrics,
      byTopic: textMetricsByTopic,
    },
  };

  // ── Write output ──
  ensureDir(opts.outputDir);
  writeJSON(join(opts.outputDir, 'analyzedMetrics.json'), analyzedMetrics);

  // Also write a clientConfig.json
  const activePlatforms: string[] = [];
  if (platformMetrics.perplexity.totalPrompts > 0) activePlatforms.push('perplexity');
  if (platformMetrics.chatgpt_search.totalPrompts > 0) activePlatforms.push('chatgpt_search');

  const clientConfig = {
    clientName: library.client.name,
    clientDomains: library.client.domains,
    industry: industryProfile.name,
    competitors: library.competitors.map(c => ({ name: c.name, domains: c.domains })),
    runDate: new Date().toISOString(),
    platforms: activePlatforms,
    futurePlatforms: ['google_ai_overview', 'claude_search'],
  };
  writeJSON(join(opts.outputDir, 'clientConfig.json'), clientConfig);

  // Write a simplified prompt library compatible with the dashboard
  const dashboardPromptLibrary = {
    topics: library.topics.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      prompts: t.prompts.map(p => ({
        id: p.id,
        text: p.text,
        isotope: p.isotope,
        topic: t.id,
      })),
    })),
  };
  writeJSON(join(opts.outputDir, 'promptLibrary.json'), dashboardPromptLibrary);

  // Build rawResults.json from collected data (sample of results with citations)
  const rawResultsForDashboard = {
    results: results.slice(0, 15).flatMap(r =>
      r.runs.map(run => ({
        promptId: r.promptId,
        platform: inferPlatformFromModel(r.model),
        model: r.model,
        runId: run.runId,
        timestamp: run.timestamp,
        response: {
          text: getResponseText(run.response),
          citations: getResponseCitations(run.response),
          searchResults: run.response.search_results ?? [],
        },
        analysis: {
          clientCited: (getResponseCitations(run.response)).some(
            (url: string) => urlMatchesDomains(url, clientDomains)
          ),
          clientMentionedInText: textMentionsClient(
            getResponseText(run.response),
            clientName
          ),
          competitorsCited: competitors
            .filter(c =>
              (getResponseCitations(run.response)).some(
                (url: string) => urlMatchesDomains(url, c.domains)
              )
            )
            .map(c => c.name),
          totalCitations: (getResponseCitations(run.response)).length,
        },
      }))
    ),
  };
  writeJSON(join(opts.outputDir, 'rawResults.json'), rawResultsForDashboard);

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Analysis complete!');
  console.log('');
  console.log('  ── Overall Score ──');
  console.log(`  Score:             ${overallScore}/100 (industry-weighted)`);
  console.log(`  Industry:          ${industryProfile.name}`);
  console.log('');
  console.log('  ── Text-Based Metrics (NEW) ──');
  console.log(`  Brand Mention:     ${(overallTextMetrics.brandMentionRate * 100).toFixed(1)}% of responses`);
  console.log(`  First Mention:     ${(overallTextMetrics.firstMentionRate * 100).toFixed(1)}% mentioned first`);
  console.log(`  Avg Position:      ${overallTextMetrics.avgMentionPosition > 0 ? overallTextMetrics.avgMentionPosition.toFixed(1) : 'N/A'}`);
  console.log(`  Share of Voice:    ${(overallTextMetrics.shareOfVoice * 100).toFixed(1)}%`);
  console.log('');
  console.log('  ── Domain Citation Metrics ──');
  console.log(`  Citation Share:    ${(overallCitationShare * 100).toFixed(1)}%`);
  console.log(`  Prompts Cited:     ${clientPromptsCited}/${results.length}`);
  console.log('');
  console.log('  ── Competitor Analysis ──');
  console.log(`  Top Competitor:    ${topCompetitor?.name ?? 'N/A'} (${((topCompetitor?.overallCitationShare ?? 0) * 100).toFixed(1)}% citations)`);
  // Show top competitor by text mentions
  const competitorTextMetrics = Object.entries(overallTextMetrics.brandMetrics)
    .filter(([name]) => name !== clientName)
    .sort(([, a], [, b]) => b.mentionRate - a.mentionRate);
  if (competitorTextMetrics.length > 0) {
    const [topByMention, metrics] = competitorTextMetrics[0];
    console.log(`  Top by Mentions:   ${topByMention} (${(metrics.mentionRate * 100).toFixed(1)}% mention rate)`);
  }
  console.log('');
  console.log(`  Quadrant:          ${quadrant}`);
  console.log('');
  console.log(`  Output written to: ${opts.outputDir}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
}

// ── Insight Generation ──

function generateInsight(
  clientName: string,
  parametricScore: number,
  ragScore: number,
  topCompetitor: string,
): string {
  if (parametricScore < 25 && ragScore < 25) {
    return `${clientName} has very low visibility across both AI parametric knowledge and RAG citations. The brand is largely invisible in AI-powered search results, while ${topCompetitor} dominates. This represents a fundamental discoverability gap that requires a comprehensive content strategy.`;
  }
  if (parametricScore < 25 && ragScore >= 25) {
    return `${clientName}'s content performs moderately when retrieved by AI search, but the brand has very low inherent recognition in AI models. This suggests content discoverability strength but a fundamental brand awareness gap in training data. Focusing on high-authority content placement could close this gap.`;
  }
  if (parametricScore >= 25 && ragScore < 25) {
    return `${clientName} is recognized by AI models from training data, but its content is rarely cited in AI search results. This suggests a content SEO gap — the brand is known but its content isn't surfacing when AI tools actively search for answers. Focus on creating search-optimized, citation-worthy content.`;
  }
  return `${clientName} has strong positioning in AI search, with good parametric brand recognition and solid RAG citation rates. Continue building on this strength while targeting specific gaps in weaker topic areas.`;
}

function generateRecommendations(
  parametricScore: number,
  ragScore: number,
  clientName: string,
  topicResults: TopicResult[],
): string[] {
  const recs: string[] = [];

  if (parametricScore < 30) {
    recs.push('Increase presence on high-authority sites that feed LLM training data (Wikipedia, industry publications, fashion media)');
    recs.push('Create original research and trend reports that get widely referenced and linked');
  }

  if (ragScore < 30) {
    recs.push('Optimize product pages and editorial content for citation by AI search tools');
    recs.push('Develop comparison content that directly addresses head-to-head brand queries');
  }

  // Find weakest topics
  const weakest = [...topicResults].sort((a, b) => a.overallScore - b.overallScore).slice(0, 3);
  if (weakest.length > 0) {
    const names = weakest.map(t => t.topicName).join(', ');
    recs.push(`Focus content efforts on weakest topics: ${names}`);
  }

  recs.push(`Build dedicated landing pages targeting commercial-intent queries where ${clientName} is currently absent`);

  if (recs.length < 4) {
    recs.push('Monitor competitor content strategies and identify gaps where differentiated content can win citations');
  }

  return recs;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
