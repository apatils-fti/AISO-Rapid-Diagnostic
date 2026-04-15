import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/**
 * Browser-safe client using the anon key (read-only via RLS).
 * Returns null if env vars are not configured.
 */
export const supabaseAnon: SupabaseClient | null =
  url && anonKey && !anonKey.startsWith('<')
    ? createClient(url, anonKey)
    : null;

/**
 * Server-side client using the service role key (full write access).
 * Returns null if env vars are not configured.
 */
export const supabaseService: SupabaseClient | null =
  url && serviceKey && !serviceKey.startsWith('<')
    ? createClient(url, serviceKey)
    : null;
