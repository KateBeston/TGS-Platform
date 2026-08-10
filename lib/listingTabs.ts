/* The tabs on the PUBLIC venue listing page, taken from the platform
   mockups. Each is a row in venue_tab_content keyed by tab_key.

   Distinct from the portal's own tabs: this is what a visitor sees on
   theglobalsanctum.com, and the editorial here is what stops every listing
   reading with the same generic headings. */

export type ListingTab = {
  key: string;
  label: string;
  purpose: string;
  applies_to: 'Retreat' | 'Wellness' | 'Both';
  suggests?: string;
  /** A structured source the editor can start from. */
  draws_from?: 'setting';
};

export const LISTING_TABS: ListingTab[] = [
  { key: 'overview', label: 'Overview', applies_to: 'Both',
    purpose: 'The opening statement. What this place is, in its own voice.',
    suggests: 'Two paragraphs. The first says what it is, the second why it is different.' },
  { key: 'spaces', label: 'Retreat Spaces', applies_to: 'Retreat',
    purpose: 'The shalas, studios and gathering areas.',
    suggests: 'What the spaces are for, not a list — the cards below already list them.' },
  { key: 'accommodation', label: 'Accommodation', applies_to: 'Both',
    purpose: 'Where guests sleep.',
    suggests: 'The character of the rooms. Bathroom arrangements are the most asked question.' },
  { key: 'amenities', label: 'Amenities', applies_to: 'Both',
    purpose: 'Practical facilities.',
    suggests: 'Short. The facility list carries the detail.' },
  { key: 'wellness_services', label: 'Wellness Services', applies_to: 'Both',
    purpose: 'Treatments and practitioners.',
    suggests: 'The approach rather than the menu.' },
  { key: 'wellness_facilities', label: 'Wellness Facilities', applies_to: 'Both',
    purpose: 'Pools, saunas, thermal, treatment rooms.' },
  { key: 'experiences', label: 'Experiences', applies_to: 'Both',
    purpose: 'What guests do beyond the programme.' },
  { key: 'location', label: 'Location', applies_to: 'Both',
    purpose: 'The setting and what surrounds it.',
    suggests: 'Write about the place, not the property.',
    // The recorded setting is offered here as a starting sentence. It is
    // a draft, not the copy — "on a bend of the Manning River" beats
    // "set in riverside farmland" and always will.
    draws_from: 'setting' },
  { key: 'dining', label: 'Dining', applies_to: 'Both',
    purpose: 'Food, and how it is handled.' },
  { key: 'pricing', label: 'Pricing & Booking', applies_to: 'Both',
    purpose: 'How booking works here.',
    suggests: 'Set expectations. What is included, and what is not.' },
];

export const tabsFor = (categories: string[]) =>
  LISTING_TABS.filter(
    (t) => t.applies_to === 'Both' || !categories.length || categories.includes(t.applies_to)
  );
