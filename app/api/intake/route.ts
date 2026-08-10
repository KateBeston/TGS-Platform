import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FORMS, readGeo, resolveAttribution, slugify, type IntakePayload } from '@/lib/intake';

/* ═══════════════════════════════════════════════════════════════════════
   POST /api/intake

   The single endpoint every platform form posts to.

   Authentication is a shared secret in the x-tgs-key header rather than a
   session, because the caller is a website, not a signed-in person. That
   secret must be set as INTAKE_SECRET in Vercel — without it the route
   refuses everything rather than accepting anonymous writes.

   This route uses the service role key deliberately and is the only place
   that does: an anonymous website visitor has no session, so RLS cannot
   authorise the insert. The route is the boundary — it validates the
   shared secret, accepts only known form names, and writes only the fields
   it recognises.
   ═══════════════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const cors = {
  'Access-Control-Allow-Origin': process.env.INTAKE_ORIGIN ?? 'https://www.theglobalsanctum.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-tgs-key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(req: NextRequest) {
  const secret = process.env.INTAKE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Intake is not configured.' }, { status: 503, headers: cors });
  }
  if (req.headers.get('x-tgs-key') !== secret) {
    return NextResponse.json({ error: 'Unauthorised.' }, { status: 401, headers: cors });
  }

  const sb = admin();
  if (!sb) {
    return NextResponse.json(
      { error: 'Server not configured.' }, { status: 503, headers: cors });
  }

  let body: IntakePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers: cors });
  }

  const form = FORMS[body.form];
  if (!form) {
    return NextResponse.json(
      { error: `Unknown form "${body.form}".` }, { status: 400, headers: cors });
  }

  // Honeypot. Bots fill hidden fields; people do not. Accepted with a 200
  // so the bot believes it succeeded and does not retry.
  if (typeof body._hp === 'string' && body._hp.trim() !== '') {
    return NextResponse.json({ ok: true }, { status: 200, headers: cors });
  }

  const geo = readGeo(req.headers);
  const attribution = resolveAttribution(body);
  const now = new Date().toISOString();
  const email = body.email?.trim().toLowerCase() || null;

  const geoCols = {
    lead_country_code: geo.country ?? null,
    lead_region: geo.region ?? null,
    lead_city: geo.city ?? null,
    lead_timezone: geo.timezone ?? null,
    lead_language: geo.language ?? null,
  };

  try {
    /* ── venue ─────────────────────────────────────────────────────── */
    if (form.creates === 'venue') {
      const name = body.venue_name?.trim() || body.organisation?.trim();
      if (!name) {
        return NextResponse.json(
          { error: 'A venue name is required.' }, { status: 400, headers: cors });
      }

      // Applied, not Sourced. Sourced means TGS catalogued them; Applied
      // means they came to us. Keeping that distinction is what makes the
      // new-lead queue meaningful against 5,886 imported rows.
      const { data, error } = await sb.from('venues').insert({
        venue_name: name,
        slug: slugify(name),
        website_url: body.website_url ?? null,
        contact_first_name: body.first_name ?? null,
        contact_surname: body.surname ?? null,
        contact_email: email,
        contact_phone: body.phone ?? null,
        venue_status: 'Applied',
        // How it arrived, recorded by the thing that received it. The
        // attribution below says where they came from before that, which
        // is a different fact and both are worth keeping.
        created_via: body.form === 'list-your-venue' ? 'Venue form' : 'Enquiry form',
        created_via_detail: body.form,
        lead_received_at: now,
        lead_form: body.form,
        lead_payload: body as unknown as Record<string, unknown>,
        ...attribution,
        ...geoCols,
      }).select('id').single();

      if (error) throw error;
      return NextResponse.json({ ok: true, id: data.id }, { status: 201, headers: cors });
    }

    /* ── contact ───────────────────────────────────────────────────── */
    // Match on email so a person who fills in three forms remains one
    // contact holding three roles, rather than three records whose details
    // drift apart. That is the whole point of the identity spine.
    let contactId: number | null = null;

    if (email) {
      const { data: found } = await sb
        .from('contacts').select('id').ilike('email', email).maybeSingle();
      contactId = found?.id ?? null;
    }

    if (contactId) {
      // Existing contact: update last-touch only. First touch is history
      // and must not be overwritten by a later visit.
      await sb.from('contacts').update({
        last_utm_source: attribution.last_utm_source,
        last_utm_medium: attribution.last_utm_medium,
        last_utm_campaign: attribution.last_utm_campaign,
        last_referrer: attribution.last_referrer,
        last_landing_page: attribution.last_landing_page,
        // Only fill self-reported if it was previously blank — the first
        // answer is the honest one.
        ...(attribution.heard_about_us ? {} : {}),
      }).eq('id', contactId);
    } else {
      const { data, error } = await sb.from('contacts').insert({
        first_name: body.first_name ?? null,
        surname: body.surname ?? null,
        organisation: body.organisation ?? null,
        email,
        phone: body.phone ?? null,
        website_url: body.website_url ?? null,
        entity_type: !body.first_name && !body.surname && body.organisation
          ? 'Organisation' : 'Person',
        source: body.form,
        status: 'Active',
        ...attribution,
        // After the spread so a form that carried no first-touch timestamp
        // still records when we first saw this person.
        first_touch_at: attribution.first_touch_at ?? now,
        ...geoCols,
      }).select('id').single();

      if (error) throw error;
      contactId = data.id;
    }

    // Roles are additive. A wellness guest who later enquires as a retreat
    // host holds both.
    if (contactId && form.roles?.length) {
      const { data: types } = await sb
        .from('contact_role_types').select('id,role_key').in('role_key', form.roles);
      for (const t of types ?? []) {
        await sb.from('contact_roles')
          .upsert({ contact_id: contactId, role_id: t.id }, { onConflict: 'contact_id,role_id' });
      }
    }

    return NextResponse.json({ ok: true, id: contactId }, { status: 201, headers: cors });
  } catch (e: any) {
    // Never leak a database error to a public endpoint.
    console.error('intake error', e?.message ?? e);
    return NextResponse.json(
      { error: 'Could not record the submission.' }, { status: 500, headers: cors });
  }
}
