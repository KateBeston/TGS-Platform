import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* Venue applications.
 *
 * Honeypot, then persist, then the agreements, then the CRM. The order
 * is deliberate — an application survives ActiveCampaign being down,
 * misconfigured, or not yet wired, which it is not.
 *
 * The five agreements are recorded against the wording that was current
 * when they ticked, not against the document. A venue that agreed to
 * clause four in August did not agree to the clause four we write in
 * November, and a tick with no version behind it is a tick nobody can
 * rely on later.
 */

const AGREEMENTS = [
  'website-terms-of-use',
  'venue-owner-agreement',
  'concierge-introduction-terms',
  'venue-data-accuracy-declaration',
  'health-safety-liability-declaration',
];

const num = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));
const arr = (v: any) => (Array.isArray(v) && v.length ? v : null);

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Malformed request.' }, { status: 400 }); }

  // Filled means a script. Answered with a success so it learns nothing.
  if (String(body?.website ?? '').trim()) {
    return NextResponse.json({ ok: true, reference: null });
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const firstName = String(body?.firstName ?? '').trim();
  const venueName = String(body?.venueName ?? '').trim();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'That does not look like an email address.' },
      { status: 400 });
  }
  if (!firstName || !venueName) {
    return NextResponse.json({ error: 'A name and the venue name, at minimum.' },
      { status: 400 });
  }
  if (!body?.agreements || AGREEMENTS.some((a) => !body.agreements[a])) {
    return NextResponse.json({ error: 'All five agreements have to be accepted.' },
      { status: 400 });
  }
  if (!String(body?.signedName ?? '').trim()) {
    return NextResponse.json({ error: 'A signature — your full name.' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  try {
    const supabase = await createClient();

    const { data: app, error } = await supabase.from('venue_applications').insert({
      salutation: body.salutation || null,
      first_name: firstName,
      surname: body.surname || null,
      email,
      phone: body.phone || null,
      role: body.role || null,

      business_name: body.businessName || null,
      business_address: body.businessAddress || null,
      abn: body.abn || null,

      venue_name: venueName,
      location_text: body.location || null,
      website_url: body.venueWebsite || null,
      instagram_url: body.instagram || null,
      facebook_url: body.facebook || null,
      venue_type_other: body.venueTypeOther || null,
      marketplace: body.marketplace || null,

      practice_space_capacity: num(body.practiceCapacity),
      daily_guest_capacity: num(body.dailyCapacity),
      accommodation_capacity: num(body.accommodationCapacity),
      total_bedrooms: num(body.bedrooms),
      ensuites: num(body.ensuites),
      shared_bathrooms: num(body.sharedBathrooms),

      price_from: num(body.priceFrom),
      price_currency: body.priceCurrency || 'AUD',
      price_basis: body.priceBasis || null,
      price_includes: body.priceIncludes || null,

      who_may_attend: arr(body.whoMayAttend),
      who_may_attend_other: body.whoMayAttendOther || null,
      orientation: body.orientation || null,
      cultural_protocols: arr(body.culturalProtocols),
      protocols_stated_where: body.protocolsWhere || null,
      hosting_notes: body.hostingNotes || null,

      space_type_names: arr(body.spaceTypes),
      service_names: arr(body.services),
      bed_configuration: arr(body.bedConfiguration),
      accommodation_features: arr(body.accommodationFeatures),
      amenity_names: arr(body.amenities),
      other_amenities: body.otherAmenities || null,
      experience_format: body.experienceFormat || null,
      currently_offering: body.currentlyOffering ?? null,

      message: body.message || null,
      heard_about: body.heardAbout || null,

      signed_name: String(body.signedName).trim(),
      signed_on: body.signedOn || new Date().toISOString().slice(0, 10),
      confirmed_accurate: !!body.confirmedAccurate,
      wants_journal: !!body.wantsJournal,

      submitted_ip: ip,
      submitted_from: req.headers.get('referer') ?? null,
      utm: body.utm ?? null,
    }).select('id, reference').single();

    if (error || !app) {
      return NextResponse.json({ error: 'Could not record that. Try again shortly.' },
        { status: 500 });
    }

    await supabase.rpc('record_application_agreements', {
      p_application_id: app.id,
      p_slugs: AGREEMENTS,
      p_name: String(body.signedName).trim(),
      p_email: email,
      p_ip: ip,
    });

    if (body.wantsJournal) {
      await supabase.from('newsletter_subscribers').insert({
        email, first_name: firstName, source: 'Venue application',
      });
    }

    // ActiveCampaign and the two notification emails go here once wired.
    // After the write, so neither can lose an application.

    return NextResponse.json({ ok: true, reference: app.reference });
  } catch {
    return NextResponse.json({ error: 'Could not record that. Try again shortly.' },
      { status: 500 });
  }
}
