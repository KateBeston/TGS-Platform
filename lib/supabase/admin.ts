import { createClient } from '@supabase/supabase-js';

/* Service-role client — SERVER ONLY. Used for the trusted booking write after
 * the server has validated the request and recomputed every price itself.
 * Never import this into client code. Requires SUPABASE_SERVICE_ROLE_KEY. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role configuration.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
