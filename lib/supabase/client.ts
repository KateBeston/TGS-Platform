import { createBrowserClient } from '@supabase/ssr';

/** The database, from the browser.
 *
 *  Only for things that genuinely need to happen client-side — a live
 *  search, a filter that should not reload the page. Anything that can be
 *  read on the server should be, because a server read is one round trip
 *  and does not ship the query to the visitor.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
