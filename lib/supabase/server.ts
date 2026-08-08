import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** The database, read from the server.
 *
 *  The platform site never signs anybody in and never writes, so this
 *  uses the anon key and reads the published views. Row level security
 *  does the rest — a query for something not published returns nothing
 *  rather than being refused, which is the behaviour a public site wants.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: {
          name: string; value: string; options: CookieOptions;
        }[]) {
          // Nothing signs in here yet, so there is nothing to persist.
          // Kept so adding accounts later does not mean rewriting this.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies cannot be
            // set. Harmless while nothing signs in.
          }
        },
      },
    },
  );
}
