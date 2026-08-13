import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* Location type-ahead for the hero (and, later, the venues filter).
 *
 * Searches all five geography levels — continent, country, state, city,
 * suburb — via the geo_search database function, which returns each match
 * with a disambiguating context ("New South Wales, Australia") and a params
 * object carrying the full slug path so the venue filter can pin the exact
 * place. Slugs are not globally unique, so the path matters.
 *
 * Degrades to an empty list if the function is not yet installed, so the
 * field never errors before its migration is run.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('geo_search', { q });
    if (error) return NextResponse.json({ results: [] });
    return NextResponse.json({ results: data ?? [] });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
