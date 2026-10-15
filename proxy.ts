import { NextResponse, type NextRequest } from 'next/server';
import { updateSession, endUnfinishedSession } from '@/lib/supabase/middleware';
import { DEFAULT_LOCALE, LOCALES, localeFromPath, stripLocale } from '@/lib/i18n/config';
import { FINISHING_COOKIE, finishingMayVisit } from '@/lib/finishing';

// Renamed from middleware.ts per Next.js 16 (the middleware file convention is
// deprecated and renamed to proxy). Refreshes the Supabase auth session on each
// request, and now also resolves the language.
//
// Locale handling is a rewrite, not a route change. /fr/venues is rewritten to
// /venues with an x-tgs-locale header, so the whole route tree stays exactly
// where it is and every published URL keeps working. English carries no prefix,
// which is what makes that possible: the nested
// /continent/country/state/city structure is permanent once published, and
// putting English at /en/ would rewrite all of it.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const prefix = localeFromPath(pathname);

  /* A SESSION THAT WALKED AWAY FROM FINISHING ITS SIGN-UP IS ENDED.
   *
   * Clicking a confirmation link signs you in — that is what redeeming the
   * token does — so /welcome/finish renders with a live session for an
   * account that has not been opened yet. Leaving that page by the TGS
   * mark in the header, the back button, or the address bar therefore put
   * somebody into the marketplace signed in, with no password set and no
   * decision made about the one they already had.
   *
   * Checked before the locale rewrite and before the session refresh, so
   * it catches /fr/… as readily as /…, and so nothing downstream gets to
   * treat the session as live first. The cookie is set by /auth/confirm
   * and cleared when the account is opened; see lib/finishing.ts. */
  if (request.cookies.has(FINISHING_COOKIE)
      && !finishingMayVisit(stripLocale(pathname))) {
    const home = request.nextUrl.clone();
    home.pathname = prefix ? `/${prefix}` : '/';
    home.search = '';
    const out = NextResponse.redirect(home);
    out.cookies.delete(FINISHING_COOKIE);
    return endUnfinishedSession(request, out);
  }

  if (prefix) {
    const enabled = LOCALES.find((l) => l.code === prefix)?.enabled;

    // A prefix for a language we do not serve yet is a dead URL. Send it to the
    // English page rather than a 404, so an early link or a stale share still
    // lands somewhere real.
    const target = request.nextUrl.clone();
    target.pathname = stripLocale(pathname);

    if (!enabled) {
      return NextResponse.redirect(target);
    }

    const headers = new Headers(request.headers);
    headers.set('x-tgs-locale', prefix);
    headers.set('x-tgs-path', stripLocale(pathname) + (search || ''));

    const rewritten = NextResponse.rewrite(target, { request: { headers } });
    rewritten.cookies.set('tgs_locale', prefix, {
      path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax',
    });
    return await updateSession(request, rewritten);
  }

  // No prefix means English. Said explicitly rather than left to the cookie:
  // a visitor who chose French once and then opens an English link wants the
  // English link, not a silent redirect back to French.
  const headers = new Headers(request.headers);
  headers.set('x-tgs-locale', DEFAULT_LOCALE);
  headers.set('x-tgs-path', pathname + (search || ''));

  return await updateSession(request, undefined, headers);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
