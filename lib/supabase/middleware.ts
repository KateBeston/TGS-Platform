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

/** Ends a session that walked away from finishing its sign-up.
 *
 *  A real sign-out rather than deleting the cookies by hand: the refresh
 *  token is revoked at Supabase, so the session cannot be resumed from a
 *  copy of the cookie. The deletions Supabase emits are written onto the
 *  response we hand back, which is the redirect.
 *
 *  Never throws. Somebody clicking the logo must end up on the home page
 *  whatever the network did, and signed out is the safe failure either
 *  way — the cookies are cleared below regardless. */
export async function endUnfinishedSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });
    try { await supabase.auth.signOut(); } catch { /* cleared below anyway */ }
  }

  /* Belt and braces. If the sign-out could not be reached, the browser
     still leaves holding nothing. */
  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith('sb-')) response.cookies.delete(c.name);
  }

  return response;
}
