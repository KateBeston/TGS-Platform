/* ═══════════════════════════════════════════════════════════════════════
   LEGAL TEXT RENDERING

   A deliberately small Markdown subset — headings, bold, italic, links,
   lists, and paragraphs. No library.

   Legal text does not need tables, images, footnotes or code blocks, and
   a full Markdown parser is a dependency that would need keeping patched
   for features nothing here uses.

   Everything is escaped before any formatting is applied, so a document
   containing a stray angle bracket cannot inject markup.
   ═══════════════════════════════════════════════════════════════════════ */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    // Links are restricted to http and mailto — a legal document has no
    // business carrying a javascript: URL.
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
             '<a href="$2" rel="noopener">$1</a>');
}

export function renderLegal(body: string | null | undefined): string {
  if (!body) return '';
  const lines = String(body).replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (list) { out.push(`</${list}>`); list = null; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) { flushParagraph(); closeList(); continue; }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    // A numbered clause — 1., 1.1, 12.3.4 — is how legal documents are
    // structured, so it becomes a heading rather than a list item.
    const clause = line.match(/^(\d+(?:\.\d+)*\.?)\s+(.{3,90})$/);
    if (clause && !/[.;,]$/.test(clause[2]) && clause[2].length < 80) {
      flushParagraph(); closeList();
      out.push(`<h3 class="clause"><span class="num">${clause[1]}</span> ${inline(clause[2])}</h3>`);
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const numbered = line.match(/^\d+[).]\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      flushParagraph(); closeList();
      out.push('<hr />');
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  return out.join('\n');
}

/** Plain text, for anywhere markup would be noise. */
export function renderPlain(body: string | null | undefined): string {
  if (!body) return '';
  return String(body)
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^[-*•]\s+/gm, '· ');
}

/** Roughly how long it takes to read, at 200 words a minute. Useful on a
 *  document somebody is being asked to accept. */
export function readingMinutes(body: string | null | undefined): number {
  if (!body) return 0;
  return Math.max(1, Math.round(String(body).split(/\s+/).length / 200));
}
