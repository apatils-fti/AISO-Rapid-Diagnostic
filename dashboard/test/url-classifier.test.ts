import { describe, it, expect } from 'vitest';
import {
  classifyUrl,
  classifyCitations,
  extractDomain,
  type CitationSourceType,
} from '../src/lib/url-classifier';

// ─── Domain Extraction ───────────────────────────────────────

describe('extractDomain', () => {
  it('extracts domain from full URL', () => {
    expect(extractDomain('https://www.nytimes.com/2024/article')).toBe('nytimes.com');
  });

  it('strips www prefix', () => {
    expect(extractDomain('https://www.reddit.com/r/fashion')).toBe('reddit.com');
  });

  it('handles URLs without protocol', () => {
    expect(extractDomain('nytimes.com/article')).toBe('nytimes.com');
  });

  it('handles subdomains', () => {
    expect(extractDomain('https://fashion.vogue.com/trends')).toBe('fashion.vogue.com');
  });

  it('handles malformed URLs gracefully', () => {
    const result = extractDomain('not a url');
    expect(typeof result).toBe('string');
  });
});

// ─── Known Domain Classification ─────────────────────────────

describe('classifyUrl known domains', () => {
  it('classifies editorial publications', () => {
    expect(classifyUrl('https://www.vogue.com/article').type).toBe('earned_editorial');
    expect(classifyUrl('https://gq.com/story').type).toBe('earned_editorial');
    expect(classifyUrl('https://forbes.com/lists').type).toBe('earned_editorial');
  });

  it('classifies news sites', () => {
    expect(classifyUrl('https://nytimes.com/article').type).toBe('earned_news');
    expect(classifyUrl('https://www.cnn.com/story').type).toBe('earned_news');
    expect(classifyUrl('https://reuters.com/world').type).toBe('earned_news');
    expect(classifyUrl('https://www.bbc.co.uk/news').type).toBe('earned_news');
  });

  it('classifies review sites', () => {
    expect(classifyUrl('https://trustpilot.com/review').type).toBe('earned_review');
    expect(classifyUrl('https://www.g2.com/products').type).toBe('earned_review');
    expect(classifyUrl('https://wirecutter.com/best').type).toBe('earned_review');
  });

  it('classifies community sites', () => {
    expect(classifyUrl('https://reddit.com/r/fashion').type).toBe('community');
    expect(classifyUrl('https://www.quora.com/question').type).toBe('community');
    expect(classifyUrl('https://medium.com/article').type).toBe('community');
    expect(classifyUrl('https://youtube.com/watch').type).toBe('community');
  });

  it('classifies retail sites', () => {
    expect(classifyUrl('https://www.amazon.com/dp/123').type).toBe('retail');
    expect(classifyUrl('https://nordstrom.com/s/item').type).toBe('retail');
    expect(classifyUrl('https://www.zappos.com/product').type).toBe('retail');
  });

  it('classifies reference sites', () => {
    expect(classifyUrl('https://en.wikipedia.org/wiki/Topic').type).toBe('reference');
    expect(classifyUrl('https://investopedia.com/terms').type).toBe('reference');
  });
});

// ─── Client & Competitor Domain Classification ───────────────

describe('classifyUrl with client/competitor domains', () => {
  it('classifies client domains as owned', () => {
    const result = classifyUrl('https://jcrew.com/mens/shirts', ['jcrew.com']);
    expect(result.type).toBe('owned');
  });

  it('classifies client subdomains as owned', () => {
    const result = classifyUrl('https://factory.jcrew.com/sale', ['jcrew.com']);
    expect(result.type).toBe('owned');
  });

  it('classifies competitor domains', () => {
    const result = classifyUrl('https://everlane.com/products', [], ['everlane.com']);
    expect(result.type).toBe('competitor');
  });

  it('prioritizes client over competitor', () => {
    const result = classifyUrl('https://jcrew.com/page', ['jcrew.com'], ['jcrew.com']);
    expect(result.type).toBe('owned');
  });

  it('prioritizes client over known domain', () => {
    // If amazon.com were a client domain (hypothetical)
    const result = classifyUrl('https://amazon.com/page', ['amazon.com']);
    expect(result.type).toBe('owned');
  });
});

// ─── Subdomain / Parent Domain Matching ──────────────────────

describe('classifyUrl parent domain matching', () => {
  it('matches parent domain for subdomains of known sites', () => {
    expect(classifyUrl('https://fashion.nytimes.com/article').type).toBe('earned_news');
    expect(classifyUrl('https://old.reddit.com/r/fashion').type).toBe('community');
  });
});

// ─── Heuristic Classification ────────────────────────────────

describe('classifyUrl heuristics', () => {
  it('classifies .edu as reference', () => {
    expect(classifyUrl('https://www.harvard.edu/article').type).toBe('reference');
  });

  it('classifies .gov as reference', () => {
    expect(classifyUrl('https://www.ftc.gov/report').type).toBe('reference');
  });

  it('classifies blog-like domains', () => {
    expect(classifyUrl('https://fashionblogger.wordpress.com/post').type).toBe('earned_blog');
  });

  it('classifies news-like domains by name pattern', () => {
    expect(classifyUrl('https://dailynews.example.com/article').type).toBe('earned_news');
  });

  it('classifies forum-like domains', () => {
    expect(classifyUrl('https://forum.example.com/thread').type).toBe('community');
  });

  it('returns other for unknown domains', () => {
    expect(classifyUrl('https://randomsite12345.com/page').type).toBe('other');
  });
});

// ─── Batch Classification ────────────────────────────────────

describe('classifyCitations', () => {
  it('classifies multiple URLs', () => {
    const urls = [
      'https://nytimes.com/article',
      'https://reddit.com/r/fashion',
      'https://jcrew.com/sale',
    ];
    const results = classifyCitations(urls, ['jcrew.com']);
    expect(results).toHaveLength(3);
    expect(results[0].type).toBe('earned_news');
    expect(results[1].type).toBe('community');
    expect(results[2].type).toBe('owned');
  });

  it('handles empty array', () => {
    expect(classifyCitations([])).toEqual([]);
  });
});
