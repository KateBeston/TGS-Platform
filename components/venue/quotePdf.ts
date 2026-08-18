import { jsPDF } from 'jspdf';
import { CORMORANT_TTF, MONTSERRAT_TTF, TGS_MARK_PNG } from './quoteFonts';

/* The branded PDF quote.
 *
 * A crisp, vector A4 document in the house type — Cormorant Garamond for the
 * display, Montserrat for everything set in caps — on the charcoal-and-gold
 * palette. One-click download, no browser print dialog. An estimate: the note
 * says so, and the authoritative figure is settled on booking. */

export type QuoteLine = { label: string; detail: string; amount: number | null };
export type QuoteData = {
  venueName: string;
  location?: string;
  from: string; to: string; nights: number; guests: number;
  lines: QuoteLine[];
  total: number;
  currency: string;
  anyUnpriced: boolean;
};

const CHARCOAL: [number, number, number] = [49, 49, 49];
const GOLD: [number, number, number] = [196, 162, 101];
const GOLD_DARK: [number, number, number] = [122, 100, 79];
const MUTED: [number, number, number] = [140, 134, 122];

/* TGS-wide policy: how long a booking quote stays valid. A quote is an
 * estimate, not a held rate — urgency lives at the booking-confirmation
 * step, so the estimate window is relaxed. Change here, once, for all venues. */
const QUOTE_VALIDITY_DAYS = 7;

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: currency || 'AUD', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency || 'AUD'} ${Math.round(amount)}`;
  }
}

function niceDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

export function downloadQuotePdf(q: QuoteData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.addFileToVFS('Cormorant.ttf', CORMORANT_TTF);
  doc.addFont('Cormorant.ttf', 'Cormorant', 'normal');
  doc.addFileToVFS('Montserrat.ttf', MONTSERRAT_TTF);
  doc.addFont('Montserrat.ttf', 'Montserrat', 'normal');

  const W = 210, M = 22, right = W - M, cx = W / 2;

  // Centre letter-spaced caps on their true (spaced) width — jsPDF's own
  // centre-align ignores charSpace and drifts the text right.
  const centredCaps = (text: string, yy: number, size: number, cs: number) => {
    doc.setFontSize(size);
    const w = doc.getTextWidth(text) + cs * Math.max(0, text.length - 1);
    doc.text(text, cx - w / 2, yy, { charSpace: cs });
  };

  let y = 20;
  // Flower mark, centred
  const markW = 14;
  doc.addImage(TGS_MARK_PNG, 'PNG', cx - markW / 2, y, markW, markW);
  y += markW + 11;

  // Wordmark
  doc.setFont('Montserrat', 'normal'); doc.setTextColor(...CHARCOAL);
  centredCaps('THE GLOBAL SANCTUM', y, 11, 2.6);
  y += 11;
  // Booking-quote label, with room to breathe
  doc.setTextColor(...GOLD_DARK);
  centredCaps('BOOKING QUOTE', y, 7.5, 2.4);
  y += 11;
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.line(M, y, right, y);
  y += 18;

  // Venue
  doc.setFont('Cormorant', 'normal'); doc.setFontSize(30); doc.setTextColor(...CHARCOAL);
  doc.text(q.venueName, M, y);
  y += 7;
  if (q.location) {
    doc.setFont('Montserrat', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GOLD_DARK);
    doc.text(q.location.toUpperCase(), M, y, { charSpace: 1.5 });
    y += 6;
  }
  y += 6;

  // Stay meta
  const meta = [
    ['ARRIVAL', niceDate(q.from) || '—'],
    ['DEPARTURE', niceDate(q.to) || '—'],
    ['NIGHTS', q.nights ? String(q.nights) : '—'],
    ['GUESTS', String(q.guests)],
  ];
  const colW = (right - M) / meta.length;
  meta.forEach((m, i) => {
    const x = M + colW * i;
    doc.setFont('Montserrat', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text(m[0], x, y, { charSpace: 1 });
    doc.setFont('Cormorant', 'normal'); doc.setFontSize(14); doc.setTextColor(...CHARCOAL);
    doc.text(m[1], x, y + 6);
  });
  y += 16;
  doc.setDrawColor(224, 220, 212); doc.setLineWidth(0.2); doc.line(M, y, right, y);
  y += 10;

  // Lines
  doc.setFont('Montserrat', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  doc.text('DESCRIPTION', M, y, { charSpace: 1 });
  doc.text('AMOUNT', right, y, { align: 'right', charSpace: 1 });
  y += 7;

  for (const line of q.lines) {
    if (y > 250) { doc.addPage(); y = 28; }
    doc.setFont('Cormorant', 'normal'); doc.setFontSize(13); doc.setTextColor(...CHARCOAL);
    doc.text(line.label, M, y);
    doc.setFont('Montserrat', 'normal'); doc.setFontSize(9);
    doc.setTextColor(line.amount == null ? GOLD_DARK[0] : CHARCOAL[0],
                     line.amount == null ? GOLD_DARK[1] : CHARCOAL[1],
                     line.amount == null ? GOLD_DARK[2] : CHARCOAL[2]);
    doc.text(line.amount != null ? money(line.amount, q.currency) : 'On request', right, y, { align: 'right' });
    if (line.detail) {
      y += 4.5;
      doc.setFont('Montserrat', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text(line.detail, M, y);
    }
    y += 8;
  }

  // Total
  y += 2;
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.line(M, y, right, y);
  y += 10;
  doc.setFont('Cormorant', 'normal'); doc.setFontSize(15); doc.setTextColor(...CHARCOAL);
  doc.text('Estimated total', M, y);
  doc.setFont('Cormorant', 'normal'); doc.setFontSize(22);
  doc.text(money(q.total, q.currency), right, y + 1, { align: 'right' });
  y += 13;

  const validDays = QUOTE_VALIDITY_DAYS;
  const validUntil = new Date(); validUntil.setDate(validUntil.getDate() + validDays);
  const validStr = validUntil.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFont('Montserrat', 'normal'); doc.setFontSize(8); doc.setTextColor(...GOLD_DARK);
  doc.text(`VALID UNTIL ${validStr.toUpperCase()}`, M, y, { charSpace: 1.4 });
  y += 8;

  if (q.anyUnpriced) {
    doc.setFont('Montserrat', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text('Some items are priced on request and are not included in this estimate.', M, y);
    y += 6;
  }

  // Footer
  const footerY = 276;
  doc.setDrawColor(224, 220, 212); doc.setLineWidth(0.2); doc.line(M, footerY, right, footerY);
  doc.setFont('Montserrat', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
  const stamp = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Prepared ${stamp}`, M, footerY + 6);
  doc.text('theglobalsanctum.com', right, footerY + 6, { align: 'right' });
  doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text('An estimate only. The final quote, deposit and payment schedule are confirmed when you request to book.', M, footerY + 12);

  const slug = (q.venueName || 'venue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`TGS-Quote-${slug}.pdf`);
}
