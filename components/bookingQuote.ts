import { jsPDF } from 'jspdf';
import { CORMORANT_TTF, MONTSERRAT_TTF, TGS_MARK_PNG } from './venue/quoteFonts';

/* A quote for the whole booking.
 *
 * quotePdf.ts covers one venue, which is right on a listing page. This one
 * covers a booking that may span three, because that is what the booking page
 * holds and a host comparing options needs it on one sheet rather than three.
 *
 * Same bones as the single-venue quote — the embedded fonts, the mark, the
 * measures — so a host who has seen one recognises the other. What differs is
 * that each venue is a section with its own dates and subtotal, and the total
 * sits under all of them.
 */

type Line = { label: string; detail: string; amount: number | null };

export type VenueSection = {
  venueName: string;
  location: string;
  from: string;
  to: string;
  guests: number | null;
  lines: Line[];
  subtotal: number;
};

export type BookingQuote = {
  sections: VenueSection[];
  total: number;
  currency: string;
  anyUnpriced: boolean;
};

const CHARCOAL: [number, number, number] = [49, 49, 49];
const GOLD: [number, number, number] = [196, 162, 101];
const GOLD_DARK: [number, number, number] = [122, 100, 79];
const QUIET: [number, number, number] = [138, 135, 129];
const RULE: [number, number, number] = [224, 216, 204];
const M = 18;

export function downloadBookingQuote(q: BookingQuote) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const right = pageW - M;
  const cx = pageW / 2;

  doc.addFileToVFS('Cormorant.ttf', CORMORANT_TTF);
  doc.addFont('Cormorant.ttf', 'Cormorant', 'normal');
  doc.addFileToVFS('Montserrat.ttf', MONTSERRAT_TTF);
  doc.addFont('Montserrat.ttf', 'Montserrat', 'normal');

  const money = (v: number | null) =>
    v == null ? 'On request'
      : new Intl.NumberFormat('en-AU', { style: 'currency', currency: q.currency || 'AUD' }).format(v);

  const date = (s: string) => {
    if (!s) return null;
    try { return new Date(s).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return null; }
  };

  const centred = (text: string, size: number, y: number, cs = 0) => {
    doc.setFontSize(size);
    const w = doc.getStringUnitWidth(text) * size / doc.internal.scaleFactor + (text.length - 1) * cs;
    doc.text(text, cx - w / 2, y, { charSpace: cs });
  };

  let y = 20;
  const markW = 14;
  doc.addImage(TGS_MARK_PNG, 'PNG', cx - markW / 2, y, markW, markW);
  y += markW + 7;

  doc.setFont('Montserrat', 'normal');
  doc.setTextColor(...GOLD_DARK);
  centred('YOUR BOOKING', 7.5, y, 2.2);
  y += 9;

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(M, y, right, y);
  y += 10;

  /* Said once at the top rather than per venue: a quote for three venues with
     three identical caveats reads as small print. */
  doc.setFont('Montserrat', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...QUIET);
  const intro = q.sections.length > 1
    ? `An estimate across ${q.sections.length} venues. Each is confirmed separately by the venue.`
    : 'An estimate. Confirmed by the venue before anything is payable.';
  doc.text(intro, M, y);
  y += 10;

  for (const s of q.sections) {
    /* A new page before a venue rather than in the middle of one: a section
       split across a page break is harder to read than one that starts late. */
    if (y > pageH - 60) { doc.addPage(); y = 22; }

    doc.setFont('Cormorant', 'normal');
    doc.setFontSize(20);
    doc.setTextColor(...CHARCOAL);
    doc.text(s.venueName, M, y);
    y += 6;

    doc.setFont('Montserrat', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...QUIET);
    const meta = [
      s.location,
      date(s.from) && date(s.to) ? `${date(s.from)} to ${date(s.to)}` : null,
      s.guests ? `${s.guests} guests` : null,
    ].filter(Boolean).join('  ·  ');
    if (meta) { doc.text(meta, M, y); y += 7; }

    for (const line of s.lines) {
      if (y > pageH - 35) { doc.addPage(); y = 22; }

      doc.setFont('Cormorant', 'normal');
      doc.setFontSize(11.5);
      doc.setTextColor(...CHARCOAL);
      doc.text(line.label, M, y);

      const amt = money(line.amount);
      doc.setFont('Montserrat', 'normal');
      doc.setFontSize(8.5);
      const aw = doc.getStringUnitWidth(amt) * 8.5 / doc.internal.scaleFactor;
      doc.text(amt, right - aw, y);

      if (line.detail) {
        y += 4;
        doc.setFontSize(7);
        doc.setTextColor(...QUIET);
        doc.text(line.detail, M, y);
      }
      y += 3.5;
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.12);
      doc.line(M, y, right, y);
      y += 5;
    }

    /* A subtotal per venue, because each is confirmed and paid separately. */
    doc.setFont('Montserrat', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GOLD_DARK);
    doc.text(`${s.venueName.toUpperCase()} SUBTOTAL`, M, y + 1, { charSpace: 1.2 });
    const sub = money(s.subtotal);
    doc.setFont('Cormorant', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(...CHARCOAL);
    const sw = doc.getStringUnitWidth(sub) * 14 / doc.internal.scaleFactor;
    doc.text(sub, right - sw, y + 2);
    y += 12;
  }

  if (y > pageH - 40) { doc.addPage(); y = 22; }

  doc.setDrawColor(...CHARCOAL);
  doc.setLineWidth(0.4);
  doc.line(M, y, right, y);
  y += 8;

  doc.setFont('Montserrat', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_DARK);
  doc.text('ESTIMATED TOTAL', M, y, { charSpace: 1.8 });

  const totalText = money(q.total);
  doc.setFont('Cormorant', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(...CHARCOAL);
  const tw = doc.getStringUnitWidth(totalText) * 20 / doc.internal.scaleFactor;
  doc.text(totalText, right - tw, y + 1);
  y += 10;

  if (q.anyUnpriced) {
    doc.setFont('Montserrat', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...QUIET);
    doc.text('Some items are priced on request and are not included in this total.', M, y);
  }

  const footY = pageH - 14;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.15);
  doc.line(M, footY - 6, right, footY - 6);
  doc.setFont('Montserrat', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...QUIET);
  centred(`Prepared ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} · The Global Sanctum`, 6.5, footY - 1.5);
  centred('Aurella Group Pty Ltd · ABN 70 649 742 423 · theglobalsanctum.com', 6.5, footY + 2.5);

  doc.save('the-global-sanctum-quote.pdf');
}
