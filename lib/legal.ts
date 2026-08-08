import { createClient } from '@/lib/supabase/server';

/* The legal register, as the site reads it.
 *
 * Everything comes from public_legal_documents, which serves the wording
 * for the phase the platform is actually in — interim during the
 * concierge period, subscription after. Nothing is hardcoded, so editing
 * a document in the portal changes the site on the next page load.
 */

export type LegalDoc = {
  slug: string;
  name: string;
  category: string | null;
  summary: string | null;
  meta_title: string | null;
  meta_description: string | null;
  on_legal_page: boolean;
  legal_page_order: number | null;
  version_label: string | null;
  effective_from: string | null;
  applies_during: string;
  body: string;
  updated_at: string;
};

/* Short anchors used around the site, from before the slugs settled.
 *
 * /legal#privacy is in four places, #terms in three. Rewriting them all
 * and hoping nothing was missed is worse than accepting both — an old
 * link in a sent email or a signed document cannot be rewritten at all. */
const ALIASES: Record<string, string> = {
  terms: 'terms-and-conditions',
  privacy: 'privacy-policy',
  cookies: 'cookie-policy',
  health: 'health-wellness-disclaimer',
  booking: 'booking-terms-and-conditions',
  refunds: 'refund-cancellation-policy',
  conduct: 'community-standards',
  use: 'acceptable-use-policy',
  'venue-owner': 'venue-owner-agreement',
  concierge: 'concierge-introduction-terms',
  accuracy: 'venue-data-accuracy-declaration',
  safety: 'health-safety-liability-declaration',
  host: 'retreat-host-agreement',
};

export function resolveSlug(hash: string) {
  return ALIASES[hash] ?? hash;
}

/** The eight tabs. */
export async function legalTabs() {
  const supabase = await createClient();
  const { data } = await supabase.from('public_legal_documents')
    .select('slug,name,summary,version_label,effective_from,applies_during,body,updated_at')
    .eq('on_legal_page', true)
    .order('legal_page_order');
  return (data ?? []) as LegalDoc[];
}

/** One document, whether or not it is a tab. An agreement is readable
 *  because somebody signing it must be able to read it. */
export async function legalDoc(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('public_legal_documents')
    .select('*').eq('slug', resolveSlug(slug)).maybeSingle();
  return (data ?? null) as LegalDoc | null;
}

/** Everything readable, for the index at the foot of the page. */
export async function allLegalDocs() {
  const supabase = await createClient();
  const { data } = await supabase.from('public_legal_documents')
    .select('slug,name,category,on_legal_page,version_label,effective_from')
    .order('category').order('name');
  return (data ?? []) as LegalDoc[];
}

/* Turns the stored wording into paragraphs and headings.
 *
 * The register holds two shapes, because the documents came from two
 * places. The v5 set is markdown — "## 2. Types of Cookies" and
 * **bold** — and the ones recovered from the application modal are plain
 * text with numbered headings. Both are handled rather than one being
 * normalised, because rewriting stored legal wording to suit a renderer
 * is the wrong way round.
 *
 * Emphasis is stripped rather than rendered. A legal document does not
 * need bold, and parsing inline markup means either shipping a markdown
 * library or writing a sanitiser — neither worth it for asterisks. */
export type Block = { kind: 'heading' | 'paragraph' | 'bullet'; text: string };

export function readable(body: string): Block[] {
  return body
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block): Block => {
      let text = block.replace(/\r?\n\s*/g, ' ').trim();

      // Markdown heading: ## 2. Types of Cookies We Use
      const md = text.match(/^#{1,4}\s+(.+)$/);
      if (md) {
        return { kind: 'heading', text: clean(md[1]) };
      }

      // Markdown or plain bullet.
      const bullet = text.match(/^[-*•]\s+(.+)$/);
      if (bullet) {
        return { kind: 'bullet', text: clean(bullet[1]) };
      }

      text = clean(text);

      // Plain numbered heading: 4. Invoicing and Payment
      const numbered = /^\d+[A-Z]?\.\s+[^.!?]{3,80}$/.test(text);
      // A short line with no full stop, which in these documents is
      // always a heading.
      const bare = /^[A-Z][^.!?]{3,70}$/.test(text) && text.length < 72;

      return { kind: numbered || bare ? 'heading' : 'paragraph', text };
    });
}

/** Strips inline markup. A legal document does not need bold, and
 *  rendering it would mean a markdown parser and a sanitiser. */
function clean(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
    .trim();
}
