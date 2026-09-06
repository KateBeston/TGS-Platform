/* Blocks to HTML.
 *
 * A fixed vocabulary the renderer turns into tables. Writing email HTML by
 * hand means every template can break the layout its own way and only a
 * developer can safely touch it; blocks mean the copy is editable and the
 * layout is not.
 *
 * Every block ends up as a table row with inline styles, because that is what
 * Outlook understands. Nothing here uses flexbox, grid, or a class.
 */

export type Block =
  | { type: 'heading'; text: string; eyebrow?: string; subheading?: string; align?: 'left' | 'centre' }
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt?: string; href?: string; fullBleed?: boolean }
  | { type: 'video'; thumbnailUrl: string; href: string; caption?: string }
  | { type: 'button'; label: string; href: string; align?: 'left' | 'centre' }
  | { type: 'divider' }
  | { type: 'spacer'; size?: 'small' | 'medium' | 'large' }
  | { type: 'quote'; text: string; lead?: string }
  | { type: 'list'; items: string[]; heading?: string }
  | { type: 'facts'; items: { label: string; value: string }[] }
  | { type: 'table'; rows: { label: string; value: string }[]; total?: { label: string; value: string } };

const C = {
  ink: '#313131', gold: '#C4A265', goldDark: '#7A644F',
  border: '#E0D8CC', muted: '#4A443B', cream: '#F7F5F1', quiet: '#8A8781',
};
/* Cormorant and Montserrat render in Apple Mail, iOS Mail, Samsung Mail and
   Thunderbird. Gmail and Outlook have never supported webfonts in email, so
   roughly half of any list sees the fallback. Georgia and Arial are chosen to
   hold a similar rhythm, and nothing should depend on the webfont loading. */
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const SANS = "Montserrat,Helvetica,Arial,sans-serif";

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Light formatting inside a text block, so copy can be emphasised without
 *  letting arbitrary HTML in. */
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="font-weight:600;color:${C.ink}">$1</strong>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      `<a href="$2" style="color:${C.goldDark};text-decoration:underline">$1</a>`)
    .replace(/\n{2,}/g, `</p><p style="margin:0 0 16px">`)
    .replace(/\n/g, '<br>');

const SPACE = { small: 14, medium: 26, large: 44 };

export function renderBlock(b: Block): string {
  switch (b.type) {
    case 'heading':
      return `<tr><td style="padding:0 40px 18px;text-align:${b.align === 'centre' ? 'center' : 'left'}">
        ${b.eyebrow ? `<div style="font-family:${SANS};font-size:9.5px;letter-spacing:2.4px;text-transform:uppercase;color:${C.goldDark};margin-bottom:12px">${esc(b.eyebrow)}</div>` : ''}
        <div style="font-family:${SERIF};font-weight:300;font-size:30px;line-height:1.25;color:${C.ink}">${esc(b.text)}</div>
        ${b.subheading ? `<div style="font-family:${SERIF};font-size:17px;line-height:1.5;color:${C.muted};margin-top:12px">${esc(b.subheading)}</div>` : ''}
      </td></tr>`;

    case 'text':
      return `<tr><td style="padding:0 40px 18px;font-family:${SERIF};font-size:16px;line-height:1.72;color:${C.ink}">
        <p style="margin:0 0 16px">${inline(b.text)}</p>
      </td></tr>`;

    case 'image': {
      const img = `<img src="${b.url}" width="${b.fullBleed ? 600 : 520}" alt="${esc(b.alt ?? '')}" style="display:block;width:100%;height:auto;border:0">`;
      return `<tr><td style="padding:${b.fullBleed ? '0 0 22px' : '0 40px 22px'}">
        ${b.href ? `<a href="${b.href}">${img}</a>` : img}
      </td></tr>`;
    }

    /* Video does not play in Gmail, Outlook or most other clients. The only
       thing that works everywhere is a still with a play mark that links out,
       which is what every serious sender does. */
    case 'video':
      return `<tr><td style="padding:0 40px 22px">
        <a href="${b.href}" style="display:block;position:relative;text-decoration:none">
          <img src="${b.thumbnailUrl}" width="520" alt="${esc(b.caption ?? 'Watch')}" style="display:block;width:100%;height:auto;border:0">
        </a>
        <div style="text-align:center;padding-top:10px">
          <a href="${b.href}" style="font-family:${SANS};font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${C.goldDark};text-decoration:none;border-bottom:1px solid ${C.gold};padding-bottom:3px">${esc(b.caption ?? 'Watch the film')}</a>
        </div>
      </td></tr>`;

    case 'button':
      return `<tr><td style="padding:6px 40px 26px;text-align:${b.align === 'centre' ? 'center' : 'left'}">
        <table role="presentation" cellpadding="0" cellspacing="0" ${b.align === 'centre' ? 'align="center"' : ''}>
          <tr><td style="background:${C.ink}">
            <a href="${b.href}" style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:9.5px;font-weight:500;letter-spacing:2.6px;text-transform:uppercase;color:#FDFCF9;text-decoration:none">${esc(b.label)}</a>
          </td></tr>
        </table>
      </td></tr>`;

    case 'divider':
      return `<tr><td style="padding:8px 40px 24px"><div style="height:1px;background:${C.border};font-size:0;line-height:0">&nbsp;</div></td></tr>`;

    case 'spacer':
      return `<tr><td style="height:${SPACE[b.size ?? 'medium']}px;font-size:0;line-height:0">&nbsp;</td></tr>`;

    case 'quote':
      return `<tr><td style="padding:0 40px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};border-left:2px solid ${C.gold}">
          <tr><td style="padding:20px 24px;font-family:${SERIF};font-size:15px;line-height:1.75;color:${C.muted}">
            ${b.lead ? `<strong style="color:${C.ink};font-weight:600">${esc(b.lead)}</strong> ` : ''}${inline(b.text)}
          </td></tr>
        </table>
      </td></tr>`;

    case 'list':
      return `<tr><td style="padding:0 40px 24px">
        ${b.heading ? `<div style="font-family:${SANS};font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${C.goldDark};margin-bottom:14px">${esc(b.heading)}</div>` : ''}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${b.items.map((it) => `<tr><td style="padding:9px 0;border-bottom:1px solid ${C.border};font-family:${SERIF};font-size:15px;color:${C.ink}"><span style="color:${C.gold}">&mdash;</span>&nbsp; ${esc(it)}</td></tr>`).join('')}
        </table>
      </td></tr>`;

    case 'facts':
      return `<tr><td style="padding:0 40px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border}">
          <tr>
            ${b.items.slice(0, 3).map((f, i, a) => `<td width="${Math.floor(100 / a.length)}%" style="padding:22px 10px;text-align:center;${i < a.length - 1 ? `border-right:1px solid ${C.border}` : ''}">
              <div style="font-family:${SERIF};font-size:30px;color:${C.ink};line-height:1">${esc(f.value)}</div>
              <div style="font-family:${SANS};font-size:8.5px;letter-spacing:1.6px;text-transform:uppercase;color:${C.goldDark};margin-top:8px">${esc(f.label)}</div>
            </td>`).join('')}
          </tr>
        </table>
      </td></tr>`;

    case 'table':
      return `<tr><td style="padding:0 40px 24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.ink}">
          ${b.rows.map((r) => `<tr>
            <td style="padding:13px 0;border-bottom:1px solid ${C.border};font-family:${SANS};font-size:9px;letter-spacing:1.8px;text-transform:uppercase;color:${C.goldDark};width:42%">${esc(r.label)}</td>
            <td style="padding:13px 0;border-bottom:1px solid ${C.border};font-family:${SERIF};font-size:16px;color:${C.ink}">${esc(r.value)}</td>
          </tr>`).join('')}
          ${b.total ? `<tr>
            <td style="padding:14px 0;border-bottom:1px solid ${C.ink};font-family:${SANS};font-size:9px;letter-spacing:1.8px;text-transform:uppercase;color:${C.goldDark}">${esc(b.total.label)}</td>
            <td style="padding:14px 0;border-bottom:1px solid ${C.ink};font-family:${SERIF};font-size:19px;color:${C.ink}">${esc(b.total.value)}</td>
          </tr>` : ''}
        </table>
      </td></tr>`;

    default:
      return '';
  }
}

/** The whole body. Returns table rows, which the shell drops into its frame. */
export function renderBlocks(blocks: Block[]): string {
  return `<tr><td style="padding:30px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${blocks.map(renderBlock).join('\n')}
  <tr><td style="height:14px;font-size:0;line-height:0">&nbsp;</td></tr>
</table></td></tr>`;
}

/** A new block with sensible defaults, for the builder's Add menu. */
export function blankBlock(type: Block['type']): Block {
  switch (type) {
    case 'heading': return { type: 'heading', text: 'A heading', eyebrow: '', subheading: '', align: 'centre' };
    case 'text':    return { type: 'text', text: 'Write here. **Bold** with asterisks, and [a link](https://example.com).' };
    case 'image':   return { type: 'image', url: '', alt: '', fullBleed: false };
    case 'video':   return { type: 'video', thumbnailUrl: '', href: '', caption: 'Watch the film' };
    case 'button':  return { type: 'button', label: 'See your booking', href: '', align: 'left' };
    case 'divider': return { type: 'divider' };
    case 'spacer':  return { type: 'spacer', size: 'medium' };
    case 'quote':   return { type: 'quote', lead: 'Worth knowing.', text: '' };
    case 'list':    return { type: 'list', heading: '', items: ['', ''] };
    case 'facts':   return { type: 'facts', items: [{ label: '', value: '' }, { label: '', value: '' }, { label: '', value: '' }] };
    case 'table':   return { type: 'table', rows: [{ label: '', value: '' }] };
    default:        return { type: 'text', text: '' };
  }
}

export const BLOCK_LABELS: Record<Block['type'], string> = {
  heading: 'Heading', text: 'Text', image: 'Image', video: 'Video',
  button: 'Button', divider: 'Divider', spacer: 'Space', quote: 'Pull quote',
  list: 'List', facts: 'Three facts', table: 'Detail table',
};
