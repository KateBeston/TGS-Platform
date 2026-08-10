'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { buildIcal, parseIcal } from '@/lib/ical';
import { createClient } from '@/lib/supabase/server';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

export async function feedsFor(venueId: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('calendar_feeds')
    .select('*, venue_room_types(name), venue_rooms(name)')
    .eq('venue_id', venueId)
    .order('direction').order('source');
  return data ?? [];
}

export async function addFeed(
  venueId: number,
  direction: 'Read' | 'Publish',
  source: string | null,
  url: string | null,
  roomTypeId: number | null,
): Promise<Result> {
  const supabase = await createClient();

  if (direction === 'Read' && !url?.trim()) {
    return { ok: false, error: 'A feed to read needs an address.' };
  }

  const { error } = await supabase.from('calendar_feeds').insert({
    venue_id: venueId,
    room_type_id: roomTypeId,
    direction,
    source,
    url: direction === 'Read' ? url?.trim() : null,
    // Long and random. A published feed is fetched by anybody holding the
    // address, so the address is the only thing protecting it.
    token: direction === 'Publish' ? randomBytes(24).toString('base64url') : null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/venues/${venueId}/availability`);
  return { ok: true, message: direction === 'Publish' ? 'Feed created.' : 'Feed added.' };
}

/** Pulls one feed and turns its events into blocks.
 *
 *  Events are kept as they arrived, separately from the blocks they
 *  produce. A feed that changes its mind can then be reconciled rather
 *  than guessed at, and removing a feed removes its claims without
 *  touching a real booking.
 */
export async function syncFeed(feedId: number): Promise<Result> {
  const supabase = await createClient();

  const { data: feed } = await supabase.from('calendar_feeds')
    .select('*').eq('id', feedId).single();

  if (!feed) return { ok: false, error: 'No such feed.' };
  if (feed.direction !== 'Read') return { ok: false, error: 'That feed is one we publish.' };

  const fail = async (note: string) => {
    await supabase.from('calendar_feeds').update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: 'Failed',
      last_sync_note: note,
      consecutive_failures: (feed.consecutive_failures ?? 0) + 1,
    }).eq('id', feedId);
    return { ok: false as const, error: note };
  };

  let text: string;
  try {
    const res = await fetch(feed.url, {
      headers: { 'user-agent': 'TheGlobalSanctum/1.0' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return await fail(`That address returned ${res.status}.`);
    text = await res.text();
  } catch (e: any) {
    return await fail(
      e?.name === 'TimeoutError' ? 'It did not respond within 30 seconds.'
        : `Could not fetch it: ${String(e?.message ?? '').slice(0, 80)}`);
  }

  if (!/BEGIN:VCALENDAR/i.test(text)) {
    return await fail('That address does not return a calendar.');
  }

  const events = parseIcal(text);

  // Which rooms this feed speaks for. A feed against a room type covers
  // every room of that type, since that is how the other platforms sell.
  const { data: rooms } = feed.room_id
    ? { data: [{ id: feed.room_id }] }
    : await supabase.from('venue_rooms')
        .select('id')
        .eq('venue_id', feed.venue_id)
        .then((r) => feed.room_type_id
          ? supabase.from('venue_rooms').select('id')
              .eq('room_type_id', feed.room_type_id)
          : r);

  const seen: string[] = [];

  for (const e of events) {
    seen.push(e.uid);

    const { data: existing } = await supabase.from('calendar_events')
      .select('id,block_id,date_from,date_to')
      .eq('feed_id', feedId).eq('uid', e.uid).maybeSingle();

    // Unchanged, so nothing to do but note it is still there.
    if (existing && existing.date_from === e.from && existing.date_to === e.to) {
      await supabase.from('calendar_events')
        .update({ last_seen: new Date().toISOString() }).eq('id', existing.id);
      continue;
    }

    // The dates moved, so the old block no longer describes anything.
    if (existing?.block_id) {
      await supabase.from('availability_blocks').delete().eq('id', existing.block_id);
    }

    let blockId: number | null = null;
    const roomId = (rooms ?? [])[0]?.id ?? null;

    if (roomId) {
      const { data: block } = await supabase.from('availability_blocks').insert({
        venue_id: feed.venue_id,
        room_id: roomId,
        // Blocked rather than Booked. Somebody else's calendar says a
        // room is taken; it does not say TGS sold it, and calling it a
        // booking would put it in the revenue figures.
        block_type: 'Blocked',
        date_from: e.from,
        date_to: e.to,
        notes: `From ${feed.source ?? 'a calendar feed'}${e.summary ? ` — ${e.summary}` : ''}`,
      }).select('id').single();
      blockId = block?.id ?? null;
    }

    await supabase.from('calendar_events').upsert({
      feed_id: feedId,
      uid: e.uid,
      summary: e.summary,
      date_from: e.from,
      date_to: e.to,
      block_id: blockId,
      raw: e.raw.slice(0, 4000),
      last_seen: new Date().toISOString(),
    }, { onConflict: 'feed_id,uid' });
  }

  // Anything the feed no longer lists has been cancelled at the other
  // end, and its block should go with it.
  const { data: gone } = await supabase.from('calendar_events')
    .select('id,block_id').eq('feed_id', feedId)
    .not('uid', 'in', `(${seen.map((u) => `"${u}"`).join(',') || '""'})`);

  for (const g of gone ?? []) {
    if (g.block_id) {
      await supabase.from('availability_blocks').delete().eq('id', g.block_id);
    }
    await supabase.from('calendar_events').delete().eq('id', g.id);
  }

  await supabase.from('calendar_feeds').update({
    last_synced_at: new Date().toISOString(),
    last_sync_status: 'Fine',
    last_sync_note: null,
    events_last_sync: events.length,
    consecutive_failures: 0,
  }).eq('id', feedId);

  revalidatePath(`/venues/${feed.venue_id}/availability`);
  return {
    ok: true,
    message: `${events.length} dates read`
      + `${(gone ?? []).length ? `, ${(gone ?? []).length} no longer listed` : ''}.`,
  };
}

/** Every feed that is due, oldest first. */
export async function syncDueFeeds(limit = 20): Promise<Result> {
  const supabase = await createClient();

  const { data: due } = await supabase.from('calendar_feeds')
    .select('id,sync_every_minutes,last_synced_at')
    .eq('is_active', true).eq('direction', 'Read')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  let done = 0, failed = 0;
  for (const f of due ?? []) {
    const minutes = f.sync_every_minutes ?? 60;
    const age = f.last_synced_at
      ? (Date.now() - new Date(f.last_synced_at).getTime()) / 60000 : Infinity;
    if (age < minutes) continue;

    const r = await syncFeed(f.id);
    r.ok ? done++ : failed++;
  }

  return {
    ok: true,
    message: `${done} synced${failed ? `, ${failed} failed` : ''}.`,
  };
}

export async function removeFeed(feedId: number, venueId: number): Promise<Result> {
  const supabase = await createClient();

  // The blocks this feed produced go with it. They were its claims, not
  // ours, and leaving them behind would hold dates nothing is asking for.
  const { data: events } = await supabase.from('calendar_events')
    .select('block_id').eq('feed_id', feedId);

  for (const e of events ?? []) {
    if (e.block_id) await supabase.from('availability_blocks').delete().eq('id', e.block_id);
  }

  const { error } = await supabase.from('calendar_feeds').delete().eq('id', feedId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/venues/${venueId}/availability`);
  return { ok: true, message: 'Removed, with the dates it was holding.' };
}
