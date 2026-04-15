'use client';

import { setCurrentClientId } from '@/lib/platform-data';

interface Props {
  clientId: string;
  children: React.ReactNode;
}

/**
 * Tells platform-data.ts which Supabase client_id to query. Wrap any subtree
 * that renders components importing from @/lib/platform-data.
 *
 * Uses a render-phase setter (synchronous, idempotent) so child useEffects
 * that call into platform-data see the correct clientId on mount. Effects
 * run inside-out — if we used useEffect here, children's queries would fire
 * before the setter and return empty data.
 *
 * Pair with `key={clientId}` on the caller side to force a full remount of
 * the subtree when the active client changes, so child useEffect-based data
 * fetches re-run.
 */
export function PlatformDataProvider({ clientId, children }: Props) {
  setCurrentClientId(clientId);
  return <>{children}</>;
}
