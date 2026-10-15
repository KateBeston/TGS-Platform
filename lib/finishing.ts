/* ═══════════════════════════════════════════════════════════════════════
   A SESSION THAT HAS NOT FINISHED SIGNING UP

   Clicking a confirmation link signs you in. That is how the link works —
   it redeems a token and mints a session — so by the time /welcome/finish
   renders, the browser is already carrying a live session for an account
   that has not been opened yet.

   Which meant any way off that page left somebody signed in: the TGS mark
   in the header, the browser's back button, the "back to the marketplace"
   link on the page itself, or typing an address. They would be browsing as
   a signed-in member of an account that does not exist yet, with no
   password set and no decision made about the one they had.

   So the session is marked as unfinished the moment the confirmation route
   sends them here, and the proxy ends it if they go anywhere else. The
   mark is cleared when the account is actually opened.

   A cookie rather than a database read, because the proxy runs on every
   request and this question would otherwise cost a query on all of them.
   ═══════════════════════════════════════════════════════════════════════ */

export const FINISHING_COOKIE = 'tgs_finishing';

/** Where the page lives, and the only path this session may be on. */
export const FINISH_PATH = '/welcome/finish';

/** An hour. Longer than finishing takes, short enough that an abandoned
 *  tab does not carry the mark around for a week. */
export const FINISHING_MAX_AGE = 60 * 60;

/** Paths an unfinished session is still allowed to reach.
 *
 *  The page itself, and the auth routes beneath it — a server action
 *  posts back to the page's own path, and signing out has to be able to
 *  run without the guard cutting it off first. Static assets never reach
 *  the proxy. */
export function finishingMayVisit(pathname: string): boolean {
  return pathname === FINISH_PATH
    || pathname.startsWith(`${FINISH_PATH}/`)
    || pathname.startsWith('/auth/');
}
