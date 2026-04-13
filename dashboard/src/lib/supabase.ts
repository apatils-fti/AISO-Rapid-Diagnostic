import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
    'Add them to dashboard/.env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface EnrichedResult {
  id: string;
  client_id: string;
  prompt_id: string;
  platform: string;
  response_text: string;
  client_mentioned: boolean;
  isotope: string;
  topic_name: string;
  sentiment: string | null;
  recommendation_strength: string;
  cta_present: boolean;
  decision_criteria_winner: boolean;
  conversion_intent: string;
  citations: string[];
  created_at: string;
}

export async function getEnrichedResults(
  clientId: string,
  platform?: string
): Promise<EnrichedResult[]> {
  let query = supabase
    .from('results')
    .select('*')
    .eq('client_id', clientId)
    .not('sentiment', 'is', null);

  if (platform && platform !== 'all') {
    query = query.eq('platform', platform);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Supabase query failed:', error.message);
    return [];
  }

  return (data ?? []) as EnrichedResult[];
}

export async function getAvailablePlatforms(clientId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('results')
    .select('platform')
    .eq('client_id', clientId)
    .not('sentiment', 'is', null);

  if (error || !data) return [];

  const platforms = [...new Set(data.map((r: { platform: string }) => r.platform))];
  return platforms.sort();
}
