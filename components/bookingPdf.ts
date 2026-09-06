import { jsPDF } from 'jspdf';
import { CORMORANT_TTF, MONTSERRAT_TTF, TGS_MARK_PNG } from './venue/quoteFonts';

/* A booking a host can keep.
 *
 * Built on the same bones as the quote PDF — same embedded fonts, same mark,
 * same measures — because a host who has seen one should recognise the other.
 * What differs is that a quote is a proposal and this is a record: it carries
 * the reference, the status and what was actually agreed.
 *
 * Grouped the way the cart was built, so the order on the page matches the
 * order it was assembled in and a host can check it line by line.
 */

type Line = {
  group: string;
  label: string;
  detail: string;
  amount: number | null;
  included: boolean;
};

export type BookingPdf = {
  reference: string;
  venueName: string;
  dateFrom: string | null;
  dateTo: string | null;
  guests: number | null;
  status: string | null;
  total: number | null;
  currency: string;
  bookedOn: string;
  items: Line[];
};

const CHARCOAL: [number, number, number] = [49, 49, 49];
const GOLD: [number, number, number] = [196, 162, 101];
const GOLD_DARK: [number, number, number] = [122, 100, 79];
const QUIET: [number, number, number] = [138, 135, 129];
const RULE: [number, number, number] = [224, 216, 204];

const M = 18;

export function downloadBookingPdf(b: BookingPdf) {
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
    v == null ? '—'
      : new Intl.NumberFormat('en-AU', { style: 'currency', currency: b.currency || 'AUD' }).format(v);

  const date = (s: string | null) => {
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
  y += 11;

  doc.setFont('Cormorant', 'normal');
  doc.setFontSize(28);
  doc.setTextColor(...CHARCOAL);
  doc.text(b.venueName, M, y);
  y += 8;

  /* The facts a host checks first, before any line. */
  doc.setFont('Montserrat', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...QUIET);
  const stayLine = [
    date(b.dateFrom) && date(b.dateTo) ? `${date(b.dateFrom)} to ${date(b.dateTo)}` : 'Dates to confirm',
    b.guests ? `${b.guests} guests` : null,
  ].filter(Boolean).join('  ·  ');
  doc.text(stayLine, M, y);
  y += 5.5;
  doc.text(`Reference ${b.reference}${b.status ? `  ·  ${b.status}` : ''}`, M, y);
  y += 12;

  /* Lines, grouped. A group heading is only drawn when the group changes,
     so a booking of six rooms does not repeat "Accommodation" six times. */
  let lastGroup = '';
  for (const line of b.items) {
    /* A new page before a line would fall off it, rather than after. */
    if (y > pageH - 45) {
      doc.addPage();
      y = 22;
      lastGroup = '';
    }

    if (line.group !== lastGroup) {
      y += 3;
      doc.setFont('Montserrat', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GOLD_DARK);
      doc.text(line.group.toUpperCase(), M, y, { charSpace: 1.6 });
      y += 5;
      lastGroup = line.group;
    }

    doc.setFont('Cormorant', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...CHARCOAL);
    doc.text(line.label, M, y);

    const amount = line.included ? 'Included' : money(line.amount);
    doc.setFont('Montserrat', 'normal');
    doc.setFontSize(9);
    const aw = doc.getStringUnitWidth(amount) * 9 / doc.internal.scaleFactor;
    doc.text(amount, right - aw, y);

    if (line.detail) {
      y += 4.2;
      doc.setFont('Montserrat', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...QUIET);
      doc.text(line.detail, M, y);
    }

    y += 4;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    doc.line(M, y, right, y);
    y += 5.5;
  }

  if (!b.items.length) {
    doc.setFont('Montserrat', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...QUIET);
    doc.text('This booking has not been itemised yet.', M, y);
    y += 8;
  }

  y += 4;
  doc.setDrawColor(...CHARCOAL);
  doc.setLineWidth(0.4);
  doc.line(M, y, right, y);
  y += 8;

  doc.setFont('Montserrat', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD_DARK);
  doc.text('TOTAL', M, y, { charSpace: 1.8 });

  const totalText = b.total != null && b.total > 0 ? money(b.total) : 'To be quoted';
  doc.setFont('Cormorant', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(...CHARCOAL);
  const tw = doc.getStringUnitWidth(totalText) * 20 / doc.internal.scaleFactor;
  doc.text(totalText, right - tw, y + 1);

  /* The footer says what this is, because a host will forward it and the
     person receiving it did not make the booking. */
  const footY = pageH - 16;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.15);
  doc.line(M, footY - 6, right, footY - 6);
  doc.setFont('Montserrat', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...QUIET);
  centred(`Booked ${date(b.bookedOn) ?? ''} through The Global Sanctum`, 6.5, footY - 1.5);
  centred('Aurella Group Pty Ltd · ABN 70 649 742 423 · theglobalsanctum.com', 6.5, footY + 2.5);

  doc.save(`${b.reference.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`);
}
