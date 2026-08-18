/* ActiveCampaign sync — shared by the journal, enquiry, and apply routes.
 *
 * Every call is best-effort and env-gated: with no credentials configured it
 * returns null and the caller carries on, so the CRM being unwired (or down)
 * never costs us the record we have already written to Supabase.
 *
 * Env (all server-side, never NEXT_PUBLIC):
 *   ACTIVECAMPAIGN_API_URL   e.g. https://youraccount.api-us1.com
 *   ACTIVECAMPAIGN_API_KEY   the API key from Settings → Developer
 *   ACTIVECAMPAIGN_LIST_ID   numeric id of the list to subscribe to (per call)
 */

type SyncResult = { contactId: string } | null;

const BASE = process.env.ACTIVECAMPAIGN_API_URL;
const KEY = process.env.ACTIVECAMPAIGN_API_KEY;

function acHeaders(): Record<string, string> {
  return { 'Api-Token': KEY as string, 'Content-Type': 'application/json' };
}

/* Upserts a contact by email (contact/sync never creates duplicates) and, when
 * a list id is supplied, subscribes them to it with an active status. Returns
 * the AC contact id — store it in activecampaign_id — or null if the sync did
 * not run or did not succeed. */
export async function syncContact(
  email: string,
  firstName?: string,
  listId?: string | number,
): Promise<SyncResult> {
  if (!BASE || !KEY) return null;

  try {
    const syncRes = await fetch(`${BASE}/api/3/contact/sync`, {
      method: 'POST',
      headers: acHeaders(),
      body: JSON.stringify({ contact: { email, firstName: firstName || undefined } }),
    });
    if (!syncRes.ok) return null;

    const data = await syncRes.json();
    const contactId = data?.contact?.id;
    if (!contactId) return null;

    if (listId !== undefined && listId !== null && String(listId).trim() !== '') {
      // status 1 = subscribed/active. This is what actually enrols the contact
      // in the list so campaigns reach them; contact/sync alone does not.
      await fetch(`${BASE}/api/3/contactLists`, {
        method: 'POST',
        headers: acHeaders(),
        body: JSON.stringify({
          contactList: { list: Number(listId), contact: Number(contactId), status: 1 },
        }),
      });
    }

    return { contactId: String(contactId) };
  } catch {
    return null;
  }
}
