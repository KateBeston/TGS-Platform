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
