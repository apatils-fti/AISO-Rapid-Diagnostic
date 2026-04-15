#!/usr/bin/env node

/**
 * Citation Source Enrichment
 *
 * Classifies each citation URL in the results table into source types
 * (owned, earned_editorial, community, retail, etc.) and writes
 * classified_citations JSONB column.
 *
 * Idempotent: only processes rows where classified_citations IS NULL or '[]'.
 *
 * Usage:
 *   node scripts/enrich-citation-sources.js
 *   node scripts/enrich-citation-sources.js --limit 100
 *   node scripts/enrich-citation-sources.js --platform gemini
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

// ─── Config ──────────────────────────────────────────────────
const CLIENT_ID = '269b6038-bb3b-4c2d-9fcf-b497beebfe35';
const CLIENT_DOMAINS = ['jcrew.com'];
const COMPETITOR_DOMAINS = [
  'bananarepublic.com', 'everlane.com', 'gap.com',
  'abercrombie.com', 'clubmonaco.com',
];
const BATCH_SIZE = 50;

// ─── CLI args ────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
const limit = getArg('--limit') ? parseInt(getArg('--limit'), 10) : undefined;
const platformFilter = getArg('--platform');

// ─── Supabase ────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Domain Lookup (inline, same as url-classifier.ts) ───────
const DOMAIN_MAP = {
  'vogue.com': 'earned_editorial', 'gq.com': 'earned_editorial', 'esquire.com': 'earned_editorial',
  'elle.com': 'earned_editorial', 'harpersbazaar.com': 'earned_editorial', 'wwd.com': 'earned_editorial',
  'forbes.com': 'earned_editorial', 'fortune.com': 'earned_editorial', 'hbr.org': 'earned_editorial',
  'refinery29.com': 'earned_editorial', 'whowhatwear.com': 'earned_editorial', 'thecut.com': 'earned_editorial',
  'fashionista.com': 'earned_editorial', 'businessoffashion.com': 'earned_editorial',
  'wired.com': 'earned_editorial', 'fastcompany.com': 'earned_editorial', 'vanityfair.com': 'earned_editorial',
  'inc.com': 'earned_editorial', 'theatlantic.com': 'earned_editorial', 'newyorker.com': 'earned_editorial',

  'nytimes.com': 'earned_news', 'wsj.com': 'earned_news', 'washingtonpost.com': 'earned_news',
  'cnn.com': 'earned_news', 'bbc.com': 'earned_news', 'bbc.co.uk': 'earned_news',
  'reuters.com': 'earned_news', 'bloomberg.com': 'earned_news', 'cnbc.com': 'earned_news',
  'ft.com': 'earned_news', 'theguardian.com': 'earned_news', 'npr.org': 'earned_news',
  'apnews.com': 'earned_news', 'time.com': 'earned_news', 'latimes.com': 'earned_news',

  'trustpilot.com': 'earned_review', 'g2.com': 'earned_review', 'yelp.com': 'earned_review',
  'glassdoor.com': 'earned_review', 'capterra.com': 'earned_review', 'consumerreports.org': 'earned_review',
  'wirecutter.com': 'earned_review', 'sitejabber.com': 'earned_review',

  'reddit.com': 'community', 'quora.com': 'community', 'medium.com': 'community',
  'substack.com': 'community', 'youtube.com': 'community', 'pinterest.com': 'community',
  'twitter.com': 'community', 'x.com': 'community', 'facebook.com': 'community',
  'instagram.com': 'community', 'linkedin.com': 'community', 'tiktok.com': 'community',

  'amazon.com': 'retail', 'nordstrom.com': 'retail', 'zappos.com': 'retail',
  'macys.com': 'retail', 'bloomingdales.com': 'retail', 'target.com': 'retail',
  'walmart.com': 'retail', 'asos.com': 'retail', 'revolve.com': 'retail',
  'net-a-porter.com': 'retail', 'farfetch.com': 'retail', 'ssense.com': 'retail',

  'wikipedia.org': 'reference', 'britannica.com': 'reference', 'investopedia.com': 'reference',
};

function extractDomain(url) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    return host;
  } catch {
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s?#]+)/i);
    return match ? match[1].toLowerCase() : url.toLowerCase();
  }
}

function classifyUrl(url) {
  const domain = extractDomain(url);

  // Client owned
  for (const cd of CLIENT_DOMAINS) {
    if (domain === cd || domain.endsWith(`.${cd}`)) return { url, type: 'owned', domain };
  }
  // Competitor
  for (const cd of COMPETITOR_DOMAINS) {
    if (domain === cd || domain.endsWith(`.${cd}`)) return { url, type: 'competitor', domain };
  }
  // Known domain
  if (DOMAIN_MAP[domain]) return { url, type: DOMAIN_MAP[domain], domain };
  // Parent domain check
  const parts = domain.split('.');
  if (parts.length > 2) {
    const parent = parts.slice(-2).join('.');
    if (DOMAIN_MAP[parent]) return { url, type: DOMAIN_MAP[parent], domain };
  }
  // Heuristics
  if (domain.endsWith('.edu') || domain.endsWith('.gov')) return { url, type: 'reference', domain };
  if (domain.endsWith('.org')) return { url, type: 'reference', domain };
  if (domain.includes('blog') || domain.includes('wordpress') || domain.includes('blogspot')) return { url, type: 'earned_blog', domain };
  if (domain.includes('news') || domain.includes('times') || domain.includes('tribune')) return { url, type: 'earned_news', domain };
  if (domain.includes('review') || domain.includes('rating')) return { url, type: 'earned_review', domain };
  if (domain.includes('forum') || domain.includes('community')) return { url, type: 'community', domain };
  if (domain.includes('shop') || domain.includes('store')) return { url, type: 'retail', domain };

  return { url, type: 'other', domain };
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Citation Source Enrichment');
  console.log('═══════════════════════════════════════════════');

  // Get run IDs
  const { data: runs, error: runsErr } = await supabase
    .from('runs').select('id').eq('client_id', CLIENT_ID);
  if (runsErr || !runs?.length) { console.error('No runs found'); process.exit(1); }
  const runIds = runs.map(r => r.id);

  // Fetch rows with citations but no classified_citations
  let query = supabase
    .from('results')
    .select('id, citations, platform')
    .in('run_id', runIds)
    .or('classified_citations.is.null,classified_citations.eq.[]')
    .not('citations', 'eq', '[]')
    .order('created_at', { ascending: true });

  if (platformFilter) query = query.eq('platform', platformFilter);
  if (limit) query = query.limit(limit);

  const { data: rows, error } = await query;
  if (error) { console.error('Fetch error:', error.message); process.exit(1); }

  console.log(`  Found ${rows.length} rows with unclassified citations`);
  if (rows.length === 0) { console.log('  Nothing to process.'); return; }

  let processed = 0, failed = 0;
  const typeCounts = {};
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      try {
        const citations = Array.isArray(row.citations) ? row.citations : [];
        const classified = citations.map(url => classifyUrl(url));

        // Count types
        for (const c of classified) {
          typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
        }

        const { error: upErr } = await supabase
          .from('results')
          .update({ classified_citations: classified })
          .eq('id', row.id);

        if (upErr) { failed++; } else { processed++; }
      } catch { failed++; }
    }

    if ((processed + failed) % 100 === 0 || i + BATCH_SIZE >= rows.length) {
      console.log(`  Progress: ${processed + failed}/${rows.length} (${processed} ok, ${failed} err)`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  Done in ${duration}s. Processed: ${processed}, Failed: ${failed}`);
  console.log('  Source type distribution:');
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }

  writeFileSync(
    resolve(__dirname, 'citation-source-summary.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), processed, failed, typeCounts, duration }, null, 2)
  );
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
