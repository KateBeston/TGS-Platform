import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* First-party page view recording. The public site posts here on every
 * route change; we write one row to page_views. Venue pages
 * (/wellness-venues/[slug], /retreat-venues/[slug]) are attributed to the
 * listing so the portal's per-listing stats work; everything else is a
 * generic 'page' keyed by path, which powers the site-wide traffic view.
 *
 * Analytics must never break a page: any failure returns 204 quietly. */

const VENUE_SEGMENTS = new Set(['wellness-venues', 'retreat-venues']);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPath = typeof body.path === 'string' ? body.path : '';
    if (!rawPath) return new NextResponse(null, { status: 204 });

    const path = rawPath.split('?')[0].slice(0, 500);
    const supabase = await createClient();

    let entity_type = 'page';
    let entity_id: number | null = null;

    const segments = path.split('/').filter(Boolean);
    if (segments.length === 2 && VENUE_SEGMENTS.has(segments[0])) {
      const { data: listing } = await supabase
        .from('venue_listings').select('id').eq('slug', segments[1]).maybeSingle();
      if (listing) { entity_type = 'listing'; entity_id = listing.id as number; }
    }

    await supabase.from('page_views').insert({
      path,
      entity_type,
      entity_id,
      referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null,
      session_id: typeof body.sessionId === 'string' ? body.sessionId.slice(0, 100) : null,
      occurred_at: new Date().toISOString(),
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
