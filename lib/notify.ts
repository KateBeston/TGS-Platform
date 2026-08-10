/** Sending through Postmark.
 *
 *  Deliberately thin. Postmark's API is a single POST, and a library
 *  wrapping it would add a dependency to save four lines.
 *
 *  Every send is recorded whether it worked or not — an email that
 *  silently failed to arrive is worse than one that visibly did not,
 *  because nobody goes looking.
 */
const ENDPOINT = 'https://api.postmarkapp.com/email';

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export type Message = {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
  /** Postmark keeps transactional and broadcast streams apart. Using the
   *  wrong one is how a password reset ends up subject to a marketing
   *  suppression. */
  stream?: string;
  /** Files to send with it. A calendar invite needs
   *  contentType "text/calendar; charset=utf-8; method=REQUEST" — the
   *  method is what turns it into a question rather than a file. */
  attachments?: { name: string; base64: string; contentType: string }[];
};

export async function send(message: Message): Promise<SendResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) {
    return { ok: false, error: 'POSTMARK_SERVER_TOKEN is not set in the environment.' };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify({
        From: message.from ?? 'The Global Sanctum <login@theglobalsanctum.com>',
        To: message.to,
        Subject: message.subject,
        HtmlBody: wrap(message.body),
        TextBody: strip(message.body),
        ReplyTo: message.replyTo,
        MessageStream: message.stream ?? 'outbound',
        // A calendar invite has to arrive as text/calendar with
        // method=REQUEST. That MIME type is what makes Gmail, Outlook and
        // Apple Mail render Yes and No in the message — as a plain
        // attachment it is a file nobody opens.
        Attachments: message.attachments?.map((a) => ({
          Name: a.name,
          Content: a.base64,
          ContentType: a.contentType,
        })),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as any)?.Message ?? `Postmark returned ${res.status}` };
    }
    return { ok: true, id: (data as any)?.MessageID };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not reach Postmark.' };
  }
}

/** The brand, inlined.
 *
 *  Email clients strip stylesheets, so everything has to be on the
 *  element. Cormorant will not load in most of them either — the serif
 *  stack degrades to Georgia, which is close enough and always there.
 */
function wrap(body: string): string {
  return `<!DOCTYPE html><html lang="en-AU"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F5F1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:#F7F5F1;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="max-width:540px;background:#FDFCF9;border:1px solid #E5E2DC;">
<tr><td style="padding:36px 40px 28px;text-align:center;border-bottom:1px solid #E5E2DC;">
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;
              letter-spacing:3px;text-transform:uppercase;color:#7A644F;">
    The Global Sanctum</div>
</td></tr>
<tr><td style="padding:36px 40px;font-family:Georgia,'Times New Roman',serif;
               font-size:16px;line-height:1.65;color:#313131;">
${body}
</td></tr>
<tr><td style="padding:24px 40px 32px;border-top:1px solid #E5E2DC;
               font-family:Helvetica,Arial,sans-serif;font-size:11px;
               line-height:1.6;color:#8A8781;">
  Aurella Group Pty Ltd · ABN 70 649 742 423<br>
  theglobalsanctum.com
</td></tr>
</table></td></tr></table></body></html>`;
}

/** A plain text version, because some clients only take that and an
 *  email with none looks like spam to the rest. */
function strip(html: string): string {
  return html
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—').replace(/&rsquo;/g, '\u2019')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const FROM = {
  login: 'The Global Sanctum <login@theglobalsanctum.com>',
  accounts: 'The Global Sanctum <accounts@theglobalsanctum.com>',
  hello: 'The Global Sanctum <hello@theglobalsanctum.com>',
};
