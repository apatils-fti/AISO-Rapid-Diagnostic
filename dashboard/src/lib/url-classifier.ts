/**
 * URL Citation Source Classifier
 *
 * Classifies citation URLs into source types for Trust pillar analysis.
 * Uses a domain lookup table (~150 known domains) with heuristic fallback.
 */

export type CitationSourceType =
  | 'owned'
  | 'earned_editorial'
  | 'earned_blog'
  | 'earned_news'
  | 'earned_review'
  | 'community'
  | 'retail'
  | 'competitor'
  | 'reference'
  | 'other';

export interface ClassifiedCitation {
  url: string;
  type: CitationSourceType;
  domain: string;
}

// ─── Known Domain Lookup Table ───────────────────────────────

const DOMAIN_MAP: Record<string, CitationSourceType> = {
  // Editorial / fashion & lifestyle publications
  'vogue.com': 'earned_editorial',
  'gq.com': 'earned_editorial',
  'esquire.com': 'earned_editorial',
  'elle.com': 'earned_editorial',
  'harpersbazaar.com': 'earned_editorial',
  'instyle.com': 'earned_editorial',
  'wmagazine.com': 'earned_editorial',
  'allure.com': 'earned_editorial',
  'glamour.com': 'earned_editorial',
  'cosmopolitan.com': 'earned_editorial',
  'refinery29.com': 'earned_editorial',
  'whowhatwear.com': 'earned_editorial',
  'thecut.com': 'earned_editorial',
  'manrepeller.com': 'earned_editorial',
  'fashionista.com': 'earned_editorial',
  'businessoffashion.com': 'earned_editorial',
  'wwd.com': 'earned_editorial',
  'forbes.com': 'earned_editorial',
  'fortune.com': 'earned_editorial',
  'inc.com': 'earned_editorial',
  'hbr.org': 'earned_editorial',
  'theatlantic.com': 'earned_editorial',
  'newyorker.com': 'earned_editorial',
  'wired.com': 'earned_editorial',
  'fastcompany.com': 'earned_editorial',
  'vanityfair.com': 'earned_editorial',
  'rollingstone.com': 'earned_editorial',

  // News sites
  'nytimes.com': 'earned_news',
  'wsj.com': 'earned_news',
  'washingtonpost.com': 'earned_news',
  'cnn.com': 'earned_news',
  'bbc.com': 'earned_news',
  'bbc.co.uk': 'earned_news',
  'reuters.com': 'earned_news',
  'apnews.com': 'earned_news',
  'bloomberg.com': 'earned_news',
  'cnbc.com': 'earned_news',
  'ft.com': 'earned_news',
  'theguardian.com': 'earned_news',
  'usatoday.com': 'earned_news',
  'nbcnews.com': 'earned_news',
  'abcnews.go.com': 'earned_news',
  'foxnews.com': 'earned_news',
  'time.com': 'earned_news',
  'politico.com': 'earned_news',
  'axios.com': 'earned_news',
  'thehill.com': 'earned_news',
  'npr.org': 'earned_news',
  'pbs.org': 'earned_news',
  'latimes.com': 'earned_news',
  'chicagotribune.com': 'earned_news',
  'nypost.com': 'earned_news',

  // Review sites
  'trustpilot.com': 'earned_review',
  'g2.com': 'earned_review',
  'yelp.com': 'earned_review',
  'glassdoor.com': 'earned_review',
  'capterra.com': 'earned_review',
  'tripadvisor.com': 'earned_review',
  'sitejabber.com': 'earned_review',
  'consumerreports.org': 'earned_review',
  'wirecutter.com': 'earned_review',
  'theknot.com': 'earned_review',
  'bbb.org': 'earned_review',
  'influenster.com': 'earned_review',

  // Community / forums
  'reddit.com': 'community',
  'quora.com': 'community',
  'stackexchange.com': 'community',
  'stackoverflow.com': 'community',
  'discourse.org': 'community',
  'medium.com': 'community',
  'substack.com': 'community',
  'tumblr.com': 'community',
  'facebook.com': 'community',
  'twitter.com': 'community',
  'x.com': 'community',
  'instagram.com': 'community',
  'pinterest.com': 'community',
  'tiktok.com': 'community',
  'youtube.com': 'community',
  'linkedin.com': 'community',

  // Retail
  'amazon.com': 'retail',
  'nordstrom.com': 'retail',
  'zappos.com': 'retail',
  'macys.com': 'retail',
  'bloomingdales.com': 'retail',
  'saksoff5th.com': 'retail',
  'saksfifthavenue.com': 'retail',
  'neimanmarcus.com': 'retail',
  'target.com': 'retail',
  'walmart.com': 'retail',
  'ebay.com': 'retail',
  'etsy.com': 'retail',
  'shopify.com': 'retail',
  'asos.com': 'retail',
  'revolve.com': 'retail',
  'ssense.com': 'retail',
  'mrporter.com': 'retail',
  'net-a-porter.com': 'retail',
  'farfetch.com': 'retail',
  'anthropologie.com': 'retail',
  'urbanoutfitters.com': 'retail',
  'freepeople.com': 'retail',

  // Reference
  'wikipedia.org': 'reference',
  'britannica.com': 'reference',
  'merriam-webster.com': 'reference',
  'investopedia.com': 'reference',
  'healthline.com': 'reference',
  'mayoclinic.org': 'reference',
  'webmd.com': 'reference',

  // Consulting / advisory specific (for FTI archetype)
  'mckinsey.com': 'competitor',
  'deloitte.com': 'competitor',
  'alixpartners.com': 'competitor',
  'kroll.com': 'competitor',
  'alvarezandmarsal.com': 'competitor',
  'accenture.com': 'competitor',
  'pwc.com': 'competitor',
  'ey.com': 'competitor',
  'kpmg.com': 'competitor',
  'bcg.com': 'competitor',
  'bain.com': 'competitor',

  // Fashion competitors (for J.Crew archetype)
  'bananarepublic.com': 'competitor',
  'gap.com': 'competitor',
  'everlane.com': 'competitor',
  'abercrombie.com': 'competitor',
  'clubmonaco.com': 'competitor',
  'uniqlo.com': 'competitor',
  'hm.com': 'competitor',
  'zara.com': 'competitor',
  'mango.com': 'competitor',
  'brooksbrothers.com': 'competitor',
  'ralphlauren.com': 'competitor',
  'tommyhilfiger.com': 'competitor',
  'calvinklein.com': 'competitor',
  'lululemon.com': 'competitor',
};

// ─── Domain Extraction ───────────────────────────────────────

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    let host = parsed.hostname.toLowerCase();
    // Strip www.
    if (host.startsWith('www.')) host = host.slice(4);
    return host;
  } catch {
    // Fallback: try to extract domain from string
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s?#]+)/i);
    return match ? match[1].toLowerCase() : url.toLowerCase();
  }
}

// ─── Heuristic Classification ────────────────────────────────

function classifyByHeuristic(domain: string): CitationSourceType {
  // .edu domains → reference
  if (domain.endsWith('.edu')) return 'reference';
  // .gov domains → reference
  if (domain.endsWith('.gov') || domain.endsWith('.gov.uk')) return 'reference';
  // .org with known patterns → reference
  if (domain.endsWith('.org') && !DOMAIN_MAP[domain]) return 'reference';

  // Blog-like patterns
  if (domain.includes('blog') || domain.includes('wordpress') || domain.includes('blogspot') || domain.includes('ghost.io')) {
    return 'earned_blog';
  }

  // News-like patterns
  if (domain.includes('news') || domain.includes('times') || domain.includes('post') || domain.includes('herald') || domain.includes('tribune') || domain.includes('gazette')) {
    return 'earned_news';
  }

  // Review-like patterns
  if (domain.includes('review') || domain.includes('rating') || domain.includes('compare')) {
    return 'earned_review';
  }

  // Forum-like patterns
  if (domain.includes('forum') || domain.includes('community') || domain.includes('discuss')) {
    return 'community';
  }

  // Shop-like patterns
  if (domain.includes('shop') || domain.includes('store') || domain.includes('buy')) {
    return 'retail';
  }

  return 'other';
}

// ─── Main Classifier ─────────────────────────────────────────

export function classifyUrl(
  url: string,
  clientDomains: string[] = [],
  competitorDomains: string[] = []
): ClassifiedCitation {
  const domain = extractDomain(url);

  // Check client domains first (owned)
  for (const cd of clientDomains) {
    const cleanClient = cd.toLowerCase().replace(/^www\./, '');
    if (domain === cleanClient || domain.endsWith(`.${cleanClient}`)) {
      return { url, type: 'owned', domain };
    }
  }

  // Check competitor domains
  for (const cd of competitorDomains) {
    const cleanComp = cd.toLowerCase().replace(/^www\./, '');
    if (domain === cleanComp || domain.endsWith(`.${cleanComp}`)) {
      return { url, type: 'competitor', domain };
    }
  }

  // Check known domain lookup
  const knownType = DOMAIN_MAP[domain];
  if (knownType) {
    return { url, type: knownType, domain };
  }

  // Check parent domain (e.g., fashion.nytimes.com → nytimes.com)
  const parts = domain.split('.');
  if (parts.length > 2) {
    const parentDomain = parts.slice(-2).join('.');
    const parentType = DOMAIN_MAP[parentDomain];
    if (parentType) {
      return { url, type: parentType, domain };
    }
  }

  // Heuristic fallback
  const heuristicType = classifyByHeuristic(domain);
  return { url, type: heuristicType, domain };
}

/**
 * Classify an array of citation URLs.
 */
export function classifyCitations(
  urls: string[],
  clientDomains: string[] = [],
  competitorDomains: string[] = []
): ClassifiedCitation[] {
  return urls.map(url => classifyUrl(url, clientDomains, competitorDomains));
}
