import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Refreshes the auth session on every request and bounces anyone
 *  unauthenticated to /login. Every table in the portal is granted to
 *  `authenticated` only, so an unauthenticated page would render empty. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Recovery routes must be reachable without a session, or the emailed
  // reset link bounces the user straight back to sign-in.
  const path = request.nextUrl.pathname;

  // A recovery code arriving anywhere other than /reset.
  //
  // Supabase falls back to the Site URL when a requested redirect is not
  // on its allow list, and it does so silently — so the code lands on the
  // root, the root is not public, and the person is bounced to login with
  // the code discarded. The link was valid; nothing said otherwise.
  //
  // Carried to /reset rather than trusted to configuration, because the
  // failure is invisible and the cost of being wrong is somebody locked
  // out.
  const code = request.nextUrl.searchParams.get('code');
  if (code && !path.startsWith('/reset') && !path.startsWith('/join')) {
    const url = request.nextUrl.clone();
    url.pathname = '/reset';
    return NextResponse.redirect(url);
  }

  const isPublic = ['/login', '/forgot', '/reset', '/join'].some((p) => path.startsWith(p));
  const isMfa = path.startsWith('/mfa');
  const isLogin = path.startsWith('/login');

  if (!user && !isPublic && !isMfa) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  // Second factor. currentLevel aal1 with nextLevel aal2 means the account
  // has a verified authenticator and this session has not used it yet.
  // Enforced here rather than in the interface, so it cannot be skipped by
  // navigating straight to a URL.
  if (user && !isPublic && !isMfa) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    // A factor exists and this session has not used it.
    if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
      const url = request.nextUrl.clone();
      url.pathname = '/mfa';
      return NextResponse.redirect(url);
    }

    // Required by the role and never set up.
    //
    // nextLevel only reaches aal2 once a factor exists, so the check
    // above asks for a code from people who already enrolled and never
    // asks anybody else. Without this, requires_2fa on five roles means
    // nothing at all.
    //
    // Past the deadline only — a grace period, because requiring it the
    // moment an account is created means somebody sets it up on a
    // borrowed phone in a hurry.
    if (aal?.nextLevel !== 'aal2' && !path.startsWith('/account')) {
      const { data: status } = await supabase
        .from('mfa_status')
        .select('required,enrolled,mfa_required_from')
        .eq('email', user.email)
        .maybeSingle();

      if (status?.required && !status.enrolled
          && status.mfa_required_from
          && new Date(status.mfa_required_from) < new Date()) {
        const url = request.nextUrl.clone();
        url.pathname = '/account';
        url.searchParams.set('setup', 'mfa');
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
