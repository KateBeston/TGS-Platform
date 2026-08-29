import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Refreshes the auth session cookie on each request so a signed-in
 *  visitor stays signed in. Standard Supabase SSR pattern.
 *
 *  `base` lets the caller hand in a response it has already built — the locale
 *  rewrite, for instance — so the session cookies land on that response rather
 *  than on a fresh one that would discard the rewrite. `extraHeaders` carries
 *  request headers the proxy has added, so they survive the internal
 *  NextResponse.next() calls below. */
export async function updateSession(
  request: NextRequest,
  base?: NextResponse,
  extraHeaders?: Headers,
) {
  const nextInit = () => (extraHeaders
    ? NextResponse.next({ request: { headers: extraHeaders } })
    : NextResponse.next({ request }));

  let response = base ?? nextInit();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          if (!base) response = nextInit();
          const sessionOnly = request.cookies.get('tgs_remember')?.value === '0';
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts = sessionOnly && name.startsWith('sb-')
              ? { ...options, maxAge: undefined, expires: undefined }
              : options;
            response.cookies.set(name, value, opts);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}
