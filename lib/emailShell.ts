/* The email shell.
 *
 * One function assembles every email: header, optional hero and navigation,
 * the body, and a footer whose wording follows the tier. Templates hold copy
 * and nothing else, so changing the mark or the footer changes it in all of
 * them rather than in a hundred and thirteen places.
 *
 * Written as tables with inline styles because that is what email clients
 * actually support. Outlook renders through Word and ignores flexbox, grid,
 * and most of a stylesheet.
 */

export type Tier = 'Transactional' | 'Detailed' | 'Marketing' | 'System';

export type Blocks = {
  nav?: boolean;
  hero?: boolean;
  social?: boolean;
  unsubscribe?: boolean;
};

export type ShellInput = {
  tier: Tier;
  body: string;
  preheader?: string | null;
  blocks?: Blocks | null;
  heroUrl?: string | null;
  /** The recipient, shown in the footer. Required by the Spam Act in effect:
   *  the reader must be able to tell who this was sent to and why. */
  toAddress: string;
  /** Signed, one per recipient. Absent on System, which carries none. */
  unsubscribeUrl?: string | null;
  preferencesUrl?: string | null;
  /* Blocks arrive already wrapped in their own rows, so the shell must not
     wrap them again in a padded cell. */
  bodyIsBlocks?: boolean;
};

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theglobalsanctum.com';

/* Where the email's own images live.
 *
 * BASE is the public site: it is what links in the body should point at. But
 * the brand images sit in the portal's public folder, and the portal is served
 * from a different domain. Using BASE for both meant the header requested a
 * file from a domain that does not have it, and the email arrived showing alt
 * text where the mark should be.
 *
 * Set EMAIL_ASSET_URL to whichever origin actually serves /brand/email/. */
const ASSETS = process.env.EMAIL_ASSET_URL
  ?? process.env.NEXT_PUBLIC_PORTAL_URL
  ?? BASE;

const C = {
  ink: '#313131',
  white: '#FDFCF9',
  cream: '#F7F5F1',
  linen: '#F2EEE7',
  gold: '#C4A265',
  goldDark: '#7A644F',
  border: '#E0D8CC',
  muted: '#4A443B',
  quiet: '#8A8781',
  faint: '#A8A49D',
};

/* Cormorant and Montserrat render in Apple Mail, iOS Mail and Samsung Mail.
   Gmail and Outlook fall back, so the fallbacks are chosen to hold a similar
   rhythm rather than to match exactly. */
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const SANS = "Montserrat,Helvetica,Arial,sans-serif";

/** Which blocks a tier turns on when a template has not said otherwise.
 *
 *  The hero is on everywhere. It is not a decorative photograph that some
 *  emails can do without: it is the header, carrying the mark and the tagline,
 *  and an email that drops it opens on a small logo and looks like a different
 *  company. A receipt gets the same masthead as a newsletter for the same
 *  reason a letterhead does not change with the letter. */
export function defaultBlocks(tier: Tier): Required<Blocks> {
  switch (tier) {
    case 'Detailed':  return { nav: true, hero: true, social: true, unsubscribe: true };
    case 'Marketing': return { nav: true, hero: true, social: true, unsubscribe: true };
    // No navigation and no unsubscribe: a password reset is not marketing and
    // has to reach someone who has opted out of everything else. It keeps the
    // header, because it is still from you.
    case 'System':    return { nav: false, hero: true, social: false, unsubscribe: false };
    default:          return { nav: true, hero: true, social: true, unsubscribe: false };
  }
}

/** Why this person is receiving this. Not required by the Act, but it
 *  measurably reduces spam complaints, and complaint rate is what Gmail and
 *  Yahoo enforce against. */
function reason(tier: Tier): string {
  switch (tier) {
    case 'Marketing':
      return 'You are receiving this because you subscribed to hear from The Global Sanctum. Leave any time and we stop.';
    case 'Detailed':
      return 'You are receiving this because you have a retreat booked through The Global Sanctum.';
    case 'System':
      return 'This is a service message about your account, so it carries no unsubscribe.';
    default:
      return 'You are receiving this because you have a booking with us. We write about it until it is done.';
  }
}

const social = () => `
    <tr><td style="padding:0 40px 18px;text-align:center">
      <a href="https://facebook.com/theglobalsanctum" style="display:inline-block;width:26px;height:26px;line-height:26px;background:${C.ink};color:${C.white};font-family:${SANS};font-size:10px;text-decoration:none;margin:0 3px">f</a>
      <a href="https://instagram.com/theglobalsanctum" style="display:inline-block;width:26px;height:26px;line-height:26px;background:${C.ink};color:${C.white};font-family:${SANS};font-size:9px;text-decoration:none;margin:0 3px">ig</a>
      <a href="https://linkedin.com/company/theglobalsanctum" style="display:inline-block;width:26px;height:26px;line-height:26px;background:${C.ink};color:${C.white};font-family:${SANS};font-size:9px;text-decoration:none;margin:0 3px">in</a>
    </td></tr>`;

const nav = () => `
  <tr><td style="padding:22px 40px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.border};border-bottom:1px solid ${C.border}">
      <tr>
        <td align="center" style="padding:15px 6px"><a href="${BASE}/venues?marketplace=Retreat" style="font-family:${SANS};font-size:10.5px;letter-spacing:1.2px;color:${C.ink};text-decoration:none">Retreat venues</a></td>
        <td width="1" style="padding:15px 0"><div style="width:1px;height:11px;background:${C.border};font-size:0;line-height:0">&nbsp;</div></td>
        <td align="center" style="padding:15px 6px"><a href="${BASE}/venues?marketplace=Wellness" style="font-family:${SANS};font-size:10.5px;letter-spacing:1.2px;color:${C.ink};text-decoration:none">Wellness venues</a></td>
        <td width="1" style="padding:15px 0"><div style="width:1px;height:11px;background:${C.border};font-size:0;line-height:0">&nbsp;</div></td>
        <td align="center" style="padding:15px 6px"><a href="${BASE}/wellness-experiences" style="font-family:${SANS};font-size:10.5px;letter-spacing:1.2px;color:${C.ink};text-decoration:none">Wellness experiences</a></td>
      </tr>
    </table>
  </td></tr>`;

export function renderEmail(input: ShellInput): string {
  const b = { ...defaultBlocks(input.tier), ...(input.blocks ?? {}) };
  const width = input.tier === 'System' ? 520 : 600;

  /* The standing header image already carries the mark and the tagline, so
     nothing is repeated in text beneath it. The alt text carries both, which
     is what a reader sees when a client blocks images. */
  const heroSrc = input.heroUrl ?? `${ASSETS}/brand/email/tgs-email-hero.jpg`;
  const header = b.hero
    ? `<tr><td style="padding:0"><img src="${heroSrc}" width="${width}" alt="The Global Sanctum — retreat spaces, wellness experiences, globally curated" style="display:block;width:100%;height:auto;border:0"></td></tr>`
    : `<tr><td style="padding:34px 40px 4px;text-align:center">
         <img src="${ASSETS}/brand/email/tgs-mark-email.png" width="86" alt="The Global Sanctum" style="display:block;margin:0 auto 14px;border:0;width:86px;height:auto">
         <div style="font-family:${SANS};font-size:7.5px;letter-spacing:2.4px;text-transform:uppercase;color:${C.goldDark};line-height:1.7">Retreat spaces &middot; Wellness experiences &middot; Globally curated</div>
       </td></tr>`;

  const unsub = b.unsubscribe && input.unsubscribeUrl
    ? (input.tier === 'Marketing'
        ? `<div style="margin-top:14px"><a href="${input.unsubscribeUrl}" style="font-family:${SANS};font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${C.ink};text-decoration:none;border:1px solid #C9C3B8;padding:8px 18px;display:inline-block">Unsubscribe</a></div>`
        : `<a href="${input.unsubscribeUrl}" style="color:${C.goldDark};text-decoration:underline">Unsubscribe</a>`)
    : '';

  const prefs = input.preferencesUrl
    ? `<a href="${input.preferencesUrl}" style="color:${C.goldDark};text-decoration:underline">Email preferences</a>`
    : '';

  const linkRow = [prefs, b.unsubscribe && input.tier !== 'Marketing' ? unsub : '',
                   `<a href="${BASE}/legal/privacy-policy" style="color:${C.goldDark};text-decoration:underline">Privacy policy</a>`]
    .filter(Boolean)
    .join(`<span style="color:#D0CBC2">&nbsp;&middot;&nbsp;</span>`);

  return `<!DOCTYPE html>
<html lang="en-AU"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<!-- Gmail and iOS detect phone numbers and addresses and turn them into links,
     which is why an ABN arrives split across a blue telephone link. This stops
     it; the wrapper on the footer text below stops the rest. -->
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  /* Apple Mail, iOS Mail, Samsung Mail and Thunderbird load these; Gmail and
     Outlook ignore them and fall back to Georgia and Arial, which are chosen
     to hold a similar rhythm. Without this the brand typography never
     appeared anywhere, which is what was happening. */
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Montserrat:wght@300;400;500;600&display=swap');
  /* Some clients link numbers and addresses regardless of format-detection.
     If they do, at least make the link look like the text around it. */
  a[x-apple-data-detectors], .footer-plain a {
    color: inherit !important; text-decoration: none !important;
    font-size: inherit !important; font-family: inherit !important;
  }
</style>
<!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:${C.linen};-webkit-text-size-adjust:100%">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${input.preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.linen};padding:36px 18px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${width}px;background:${C.white};border:1px solid ${C.border}">

${header}
${b.nav ? nav() : ''}

${input.bodyIsBlocks
  ? input.body
  : `  <tr><td style="padding:30px 40px 34px;font-family:${SERIF};font-size:16px;line-height:1.72;color:${C.ink}">
${input.body}
  </td></tr>`}

  <tr><td style="height:1px;border-top:1px solid ${C.border};background:${C.cream};font-size:0;line-height:0">&nbsp;</td></tr>
  <tr><td style="background:${C.cream};padding:22px 0 26px;text-align:center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${b.social ? social() : ''}
      <tr><td style="padding:0 40px;font-family:${SANS};font-size:10px;letter-spacing:.4px;line-height:1.9;color:${C.muted}">
        <a href="${BASE}" style="color:${C.goldDark};text-decoration:none">theglobalsanctum.com</a>
        <span style="color:#D0CBC2">&nbsp;&middot;&nbsp;</span>0434 777 032
      </td></tr>
      ${unsub && input.tier === 'Marketing' ? `<tr><td style="padding:0 40px">${unsub}</td></tr>` : ''}
      <tr><td style="padding:12px 40px 0;font-family:${SANS};font-size:10px;line-height:1.9;color:${C.goldDark}">${linkRow}</td></tr>
      <tr><td style="padding:14px 40px 0">
        <div class="footer-plain" style="border-top:1px solid #E8E3DA;padding-top:12px;font-family:${SANS};font-size:8.5px;line-height:1.75;color:${C.faint}">
          <span style="color:${C.faint};text-decoration:none">The Global Sanctum &middot; Aurella Group Pty Ltd &middot; ABN&nbsp;70&nbsp;649&nbsp;742&nbsp;423</span><br>
          <span style="color:${C.faint};text-decoration:none">58 Wellington Street, Virginia QLD 4014, Australia</span><br>
          <span style="color:${C.faint};text-decoration:none">Sent to ${input.toAddress}. ${reason(input.tier)}</span>
        </div>
      </td></tr>
    </table>
  </td></tr>

</table></td></tr></table></body></html>`;
}

/** A plain text version. Some clients take only this, and an email without one
 *  looks like spam to the rest. */
export function toPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&middot;/g, '·').replace(/&mdash;/g, '—')
    .replace(/&rsquo;/g, '\u2019').replace(/&amp;/g, '&')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
