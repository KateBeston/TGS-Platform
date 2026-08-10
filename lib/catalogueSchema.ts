/* ═══════════════════════════════════════════════════════════════════════
   CATALOGUES — the lookup tables everything else references.

   These are the lists that make the rest of the system work: what a venue
   type can be, which practices exist, what a facility is called. Editing
   them here is the difference between a system you can maintain and one
   that needs a developer for every new practice.

   SLUGS: any catalogue with `protected: true` carries the
   protect_published_slug() trigger. Changing a slug on a published row
   breaks the live URL, so the interface locks it behind an explicit
   unlock and the database refuses the change outright while published.
   ═══════════════════════════════════════════════════════════════════════ */

import type { Field } from './venueSchema';

export type Catalogue = {
  slug: string;
  table: string;
  label: string;
  blurb: string;
  protected?: boolean;              // slug is trigger-protected
  parent?: { table: string; column: string; label: string };
  titleColumn?: string;
  fields: Field[];
};

const t = (col: string, label: string, help?: string): Field => ({ col, label, type: 'text', help });
const n = (col: string, label: string): Field => ({ col, label, type: 'num' });
const b = (col: string, label: string, help?: string): Field => ({ col, label, type: 'bool', help });
const x = (col: string, label: string, help?: string): Field => ({ col, label, type: 'textarea', help });

const SEO: Field[] = [
  t('meta_title', 'Meta title'),
  x('meta_description', 'Meta description'),
  t('h1', 'H1'),
  x('intro', 'Intro copy'),
  t('hero_image_url', 'Hero image URL'),
];

export const CATALOGUES: Catalogue[] = [
  {
    slug: 'venue-types', table: 'venue_types', label: 'Venue types', protected: true,
    blurb: 'Primary classification for a venue. Drives hub pages, so each carries its own SEO fields.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'),
      { col: 'applies_to', label: 'Applies to', type: 'select', options: ['Retreat', 'Wellness', 'Both'] },
      x('description', 'Description'),
      b('is_published', 'Published'), n('display_order', 'Order'), ...SEO,
    ],
  },
  {
    slug: 'hire-types', table: 'hire_types', label: 'Hire types',
    blurb: 'How a venue may be booked. Many-to-many with venues.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'),
      { col: 'applies_to', label: 'Applies to', type: 'select', options: ['Retreat', 'Wellness', 'Both'] },
      x('description', 'Description'), n('display_order', 'Order'),
    ],
  },
  {
    slug: 'modality-categories', table: 'modality_categories', label: 'Modality categories', protected: true,
    blurb: 'The taxonomy spine. One shared set with container flags — retreat and wellness draw from the same list.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'),
      b('in_retreat', 'In retreat'), b('in_wellness', 'In wellness'),
      t('tagline', 'Tagline'), x('description', 'Description'),
      b('is_published', 'Published'), n('display_order', 'Order'), ...SEO,
    ],
  },
  {
    slug: 'modality-practices', table: 'modality_practices', label: 'Practices', protected: true,
    parent: { table: 'modality_categories', column: 'category_id', label: 'Category' },
    blurb: 'Each practice has one primary category. The five gate flags record what a practice requires before it can be offered.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'),
      b('in_retreat', 'In retreat'), b('in_wellness', 'In wellness'),
      b('hard_requirement', 'Hard requirement', 'Cannot be offered without the stated condition'),
      t('requirement_detail', 'Requirement detail'),
      b('legal_review', 'Legal / jurisdiction gate'),
      b('cultural_gate', 'Cultural gate'),
      b('health_screening', 'Health screening required'),
      b('access_condition', 'Access condition'),
      x('description', 'Description'),
      b('is_published', 'Published'), n('display_order', 'Order'), ...SEO,
    ],
  },
  {
    slug: 'facility-categories', table: 'facility_categories', label: 'Facility categories',
    blurb: 'Groups the facility catalogue. Replaces roughly 470 boolean columns from Airtable.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'),
      { col: 'applies_to', label: 'Applies to', type: 'select', options: ['Retreat', 'Wellness', 'Both'] },
      x('description', 'Description'), t('icon', 'Icon'), n('display_order', 'Order'),
    ],
  },
  {
    slug: 'facility-items', table: 'facility_items', label: 'Facility items', protected: true,
    parent: { table: 'facility_categories', column: 'facility_category_id', label: 'Category' },
    blurb: 'The individual facilities a venue can hold. Mark is_filterable to expose one in public search.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'),
      b('is_filterable', 'Filterable', 'Appears as a public search filter'),
      b('is_signature', 'Signature'),
      t('icon', 'Icon'), x('description', 'Description'),
      b('is_published', 'Published'), n('display_order', 'Order'), ...SEO,
    ],
  },
  {
    slug: 'outcomes', table: 'outcomes', label: 'Outcomes', protected: true,
    blurb: 'What a guest is seeking. A facet, not a category — relaxation, rejuvenation, and so on.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'), x('description', 'Description'),
      b('is_published', 'Published'), n('display_order', 'Order'), ...SEO,
    ],
  },
  {
    slug: 'audiences', table: 'audiences', label: 'Audiences',
    blurb: 'Who a retreat or venue is for. A facet, not a category.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'), x('description', 'Description'),
      b('is_editorial_only', 'Editorial only'), n('display_order', 'Order'),
    ],
  },
  {
    slug: 'formats', table: 'formats', label: 'Formats',
    blurb: 'How something is delivered. A facet, not a category.',
    fields: [t('name', 'Name'), t('slug', 'Slug'), x('description', 'Description'), n('display_order', 'Order')],
  },
  {
    slug: 'venue-groups', table: 'venue_groups', label: 'Venue groups', protected: true,
    blurb: 'Operators running more than one property.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'), t('website_url', 'Website'),
      x('description', 'Description'), b('is_published', 'Published'),
      n('display_order', 'Order'), ...SEO,
    ],
  },
  {
    slug: 'subscription-tiers', table: 'subscription_tiers', label: 'Subscription tiers',
    blurb: 'The commercial model. Changing a price here does not change existing Stripe subscriptions.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'), t('tagline', 'Tagline'),
      n('monthly_price', 'Monthly price'), n('annual_price', 'Annual price'), t('currency', 'Currency'),
      n('commission_rate', 'Commission rate'), n('processing_rate', 'Processing rate'),
      n('secondary_listing_fee', 'Secondary listing fee'),
      b('secondary_listing_included', 'Secondary listing included'),
      b('is_active', 'Active'), n('display_order', 'Order'),
    ],
  },
  {
    slug: 'partner-programs', table: 'partner_programs', label: 'Partner programs',
    blurb: 'Founding and Launch Partner discounts, with their venue caps.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'),
      n('discount_percent', 'Discount %'), b('is_lifetime', 'Lifetime'),
      n('venue_cap', 'Venue cap'),
      { col: 'opens_at', label: 'Opens', type: 'date' }, { col: 'closes_at', label: 'Closes', type: 'date' },
      b('is_active', 'Active'), x('description', 'Description'), n('display_order', 'Order'),
    ],
  },
  {
    slug: 'host-types', table: 'host_types', label: 'Host types', protected: true,
    blurb: 'Who is asking. The half of an enquiry that makes demand data worth having — '
         + '"fourteen yoga teachers looked for Costa Rica" is a figure only the platform '
         + 'the enquiries flow through can produce.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'), x('description', 'Description'),
      { col: 'grouping', label: 'Grouping', type: 'select',
        options: ['Movement','Breath & meditation','Bodywork & somatic',
                  'Psychological & coaching','Ceremony & spiritual','Sound & energy',
                  'Nutrition & health','Nature & outdoor','Creative',
                  'Organising & business','Other'] },
      b('needs_extra_care', 'Needs extra care',
        'Ask what is actually being run before matching. Some venues cannot host it at all.'),
      x('care_note', 'Why'),
      b('is_active', 'Active'), n('display_order', 'Order'),
    ],
  },
  {
    slug: 'retreat-outcomes', table: 'retreat_outcomes', label: 'Outcomes', protected: true,
    blurb: 'The retreat front door. People search by outcome — burnout, sleep — not by modality. '
         + 'Each earns its own page.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'), x('description', 'Description'),
      t('meta_title', 'Meta title'), x('meta_description', 'Meta description'),
      t('h1', 'H1'), x('intro', 'Intro'), t('hero_image_url', 'Hero image'),
      b('is_published', 'Published'), b('is_active', 'Active'), n('display_order', 'Order'),
    ],
  },
  {
    slug: 'retreat-audiences', table: 'retreat_audiences', label: 'Audiences', protected: true,
    blurb: 'A descriptor of what a retreat offers, authored by the host — never a filter '
         + 'pointed at people. Sensitive attributes are editorial only, so identity is not '
         + 'reduced to a checkbox.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'), x('description', 'Description'),
      b('is_editorial_only', 'Editorial only',
        'Served through curated collections rather than a dropdown'),
      b('has_entry_point', 'Has its own entry point',
        'Corporate carries different buyers and budgets, so it earns a tile without being miscategorised'),
      b('is_active', 'Active'), n('display_order', 'Order'),
    ],
  },
  {
    slug: 'retreat-formats', table: 'retreat_formats', label: 'Formats', protected: true,
    blurb: 'How a retreat runs. Silent, residential, teacher training.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'), x('description', 'Description'),
      b('is_active', 'Active'), n('display_order', 'Order'),
    ],
  },
  {
    slug: 'orientations', table: 'orientations', label: 'Venue orientations', protected: true,
    blurb: 'A venue\'s character, stated positively — Christian, Buddhist, Secular. '
         + 'What it is, not what it refuses. Separate from venues.orientation, which means '
         + 'which way the property faces.',
    fields: [
      t('name', 'Name'), t('slug', 'Slug'), x('description', 'Description'),
      b('is_active', 'Active'), n('display_order', 'Order'),
    ],
  },
];

export const getCatalogue = (slug: string) => CATALOGUES.find((c) => c.slug === slug);

export const CATALOGUE_TABLES: Record<string, { cols: Set<string>; parentCol?: string }> =
  Object.fromEntries(
    CATALOGUES.map((c) => [
      c.table,
      { cols: new Set(c.fields.map((f) => f.col)), parentCol: c.parent?.column },
    ])
  );
