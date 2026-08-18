import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* Live stay quote.
 *
 * A thin wrapper over price_a_stay, the database function that does all the
 * real work — rate resolution, seasonal overlay, fees, one offer, deposit,
 * currency. We only validate the inputs and hand back what it returns. The
 * function is SECURITY DEFINER, so the anon caller here can price a stay
 * without the rate tables being publicly readable. */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Malformed request.' }, { status: 400 }); }

  const venueId = Number(body?.venueId);
  const from = String(body?.from ?? '').trim();
  const to = String(body?.to ?? '').trim();
  const guests = body?.guests != null ? Number(body.guests) : null;
  const presentIn = body?.presentIn ? String(body.presentIn).trim() : null;

  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!venueId || !isDate(from) || !isDate(to)) {
    return NextResponse.json({ error: 'A venue and two dates are needed.' }, { status: 400 });
  }
  if (to <= from) {
    return NextResponse.json({ error: 'The end has to come after the start.' }, { status: 400 });
  }
  if (guests != null && (!Number.isFinite(guests) || guests < 1)) {
    return NextResponse.json({ error: 'Guests must be a positive number.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('price_a_stay', {
    p_venue_id: venueId, p_from: from, p_to: to,
    p_guests: guests, p_rate_plan_id: null, p_present_in: presentIn,
  });

  if (error) {
    return NextResponse.json({ error: 'The quote could not be calculated.' }, { status: 500 });
  }
  return NextResponse.json({ quote: data });
}
