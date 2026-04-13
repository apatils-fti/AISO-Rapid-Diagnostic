#!/usr/bin/env node

/**
 * AISO Response Enrichment Pipeline
 *
 * Enriches Supabase results with sentiment (via Claude API) and
 * regex-based classifications (recommendation, CTA, winner, intent).
 *
 * Idempotent: only processes rows where sentiment IS NULL.
 *
 * Usage:
 *   node scripts/enrich-metrics.js
 *   node scripts/enrich-metrics.js --limit 50
 *   node scripts/enrich-metrics.js --platform gemini
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ─── Config ──────────────────────────────────────────────────
const CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';
const BRAND_NAME = 'J.Crew';
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;
const MAX_RETRIES = 3;

// ─── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;
const platformIdx = args.indexOf('--platform');
const platformFilter = platformIdx !== -1 ? args[platformIdx + 1] : undefined;

// ─── Clients ─────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Regex Classifiers ───────────────────────────────────────
const STRONG_REC = /(?<!not |don't |wouldn't |never |not the )(I highly recommend|best option|top choice|top pick|stands out as the best|first choice)/i;
const QUALIFIED_REC = /(?<!not |don't |wouldn't |never |not a |not the )(I recommend|good option|worth considering|solid choice|a great option|worth trying|ideal for)/i;
const CTA_PATTERN = /visit jcrew\.com|shop at j\.?crew|buy from j\.?crew|find at j\.?crew|check out j\.?crew|jcrew\.com\/|shop\.jcrew/i;

function classifyRecommendation(text) {
  if (STRONG_REC.test(text)) return 'strong';
  if (QUALIFIED_REC.test(text)) return 'qualified';
  return 'absent';
}

function detectCta(text) {
  return CTA_PATTERN.test(text);
}

function detectWinner(text, isotope) {
  if (isotope !== 'comparative') return false;
  const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return false;
  const lastTwo = sentences.slice(-2);
  return lastTwo.some(s => /j\.?crew/i.test(s));
}

function mapIntent(isotope) {
  if (isotope === 'commercial' || isotope === 'specific') return 'high';
  if (isotope === 'comparative' || isotope === 'persona') return 'medium';
  return 'low';
}

// ─── Sentiment via Claude API ────────────────────────────────
async function classifySentiment(responseText, retries = 0) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 64,
      system: 'You are an AI search response analyzer. Return only valid JSON.',
      messages: [{
        role: 'user',
        content: `Classify the sentiment toward the brand '${BRAND_NAME}' in this AI response.
Return: { "sentiment": "positive" | "neutral" | "hedged" | "negative" | "not_mentioned" }

Rules:
- positive: praised, recommended, described with positive language
- neutral: mentioned factually without judgment
- hedged: mentioned with qualifications, caveats, or mixed signals
- negative: criticized or described negatively
- not_mentioned: brand does not appear in the response

Response: ${responseText.slice(0, 2000)}`
      }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Non-text response');

    const parsed = JSON.parse(content.text);
    const valid = ['positive', 'neutral', 'hedged', 'negative', 'not_mentioned'];
    if (!valid.includes(parsed.sentiment)) {
      throw new Error(`Invalid sentiment: ${parsed.sentiment}`);
    }
    return parsed.sentiment;
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries + 1) * 1000;
      console.warn(`  Retry ${retries + 1}/${MAX_RETRIES} after ${delay}ms: ${err.message}`);
      await sleep(delay);
      return classifySentiment(responseText, retries + 1);
    }
    throw err;
  }
}

// ─── Helpers ─────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  AISO Response Enrichment Pipeline');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Client: ${BRAND_NAME} (${CLIENT_ID})`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  if (limit) console.log(`  Limit: ${limit}`);
  if (platformFilter) console.log(`  Platform: ${platformFilter}`);
  console.log('');

  // Fetch un-enriched results
  let query = supabase
    .from('results')
    .select('id, response_text, client_mentioned, isotope, topic_name, platform')
    .eq('client_id', CLIENT_ID)
    .is('sentiment', null)
    .order('created_at', { ascending: true });

  if (platformFilter) {
    query = query.eq('platform', platformFilter);
  }
  if (limit) {
    query = query.limit(limit);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error('Failed to fetch results:', error.message);
    process.exit(1);
  }

  console.log(`  Found ${rows.length} un-enriched results\n`);

  if (rows.length === 0) {
    console.log('  Nothing to process. All results are already enriched.');
    return;
  }

  const stats = { processed: 0, skipped: 0, failed: 0, apiCalls: 0 };
  const errors = [];
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      try {
        const text = row.response_text || '';
        const isotope = row.isotope || 'informational';

        // Regex classifications (no API needed)
        const recommendation_strength = classifyRecommendation(text);
        const cta_present = detectCta(text);
        const decision_criteria_winner = detectWinner(text, isotope);
        const conversion_intent = mapIntent(isotope);

        // Sentiment via Claude API
        let sentiment;
        if (!row.client_mentioned) {
          sentiment = 'not_mentioned';
        } else {
          sentiment = await classifySentiment(text);
          stats.apiCalls++;
        }

        // Update Supabase
        const { error: updateError } = await supabase
          .from('results')
          .update({
            sentiment,
            recommendation_strength,
            cta_present,
            decision_criteria_winner,
            conversion_intent,
          })
          .eq('id', row.id);

        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`);
        }

        stats.processed++;
      } catch (err) {
        stats.failed++;
        errors.push({ id: row.id, error: err.message });
        console.error(`  ✗ Row ${row.id}: ${err.message}`);
      }
    }

    // Progress logging
    const total = stats.processed + stats.failed;
    if (total % 50 === 0 || total === rows.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Progress: ${total}/${rows.length} (${elapsed}s, ${stats.apiCalls} API calls)`);
    }

    // Batch delay (skip on last batch)
    if (i + BATCH_SIZE < rows.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const estimatedCost = (stats.apiCalls * 220 * 0.000003 + stats.apiCalls * 30 * 0.000015).toFixed(4);

  const summary = {
    timestamp: new Date().toISOString(),
    clientId: CLIENT_ID,
    brand: BRAND_NAME,
    platform: platformFilter || 'all',
    totalRows: rows.length,
    processed: stats.processed,
    failed: stats.failed,
    apiCalls: stats.apiCalls,
    estimatedCost: `$${estimatedCost}`,
    durationSeconds: parseFloat(duration),
    errors: errors.slice(0, 20),
  };

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Enrichment Complete');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Duration: ${duration}s`);
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  API calls: ${stats.apiCalls}`);
  console.log(`  Estimated cost: $${estimatedCost}`);

  // Save summary
  const fs = await import('fs');
  fs.writeFileSync(
    new URL('./enrichment-summary.json', import.meta.url),
    JSON.stringify(summary, null, 2)
  );
  console.log('  Summary saved to scripts/enrichment-summary.json');

  // Save errors
  if (errors.length > 0) {
    fs.writeFileSync(
      new URL('./enrichment-errors.json', import.meta.url),
      JSON.stringify(errors, null, 2)
    );
    console.log(`  Errors saved to scripts/enrichment-errors.json (${errors.length} failures)`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
