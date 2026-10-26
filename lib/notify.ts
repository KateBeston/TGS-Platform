/* Asking the portal to send.
 *
 * Everything about email lives in the portal: the templates, the versions, the
 * merge layer, the suppression list, the send log. The platform does not
 * duplicate any of it. It says which template and about which record, and the
 * portal does the rest.
 *
 * That is the whole point of building it there. A booking confirmation is a
 * template Kate can edit, not code somebody has to change, and every send from
 * either app lands in the same log.
 */

type SendRequest = {
  /* The template slug in the portal's library. */
  slug: string;
  to: string;
  /* The record it is about: a booking id, an enquiry id. The portal merges
     against it. */
  subjectId?: number | null;
  /* Anything the record does not hold, such as a one-time link. */
  extra?: Record<string, unknown>;
};

const PORTAL = process.env.PORTAL_URL ?? 'https://portal.theglobalsanctum.com';

export async function requestSend(input: SendRequest): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error('[notify] INTERNAL_API_SECRET is not set; nothing sent.');
    return { ok: false, error: 'No internal secret configured.' };
  }

  try {
    const res = await fetch(`${PORTAL}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(input),
      /* A slow portal must not hold up a booking confirmation screen. */
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json().catch(() => ({ ok: false, error: 'Unreadable reply' }));
    if (!json.ok) console.error('[notify] portal refused:', input.slug, json.error);
    return json;
  } catch (e) {
    console.error('[notify] could not reach the portal:', e);
    return { ok: false, error: String(e) };
  }
}

/* Fire and forget.
 *
 * Called after the record is written. If the portal is unreachable the booking
 * still exists and the failure is in the log; the alternative is a guest
 * seeing an error for something that already succeeded. */
export function notify(input: SendRequest): void {
  requestSend(input).catch((e) => console.error('[notify] unhandled:', e));
}

/* Where internal alerts go. One place, so it changes once. */
export const INTERNAL = process.env.INTERNAL_ALERT_EMAIL ?? 'hello@theglobalsanctum.com';

/* ═══════════════════════════════════════════════════════════════════════
   ASKING A VENUE TO CONFIRM

   Separate from requestSend because it is not a template send. The venue's
   question is built from the booking's own lines, the venue's check-in
   times and its flexibility — by askVenueToConfirm, in the portal, next to
   the template library. This asks for that to happen; it does not rebuild
   it here.

   Called after place_booking has already opened the request and held the
   dates, so by the time this runs the booking is live either way. Which is
   why, like notify above, a failure is logged rather than raised: a guest
   must not see an error for a booking that already succeeded.
   ═══════════════════════════════════════════════════════════════════════ */

type AskVenue = {
  /** The request place_booking opened. */
  requestId: number;
  /** The one-time token the venue's yes and no links carry. */
  token: string;
  /** Where it goes, as send_booking_request resolved it. Passed on rather
   *  than worked out again: the portal already decided whether a venue's
   *  post goes to its bookings address or its own, and two places deciding
   *  that is one too many. */
  to: string;
};

export async function askVenueToConfirm(
  input: AskVenue,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error('[ask-venue] INTERNAL_API_SECRET is not set; nobody asked.');
    return { ok: false, error: 'No internal secret configured.' };
  }

  try {
    const res = await fetch(`${PORTAL}/api/ask-venue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(input),
      /* Same budget as a send. A slow portal must not hold up the screen
         that tells a guest their booking is in. */
      signal: AbortSignal.timeout(8000),
    });
    const json = await res.json().catch(() => ({ ok: false, error: 'Unreadable reply' }));
    if (!json.ok) console.error('[ask-venue] portal refused:', input.requestId, json.error);
    return json;
  } catch (e) {
    console.error('[ask-venue] could not reach the portal:', e);
    return { ok: false, error: String(e) };
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   TELLING THE PORTAL SOMETHING HAPPENED

   Separate from requestSend because they are different acts. One asks for
   an email to go to a customer; this one raises an alert inside TGS — a
   push notification, folded and filtered by the portal's own rules about
   who wants telling and when.

   The portal is the system of record. Something that happens on the
   platform and is never reported to it is something nobody finds out
   about until they go looking.
   ═══════════════════════════════════════════════════════════════════════ */

type PortalEvent = {
  /** A key the portal knows. An unknown one is refused and named. */
  event: string;
  title?: string;
  body?: string;
  /** Where tapping the notification should land, as a portal path. */
  url?: string;
  amount?: number;
};

export async function tellPortal(input: PortalEvent): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.EVENTS_SHARED_SECRET;
  if (!secret) {
    console.error('[events] EVENTS_SHARED_SECRET is not set; nothing reported.');
    return { ok: false, error: 'No events secret configured.' };
  }

  try {
    const res = await fetch(`${PORTAL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(input),
      /* Shorter than the send timeout. An alert is worth less than the
         thing that caused it, and must never hold up a page. */
      signal: AbortSignal.timeout(4000),
    });
    const json = await res.json().catch(() => ({ ok: false, error: 'Unreadable reply' }));
    if (!json.ok) console.error('[events] portal refused:', input.event, json.error);
    return json;
  } catch (e) {
    console.error('[events] could not reach the portal:', e);
    return { ok: false, error: String(e) };
  }
}

/* Fire and forget, for the same reason as notify above: the thing that
   happened already happened, and a person should not see an error for it
   because an alert could not be delivered. */
export function report(input: PortalEvent): void {
  tellPortal(input).catch((e) => console.error('[events] unhandled:', e));
}
