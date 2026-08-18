import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Whether the environment is set up at all.
 *
 *  Checked rather than asserted. createServerClient throws when the URL
 *  or key is undefined, and it throws before any error handling in a page
 *  can run — so a missing variable becomes a blank server error rather
 *  than a sentence saying which variable is missing.
 */
export function environmentIsReady(): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return { ready: missing.length === 0, missing };
}

/** The database, read from the server.
 *
 *  The platform site never signs anybody in and never writes, so this
 *  uses the anon key and reads the published views. Row level security
 *  does the rest — a query for something not published returns nothing
 *  rather than being refused, which is the behaviour a public site wants.
 */
export async function createClient() {
  const { ready, missing } = environmentIsReady();
  if (!ready) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

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
            const sessionOnly = cookieStore.get('tgs_remember')?.value === '0';
            cookiesToSet.forEach(({ name, value, options }) => {
              const opts = sessionOnly && name.startsWith('sb-')
                ? { ...options, maxAge: undefined, expires: undefined }
                : options;
              cookieStore.set(name, value, opts);
            });
          } catch {
            // Called from a Server Component, where cookies cannot be
            // set. Harmless while nothing signs in.
          }
        },
      },
    },
  );
}
