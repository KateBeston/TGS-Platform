import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* First-party behavioural funnel. The public site posts here on add / remove /
 * quantity change / cart view / checkout start. One row per event in
 * cart_events; session_id joins to page_views. user_id is taken from the auth
 * session server-side, never trusted from the client. This is ANALYTICS ONLY —
 * it is never the financial record of a booking. Never breaks a page: any
 * failure returns 204 quietly. */

const EVENT_TYPES = new Set(['add', 'remove', 'quantity_change', 'cart_view', 'checkout_start', 'checkout_abandon', 'book']);
const ITEM_TYPES = new Set(['room', 'exp', 'extra', 'buyout']);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const eventType = typeof body.eventType === 'string' ? body.eventType : '';
    if (!EVENT_TYPES.has(eventType)) return new NextResponse(null, { status: 204 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
    const str = (v: unknown, n: number): string | null => (typeof v === 'string' ? v.slice(0, n) : null);
    const itemType = typeof body.itemType === 'string' && ITEM_TYPES.has(body.itemType) ? body.itemType : null;

    await supabase.from('cart_events').insert({
      event_type: eventType,
      session_id: str(body.sessionId, 100),
      user_id: user?.id ?? null,
      venue_id: num(body.venueId),
      item_type: itemType,
      item_id: num(body.itemId),
      quantity: num(body.quantity),
      unit_price: num(body.unitPrice),
      currency: str(body.currency, 10),
      metadata: (body.metadata && typeof body.metadata === 'object') ? body.metadata : null,
      occurred_at: new Date().toISOString(),
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
