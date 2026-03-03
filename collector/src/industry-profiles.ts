/**
 * Industry Profiles
 *
 * Different industries have different citation behaviors in AI search.
 * - Fashion brands are rarely cited directly (AI cites media/review sites)
 * - SaaS companies are frequently cited (docs, blogs, pricing pages)
 * - Finance companies fall somewhere in between
 *
 * These profiles define metric weights for each industry type.
 */

export interface IndustryProfile {
  id: string;
  name: string;
  description: string;
  metrics: {
    /** Weight for domain citations (brand.com being cited) */
    domainCitationWeight: number;
    /** Weight for brand mentions in response text */
    brandMentionWeight: number;
    /** Weight for being mentioned first vs competitors */
    positionWeight: number;
    /** Weight for share of voice (mentions vs competitors) */
    shareOfVoiceWeight: number;
  };
  /** Expected citation behavior for this industry */
  citationExpectation: 'high' | 'medium' | 'low';
  /** Example brands in this industry */
  examples: string[];
}

/**
 * Predefined industry profiles with metric weights.
 * Weights should sum to 100 for scoring normalization.
 */
export const industryProfiles: Record<string, IndustryProfile> = {
  'fashion-apparel': {
    id: 'fashion-apparel',
    name: 'Fashion & Apparel',
    description: 'Clothing, accessories, and lifestyle brands. AI typically cites fashion media (GQ, Vogue, Harper\'s Bazaar) rather than brand sites.',
    metrics: {
      domainCitationWeight: 15,   // Low - brand sites rarely cited
      brandMentionWeight: 35,     // High - being mentioned matters most
      positionWeight: 25,         // Medium - being first in lists matters
      shareOfVoiceWeight: 25,     // Medium - competitive positioning
    },
    citationExpectation: 'low',
    examples: ['J.Crew', 'Banana Republic', 'Everlane', 'Zara', 'H&M'],
  },

  'saas-software': {
    id: 'saas-software',
    name: 'SaaS & Software',
    description: 'Software products and platforms. AI frequently cites product docs, blogs, and comparison pages.',
    metrics: {
      domainCitationWeight: 40,   // High - docs/blogs get cited
      brandMentionWeight: 25,     // Medium - still matters
      positionWeight: 20,         // Medium - position in comparisons
      shareOfVoiceWeight: 15,     // Lower - category more fragmented
    },
    citationExpectation: 'high',
    examples: ['Asana', 'Monday.com', 'Notion', 'Slack', 'Figma'],
  },

  'finance-banking': {
    id: 'finance-banking',
    name: 'Finance & Banking',
    description: 'Banks, financial services, and fintech. Mix of official sources and financial media citations.',
    metrics: {
      domainCitationWeight: 30,   // Medium - some official sources cited
      brandMentionWeight: 30,     // Medium - brand recognition important
      positionWeight: 20,         // Medium - trust signals matter
      shareOfVoiceWeight: 20,     // Medium - competitive market
    },
    citationExpectation: 'medium',
    examples: ['Chase', 'Capital One', 'Chime', 'Robinhood', 'Fidelity'],
  },

  'healthcare-pharma': {
    id: 'healthcare-pharma',
    name: 'Healthcare & Pharma',
    description: 'Healthcare providers, pharmaceutical companies, and health tech. AI cites medical sources and official sites.',
    metrics: {
      domainCitationWeight: 45,   // High - official medical sources preferred
      brandMentionWeight: 25,     // Medium - brand matters for consumer
      positionWeight: 15,         // Lower - trust over ranking
      shareOfVoiceWeight: 15,     // Lower - specialized recommendations
    },
    citationExpectation: 'high',
    examples: ['CVS', 'Walgreens', 'Pfizer', 'Teladoc', 'One Medical'],
  },

  'retail-ecommerce': {
    id: 'retail-ecommerce',
    name: 'Retail & E-commerce',
    description: 'Online retailers and marketplaces. Mix of direct citations and review site references.',
    metrics: {
      domainCitationWeight: 25,   // Medium - product pages sometimes cited
      brandMentionWeight: 30,     // High - brand recognition
      positionWeight: 25,         // High - ranking in shopping queries
      shareOfVoiceWeight: 20,     // Medium - competitive landscape
    },
    citationExpectation: 'medium',
    examples: ['Amazon', 'Target', 'Walmart', 'Best Buy', 'Costco'],
  },

  'travel-hospitality': {
    id: 'travel-hospitality',
    name: 'Travel & Hospitality',
    description: 'Hotels, airlines, and travel services. AI often cites travel media and booking platforms.',
    metrics: {
      domainCitationWeight: 20,   // Low-Medium - aggregators dominate
      brandMentionWeight: 35,     // High - brand loyalty important
      positionWeight: 25,         // High - recommendations matter
      shareOfVoiceWeight: 20,     // Medium - category visibility
    },
    citationExpectation: 'low',
    examples: ['Marriott', 'Hilton', 'Delta', 'Airbnb', 'Expedia'],
  },

  'food-beverage': {
    id: 'food-beverage',
    name: 'Food & Beverage',
    description: 'Restaurants, food brands, and beverage companies. AI cites food media and reviews.',
    metrics: {
      domainCitationWeight: 15,   // Low - food media dominates
      brandMentionWeight: 40,     // Very high - brand recognition
      positionWeight: 25,         // High - recommendations drive choice
      shareOfVoiceWeight: 20,     // Medium - competitive mentions
    },
    citationExpectation: 'low',
    examples: ['Starbucks', 'Chipotle', 'Coca-Cola', 'Sweetgreen', 'DoorDash'],
  },

  'default': {
    id: 'default',
    name: 'General',
    description: 'Default profile for industries without specific configuration.',
    metrics: {
      domainCitationWeight: 25,
      brandMentionWeight: 30,
      positionWeight: 25,
      shareOfVoiceWeight: 20,
    },
    citationExpectation: 'medium',
    examples: [],
  },
};

/**
 * Get an industry profile by ID, falling back to default if not found.
 */
export function getIndustryProfile(industryId: string): IndustryProfile {
  return industryProfiles[industryId] ?? industryProfiles['default'];
}

/**
 * List all available industry IDs.
 */
export function listIndustryIds(): string[] {
  return Object.keys(industryProfiles).filter(id => id !== 'default');
}

/**
 * Validate that metric weights sum to 100.
 */
export function validateIndustryProfile(profile: IndustryProfile): boolean {
  const { domainCitationWeight, brandMentionWeight, positionWeight, shareOfVoiceWeight } = profile.metrics;
  const sum = domainCitationWeight + brandMentionWeight + positionWeight + shareOfVoiceWeight;
  return sum === 100;
}
