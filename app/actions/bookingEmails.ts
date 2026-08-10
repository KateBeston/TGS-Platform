'use server';

import { buildInvite } from '@/lib/ical';
import { send } from '@/lib/notify';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const BOOKINGS = 'The Global Sanctum <bookings@theglobalsanctum.com>';

const money = (n: number | null, currency: string | null) =>
  n == null ? '' : `${currency ?? ''} ${Number(n).toLocaleString('en-AU',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();

const when = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-AU',
  { day: 'numeric', month: 'long', year: 'numeric' });

/** Asks a venue to confirm, with the answer one tap away.
 *
 *  No login. A venue will not create an account to answer one request,
 *  and asking them to means they reply in prose instead and nothing is
 *  recorded — which is worse than a link somebody might forward.
 */
export async function askVenueToConfirm(
  requestId: number, token: string, origin: string
): Promise<Result> {
  const supabase = await createClient();

  const { data: r } = await supabase.from('booking_requests')
    .select('*, venues(venue_name,bookings_email,contact_email,contact_first_name)')
    .eq('id', requestId).single();

  if (!r) return { ok: false, error: 'No such request.' };

  const v = r.venues as any;
  const to = v?.bookings_email ?? v?.contact_email;
  if (!to) return { ok: false, error: `No email recorded for ${v?.venue_name}.` };

  const yes = `${origin}/confirm/${token}?answer=yes`;
  const no = `${origin}/confirm/${token}?answer=no`;
  const nights = Math.round(
    (new Date(r.date_to).getTime() - new Date(r.date_from).getTime()) / 86_400_000);

  const body = `
<p>${v.contact_first_name ? `Hello ${v.contact_first_name},` : 'Hello,'}</p>

<p>We have a booking request for ${v.venue_name} and would like to know
whether you can take it.</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
       style="margin:24px 0;border-top:1px solid #E5E2DC;">
  ${[
    ['Dates', `${when(r.date_from)} to ${when(r.date_to)}`],
    ['Nights', String(nights)],
    ['Guests', r.guest_count ? String(r.guest_count) : null],
    ['What for', r.what_they_want],
    ['Exclusive use', r.is_exclusive_use ? 'Yes' : null],
    ['Quoted', r.quoted_total ? money(r.quoted_total, r.currency) : null],
    ['Reference', r.reference],
  ].filter(([, v2]) => v2).map(([label, value]) => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #E5E2DC;width:38%;
               font-family:Helvetica,Arial,sans-serif;font-size:11px;
               letter-spacing:1.5px;text-transform:uppercase;color:#8A8781;
               vertical-align:top;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #E5E2DC;
               font-size:15px;color:#313131;">${value}</td>
  </tr>`).join('')}
</table>

<table role="presentation" cellpadding="0" cellspacing="0"
       style="margin:28px 0;">
<tr>
  <td style="padding-right:12px;">
    <a href="${yes}" style="display:inline-block;padding:14px 30px;
       background:#313131;color:#FDFCF9;text-decoration:none;
       font-family:Helvetica,Arial,sans-serif;font-size:12px;
       letter-spacing:2px;text-transform:uppercase;">Yes, we can take it</a>
  </td>
  <td>
    <a href="${no}" style="display:inline-block;padding:14px 30px;
       background:#FDFCF9;color:#313131;text-decoration:none;
       border:1px solid #313131;
       font-family:Helvetica,Arial,sans-serif;font-size:12px;
       letter-spacing:2px;text-transform:uppercase;">No, we cannot</a>
  </td>
</tr>
</table>

<p style="font-size:14px;color:#6A6862;">
Either answer is useful and a no costs us nothing — we would rather know quickly
than wait. ${r.responds_by
  ? `We will assume it is a no if we have not heard by
     ${new Date(r.responds_by).toLocaleDateString('en-AU',
       { day: 'numeric', month: 'long' })}, since the guest cannot wait longer.`
  : ''}
</p>

<p style="font-size:14px;color:#6A6862;">
Nothing is charged to anyone until you say yes.
</p>`;

  const sent = await send({
    to, from: BOOKINGS,
    replyTo: 'bookings@theglobalsanctum.com',
    subject: `Booking request — ${when(r.date_from)}, ${nights} night${nights === 1 ? '' : 's'}`
      + `${r.reference ? ` (${r.reference})` : ''}`,
    body,
  });

  if (!sent.ok) return { ok: false, error: sent.error };

  await supabase.from('sent_emails').insert({
    to_email: to, subject: 'Booking request', status: 'Sent',
    postmark_id: sent.id, about: `booking_request:${requestId}`,
  });

  return { ok: true, message: `Sent to ${to}.` };
}

/** The invite, once a venue has said yes.
 *
 *  Sent as text/calendar with method=REQUEST, which is what makes their
 *  mail client offer to add it. TGS cannot write into their calendar and
 *  this does not pretend to — their tap is what puts it there, and an
 *  entry they accepted is one they know about.
 */
export async function sendCalendarInvite(requestId: number): Promise<Result> {
  const supabase = await createClient();

  const { data: detail } = await supabase.rpc('invite_for_request', {
    p_request_id: requestId,
  });

  if (!detail) return { ok: false, error: 'No such request.' };
  const d = detail as Record<string, any>;

  if (!d.attendee_email) {
    return { ok: false, error: 'No email recorded to send an invite to.' };
  }
  if (!d.wants_invites) {
    return { ok: true, message: 'That venue has asked not to receive invites.' };
  }

  // Moved before building, so a failure does not leave a sequence that
  // says an invite went when it did not.
  const { data: sequence } = await supabase.rpc('invite_sent', {
    p_request_id: requestId,
  });

  const ics = buildInvite({
    uid: d.uid,
    sequence: (sequence ?? 1) - 1,
    from: d.from,
    to: d.to,
    summary: d.summary,
    description: d.description,
    location: d.location,
    organiserName: 'The Global Sanctum',
    organiserEmail: 'bookings@theglobalsanctum.com',
    attendeeName: d.attendee_name,
    attendeeEmail: d.attendee_email,
  });

  const sent = await send({
    to: d.attendee_email,
    from: BOOKINGS,
    subject: `Confirmed — ${d.summary}`,
    body: `
<p>Thank you for confirming.</p>

<p>The booking is below and attached, so it can be added to your calendar
in one tap.</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
       style="margin:24px 0;border-top:1px solid #E5E2DC;">
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #E5E2DC;width:38%;
               font-family:Helvetica,Arial,sans-serif;font-size:11px;
               letter-spacing:1.5px;text-transform:uppercase;color:#8A8781;">Dates</td>
    <td style="padding:10px 0;border-bottom:1px solid #E5E2DC;font-size:15px;">
      ${when(d.from)} to ${when(d.to)}</td>
  </tr>
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #E5E2DC;
               font-family:Helvetica,Arial,sans-serif;font-size:11px;
               letter-spacing:1.5px;text-transform:uppercase;color:#8A8781;">Reference</td>
    <td style="padding:10px 0;border-bottom:1px solid #E5E2DC;font-size:15px;">
      ${d.uid}</td>
  </tr>
</table>

${d.on_the_feed ? '' : `
<p style="font-size:14px;color:#6A6862;">
If it would help, we can give you one address that keeps every Global Sanctum
booking in your calendar without accepting each one. Just reply and ask.
</p>`}`,
    attachments: [{
      name: 'booking.ics',
      base64: Buffer.from(ics, 'utf-8').toString('base64'),
      // The method is the whole point. Without it this is a file
      // attachment; with it, the mail client asks whether to add it.
      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
    }],
  });

  if (!sent.ok) return { ok: false, error: sent.error };

  await supabase.from('sent_emails').insert({
    to_email: d.attendee_email, subject: 'Calendar invite', status: 'Sent',
    postmark_id: sent.id, about: `booking_request:${requestId}`,
  });

  return { ok: true, message: 'Invite sent.' };
}
