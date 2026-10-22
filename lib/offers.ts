/* One shape for four different things.
 *
 * A treatment, a package, an excursion and a room extra are separate tables
 * with separate columns, and they were rendered by four separate blocks of
 * markup that had already drifted apart. They are the same object to a guest:
 * something with a name, a price, a picture and a reason to add it. Mapping
 * them into one shape means one card, and a change to how a price reads lands
 * in all four at once.
 *
 * Every field is optional because almost every field is empty today. The card
 * renders what exists and omits what does not, rather than showing a labelled
 * blank.
 */

export type OfferKind = 'exp' | 'extra' | 'package' | 'excursion';

export type OfferDetail = {
  whoFor: string | null;
  whatToBring: string | null;
  included: string[];
  goodToKnow: string | null;
  facts: { label: string; value: string }[];
};

export type Offer = {
  kind: OfferKind;
  id: number;
  name: string;
  meta: string[];
  description: string | null;
  tags: string[];
  images: string[];
  price: number | null;
  currency: string | null;
  priceFrom: boolean;
  priceBasis: string | null;
  priceAlt: string[];
  flag: string | null;
  featured: boolean;
  maxQty: number;
  /* Whether it can go in the cart.
     The cart keys on kind plus id, and its kinds are room, exp, extra and
     buyout. A package id and a service id are different rows, so routing a
     package through 'exp' would add whichever service happened to share the
     number. Packages and excursions therefore show an enquiry route until the
     cart and submitBooking learn about them as their own kinds. */
  bookable: boolean;
  /* Where a scheduled class sends the guest instead of a quantity box.
     A class is a seat in a session at a named hour, and the cart on this
     page has no way to choose one — it can only ask how many. Adding
     "2" with no session is a line the venue cannot honour and a place
     the class never reserved, so the card routes to the service's own
     page, where the session picker reads real remaining places. Null for
     everything taken at any hour, which is most things. */
  sessionHref?: string | null;
  detail: OfferDetail | null;
  /* The same thing, running longer. The advertised length is not in here
     — it is the card's own price and duration — so an empty list means
     one length only, which is most services. Each carries its own id,
     because each is its own sellable item with its own code and goes in
     the cart as its own line. */
  lengths?: { id: number; minutes: number; price: number | null;
              was?: number | null; note: string | null }[];
  /** The advertised length in minutes, for labelling the default choice
   *  beside the others. Carried as a number rather than read back out of
   *  the Duration fact's prose. */
  minutes?: number | null;
  /* Contraindications and risks, authored once on the practice behind
     this service. Never written per venue: one reviewed sentence per kind
     of risk, rather than six thousand venues each wording their own
     medical caveat. */
  safety?: {
    label: string;
    severity: string | null;
    notSuitableIf: string | null;
    note: string | null;
    requirement: string | null;
  }[];
  /** Whether anything here is serious enough to warrant the standing
   *  medical line beneath it. */
  seriousSafety?: boolean;
  /* An offer that needs no conditions met, so the price shown is the
     price paid. `was` is struck through. Conditional offers are not here
     — they are on the banner and applied at checkout, never promised as
     a price. */
  offer?: { was: number; now: number; saving: number;
            kind: string; value: number | null; title: string } | null;
};

const clean = (xs: (string | null | undefined)[]) =>
  xs.filter((x): x is string => !!x && x.trim().length > 0);

function duration(mins: number | null | undefined): string | null {
  if (!mins) return null;
  if (mins < 60) return `${mins} minutes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hour${h === 1 ? '' : 's'}`;
}

const moneyPlain = (n: number | null | undefined, c: string | null | undefined) =>
  n == null ? null : `${(c ?? 'AUD') === 'AUD' ? '$' : ''}${Number(n).toLocaleString('en-AU')}`;

/** Images for one offer, primary first, falling back to its own image_url. */
function galleryFor(media: any[], key: 'service_id' | 'package_id', id: number, fallback?: string | null) {
  const found = (media ?? []).filter((m) => m[key] === id).map((m) => m.url).filter(Boolean);
  if (found.length) return found;
  return fallback ? [fallback] : [];
}

function focusFor(rows: any[], key: 'service_id' | 'package_id', id: number): string[] {
  return (rows ?? [])
    .filter((r) => r[key] === id && r.outcomes)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((r) => r.outcomes.name);
}

export function serviceToOffer(s: any, media: any[], focus: any[]): Offer {
  const facts: { label: string; value: string }[] = [];
  const d = duration(s.duration_minutes);
  if (d) facts.push({ label: 'Duration', value: d });
  if (s.min_participants || s.max_participants) {
    facts.push({
      label: 'Group size',
      value: s.min_participants && s.max_participants
        ? `${s.min_participants} to ${s.max_participants}`
        : `Up to ${s.max_participants ?? s.min_participants}`,
    });
  }
  if (s.advance_notice_hours) {
    facts.push({
      label: 'Notice required',
      value: s.advance_notice_hours >= 24
        ? `${Math.round(s.advance_notice_hours / 24)} day${s.advance_notice_hours >= 48 ? 's' : ''}`
        : `${s.advance_notice_hours} hours`,
    });
  }
  if (s.cancellation_notice_hours) {
    facts.push({ label: 'Cancellation', value: `Free to ${s.cancellation_notice_hours} hours before` });
  }
  if (s.available_in_room) {
    facts.push({
      label: 'In your room',
      value: s.in_room_surcharge ? `Yes, ${moneyPlain(s.in_room_surcharge, s.currency)} extra` : 'Available',
    });
  }

  /* Three things the record has always held and the listing never showed.
     How it is sold is the first thing a guest needs: a single treatment,
     a course of six and a class pass are bought in completely different
     ways, and the card described all three identically. */
  /* A list since 22 October 2026: yoga is commonly a drop-in class AND
     a class pass AND a course, and one of the three was being shown as
     though it were the whole answer. Older rows may still hold a bare
     string, so both shapes read the same way. */
  const asText = (v: unknown): string | null => {
    if (Array.isArray(v)) return v.filter(Boolean).join(', ') || null;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const offered = asText(s.service_type);
  if (offered) facts.push({ label: 'How it is offered', value: offered });
  const deliveredAs = asText((s as { delivery_settings?: unknown }).delivery_settings);
  if (deliveredAs) facts.push({ label: 'Delivered as', value: deliveredAs });
  /* What it actually is, as against what this venue calls it. "Female
     Wellness" says nothing; "Lymphatic drainage" does. */
  if (s.practice && s.practice !== (s.website_display_name ?? s.name)) {
    facts.push({ label: 'Type of therapy', value: s.practice });
  }
  /* Before booking, not after. Finding out at the health step that a form
     is required is the kind of surprise that loses the booking. */
  if (s.requires_health_form) {
    facts.push({
      label: 'Health form',
      value: s.health_form_note?.trim() || 'Required before your appointment',
    });
  }

  const alt: string[] = [];
  if (s.group_price_per_person) alt.push(`${moneyPlain(s.group_price_per_person, s.currency)} per person in a group`);
  /* Only where no priced lengths exist. With them, the card lists the
     actual lengths and their actual prices, and a vague "to $X for longer
     sessions" beside that reads as a second, different answer. */
  if (!(s.lengths ?? []).length
      && s.price_range_high && s.price_range_high !== s.base_price) {
    alt.push(`to ${moneyPlain(s.price_range_high, s.currency)} for longer sessions`);
  }

  const included = clean([...(s.inclusions ?? []), s.price_includes]);
  const hasDetail = !!(s.what_to_bring || included.length || s.expected_outcomes?.length || facts.length);

  return {
    kind: 'exp',
    id: s.id,
    name: s.website_display_name ?? s.name,
    meta: clean([
      d,
      s.couples_available ? 'Available for two' : null,
      s.available_in_room ? 'Can be taken in your room' : null,
    ]),
    description: s.description ?? null,
    tags: clean([...focusFor(focus, 'service_id', s.id), ...(s.treatment_tags ?? [])]).slice(0, 4),
    images: galleryFor(media, 'service_id', s.id, s.image_url),
    /* The discounted price where an unconditional offer applies, so the
       figure on the card is the figure charged. `offer.was` carries the
       original for the strike-through. */
    price: s.offer ? Number(s.offer.now_price) : (s.base_price ?? null),
    currency: s.currency ?? null,
    priceFrom: !!s.price_is_from,
    priceBasis: s.price_basis ?? null,
    priceAlt: alt,
    flag: s.is_featured ? 'Signature' : null,
    featured: !!s.is_featured,
    maxQty: 10,
    bookable: s.is_bookable !== false,
    sessionHref: s.booking_format === 'Scheduled session' && s.slug
      ? `/experiences/${s.slug}`
      : null,
    minutes: s.duration_minutes ?? null,
    safety: (s.safety ?? []).map((f: any) => ({
      label: f.guest_label,
      severity: f.severity ?? null,
      notSuitableIf: f.not_suitable_if ?? null,
      note: f.guest_note ?? null,
      requirement: f.requirement ?? null,
    })),
    /* The standing line is shown for the severities that mean a guest
       could come to harm, and wherever the venue asks for a health form.
       Not on a cultural protocol or an age restriction, which are real
       but are not medical. */
    seriousSafety: (s.safety ?? []).some(
      (f: any) => f.severity === 'Critical' || f.severity === 'High')
      || !!s.requires_health_form,
    offer: s.offer ? {
      was: Number(s.offer.was), now: Number(s.offer.now_price),
      saving: Number(s.offer.saving), kind: s.offer.kind,
      value: s.offer.value == null ? null : Number(s.offer.value),
      title: s.offer.title,
    } : null,
    lengths: (s.lengths ?? [])
      .filter((d: any) => d.price != null)
      .map((d: any) => ({
        id: d.id, minutes: d.duration_minutes,
        /* The discounted price where there is one, so choosing a length
           shows what it costs rather than what it used to. */
        price: d.offer ? Number(d.offer.now_price) : Number(d.price),
        was: d.offer ? Number(d.offer.was) : null,
        note: d.note ?? null,
      })),
    detail: hasDetail ? {
      whoFor: (s.expected_outcomes ?? []).length ? (s.expected_outcomes ?? []).join(', ') : null,
      whatToBring: s.what_to_bring ?? null,
      included,
      goodToKnow: s.in_room_note ?? null,
      facts,
    } : null,
  };
}

export function packageToOffer(p: any, media: any[], focus: any[]): Offer {
  const facts: { label: string; value: string }[] = [];
  if (p.duration_label) facts.push({ label: 'Duration', value: p.duration_label });
  if (p.nights) facts.push({ label: 'Nights', value: String(p.nights) });
  if (p.minimum_guests || p.max_participants) {
    facts.push({
      label: 'Group size',
      value: p.minimum_guests && p.max_participants
        ? `${p.minimum_guests} to ${p.max_participants}`
        : `Up to ${p.max_participants ?? p.minimum_guests}`,
    });
  }
  if (p.booking_notice_hours) {
    facts.push({ label: 'Notice required', value: `${Math.round(p.booking_notice_hours / 24)} days` });
  }
  if (p.includes_accommodation) facts.push({ label: 'Accommodation', value: 'Included' });
  if (p.includes_meals) facts.push({ label: 'Meals', value: p.meals_included_note ?? 'Included' });
  if (p.includes_exclusive_use) facts.push({ label: 'Exclusive use', value: 'Yes' });

  const alt: string[] = [];
  if (p.price_per_person) alt.push(`${moneyPlain(p.price_per_person, p.currency)} per person`);
  if (p.price_couple) alt.push(`${moneyPlain(p.price_couple, p.currency)} for two`);
  if (p.saving_amount) alt.push(`Saving ${moneyPlain(p.saving_amount, p.currency)}`);

  const included = clean(p.inclusions ?? []);

  return {
    kind: 'package',
    id: p.id,
    name: p.name,
    meta: clean([p.tagline, p.duration_label]),
    description: p.description ?? null,
    tags: clean(focusFor(focus, 'package_id', p.id)).slice(0, 4),
    images: galleryFor(media, 'package_id', p.id, p.image_url),
    price: p.price ?? null,
    currency: p.currency ?? null,
    priceFrom: false,
    priceBasis: p.price_basis ?? null,
    priceAlt: alt,
    flag: p.is_limited_edition ? 'Limited' : (p.is_featured ? 'Signature' : null),
    featured: !!p.is_featured,
    maxQty: 6,
    /* Read from the record, as services do. It was hardcoded false, so all 18
       packages fell through to Enquire however they were set — and every one
       of them is marked bookable and priced. A package is a bigger thing than
       a massage, but that is a reason for a larger card, not for taking the
       button away. */
    bookable: p.is_bookable !== false,
    detail: (included.length || facts.length) ? {
      whoFor: null, whatToBring: null, included, goodToKnow: null, facts,
    } : null,
  };
}

export function excursionToOffer(e: any): Offer {
  const facts: { label: string; value: string }[] = [];
  if (e.duration_label) facts.push({ label: 'Duration', value: e.duration_label });
  if (e.difficulty) facts.push({ label: 'Difficulty', value: e.difficulty });

  return {
    kind: 'excursion',
    id: e.id,
    name: e.name,
    meta: clean([e.duration_label, e.difficulty]),
    description: e.description ?? null,
    tags: clean([e.difficulty]),
    images: e.image_url ? [e.image_url] : [],
    price: e.price ?? null,
    currency: e.currency ?? null,
    priceFrom: false,
    priceBasis: e.price_basis ?? null,
    priceAlt: [],
    flag: null,
    featured: false,
    maxQty: 10,
    bookable: false,
    detail: facts.length ? { whoFor: null, whatToBring: null, included: [], goodToKnow: null, facts } : null,
  };
}

export function extraToOffer(x: any): Offer {
  return {
    kind: 'extra',
    id: x.id,
    name: x.name,
    meta: clean([x.extra_category]),
    description: x.description ?? null,
    tags: [],
    images: [],
    price: x.price ?? null,
    currency: x.currency ?? null,
    priceFrom: false,
    priceBasis: x.price_basis ?? null,
    priceAlt: [],
    flag: null,
    featured: false,
    maxQty: x.maximum_quantity ?? 20,
    bookable: true,
    detail: null,
  };
}
