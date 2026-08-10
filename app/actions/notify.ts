'use server';

import { FROM, send } from '@/lib/notify';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Sends and records, whether it worked or not.
 *
 *  A failed send that leaves no trace is the worst outcome — the person
 *  never gets it and nobody knows. */
async function sendAndRecord(
  kind: string,
  to: string,
  subject: string,
  body: string,
  from: string,
  links: Record<string, number | undefined> = {},
): Promise<Result> {
  const supabase = await createClient();
  const result = await send({ to, subject, body, from });

  await supabase.from('sent_emails').insert({
    kind, to_address: to, from_address: from, subject,
    status: result.ok ? 'Sent' : 'Failed',
    postmark_id: result.ok ? result.id : null,
    error: result.ok ? null : result.error,
    ...links,
  });

  return result.ok
    ? { ok: true, message: `Sent to ${to}.` }
    : { ok: false, error: result.error };
}

/** The invitation, emailed rather than copied.
 *
 *  The link still works if this fails — it is recorded either way and can
 *  be sent by hand. */
export async function emailInvitation(
  invitationId: number, origin: string
): Promise<Result> {
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from('user_invitations')
    .select('*, role_definitions(name,description)')
    .eq('id', invitationId).single();

  if (!inv) return { ok: false, error: 'That invitation could not be found.' };
  if (inv.status !== 'Sent') return { ok: false, error: 'That invitation is no longer open.' };

  const link = `${origin}/join?token=${inv.token}`;
  const name = inv.first_name ? `${inv.first_name},` : 'Hello,';
  const expires = new Date(inv.expires_at).toLocaleDateString('en-AU',
    { day: 'numeric', month: 'long' });

  const body = `
<p>${name}</p>
<p>You have been given access to The Global Sanctum's internal portal as
   <strong>${inv.role_definitions?.name}</strong>.</p>
${inv.message ? `<p>${inv.message}</p>` : ''}
<p style="margin:32px 0;text-align:center;">
  <a href="${link}"
     style="display:inline-block;background:#C4A265;color:#313131;
            padding:14px 32px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;
            font-size:12px;letter-spacing:2px;text-transform:uppercase;">
    Set up your account
  </a>
</p>
<p style="font-size:14px;color:#6B6862;">
  The link works once and expires on ${expires}. If it lapses, ask for another.
</p>
<p style="font-size:14px;color:#6B6862;">
  You will choose your own password — nobody at TGS sees it, and nobody sent you one.
</p>`;

  const result = await sendAndRecord(
    'Invitation', inv.email,
    'Your access to The Global Sanctum',
    body, FROM.login, { invitation_id: invitationId },
  );

  await supabase.from('user_invitations').update(
    result.ok
      ? { emailed_at: new Date().toISOString(), email_failed: null }
      : { email_failed: (result as any).error },
  ).eq('id', invitationId);

  return result;
}

/** Tells whoever watches when access changes.
 *
 *  Silence is the wrong default for something that grants reach over
 *  every venue record. */
export async function notifyAccountChange(
  what: string, detail: string
): Promise<Result> {
  const supabase = await createClient();
  const { data: setting } = await supabase.from('tgs_settings')
    .select('setting_value').eq('setting_key', 'notify_account_changes').maybeSingle();

  const to = setting?.setting_value;
  if (!to) return { ok: true, message: 'Nobody is set to be told.' };

  const body = `
<p><strong>${what}</strong></p>
<p>${detail}</p>
<p style="font-size:14px;color:#6B6862;">
  ${new Date().toLocaleString('en-AU', { dateStyle: 'full', timeStyle: 'short' })}
</p>
<p style="font-size:14px;color:#6B6862;">
  If this was not you, change your password and check who has access.
</p>`;

  return sendAndRecord('Account change', to,
    `Portal access — ${what.toLowerCase()}`, body, FROM.login);
}

export async function emailInvoice(
  invoiceId: number, origin: string
): Promise<Result> {
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from('invoices')
    .select('*, venues(venue_name)')
    .eq('id', invoiceId).single();

  if (!inv) return { ok: false, error: 'That invoice could not be found.' };
  if (!inv.bill_to_email) {
    return { ok: false, error: 'No billing address for that venue.' };
  }

  const { data: lines } = await supabase.from('invoice_lines')
    .select('description,line_total,item_code')
    .eq('invoice_id', invoiceId).order('display_order');

  const rows = (lines ?? []).map((l: any) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E5E2DC;font-size:14px;">
        ${l.description}
        <div style="font-size:11px;color:#8A8781;">${l.item_code ?? ''}</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #E5E2DC;text-align:right;
                 font-size:14px;white-space:nowrap;">
        ${inv.currency} ${Number(l.line_total).toFixed(2)}
      </td>
    </tr>`).join('');

  const body = `
<p>${inv.bill_to_name},</p>
<p>Commission for bookings introduced by The Global Sanctum.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="margin:24px 0;">
  ${rows}
  <tr>
    <td style="padding:14px 0;font-size:15px;"><strong>Total</strong></td>
    <td style="padding:14px 0;text-align:right;font-size:15px;">
      <strong>${inv.currency} ${Number(inv.total).toFixed(2)}</strong>
    </td>
  </tr>
</table>
<p style="font-size:14px;">
  Invoice ${inv.invoice_number} · due
  ${new Date(inv.due_date).toLocaleDateString('en-AU',
    { day: 'numeric', month: 'long', year: 'numeric' })}
</p>
<p style="font-size:14px;color:#6B6862;">
  Every line shows the dates, the rate and the booking total it was calculated from. Reply to
  this message with any query and it will reach the right person.
</p>`;

  return sendAndRecord('Invoice', inv.bill_to_email,
    `${inv.invoice_number} — The Global Sanctum`,
    body, FROM.accounts, { invoice_id: invoiceId, venue_id: inv.venue_id });
}

export async function sentEmails(limit = 100) {
  const supabase = await createClient();
  const { data } = await supabase.from('sent_emails')
    .select('*').order('sent_at', { ascending: false }).limit(limit);
  return data ?? [];
}
