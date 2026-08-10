/* ═══════════════════════════════════════════════════════════════════════
   VENUE SCHEMA — the single description of the venue record.

   Every field the portal can edit is declared here. Pages, forms and the
   section nav are all generated from this file, so adding a field is one
   line rather than a new screen.

   type:   text | num | textarea | bool | array | date | time | select
   src:    find  = recoverable before a call (website, maps, listings)
           ask   = confirm with the venue
           calc  = derived or system-managed
   ═══════════════════════════════════════════════════════════════════════ */

export type FieldType = 'text' | 'num' | 'textarea' | 'bool' | 'array' | 'date' | 'time' | 'select' | 'multi';
export type Source = 'find' | 'ask' | 'calc';

export type Field = {
  col: string;
  label: string;
  type?: FieldType;
  src?: Source;
  help?: string;
  options?: string[];      // for type 'select' with fixed text values
  lookup?: 'venue_types' | 'modality_categories' | 'modality_practices' | 'facility_items' | 'venue_settings' | 'climate_types' | 'award_bodies' | 'venue_brands';
};

export type Group = { title: string; note?: string; fields: Field[] };

export type ChildTable = {
  table: string;
  title: string;
  singular: string;
  note?: string;
  singleton?: boolean;     // one row per venue (venue_dining, venue_booking_settings)
  fields: Field[];
};

export type Tab = {
  slug: string;
  label: string;
  blurb?: string;
  groups?: Group[];
  children?: ChildTable[];
  /** Has its own page rather than being generated from groups. Setting is
   *  one: a distance attached to a claim is a relationship, not a field. */
  custom?: boolean;
};

const t = (col: string, label: string, src?: Source, help?: string): Field =>
  ({ col, label, type: 'text', src, help });
const n = (col: string, label: string, src?: Source, help?: string): Field =>
  ({ col, label, type: 'num', src, help });
const b = (col: string, label: string, src?: Source, help?: string): Field =>
  ({ col, label, type: 'bool', src, help });
const a = (col: string, label: string, src?: Source, help?: string): Field =>
  ({ col, label, type: 'array', src, help });
const x = (col: string, label: string, src?: Source, help?: string): Field =>
  ({ col, label, type: 'textarea', src, help });

export const VENUE_TABS: Tab[] = [
  /* ───────────────────────────────────────────────── DETAILS ───────── */
  {
    slug: 'details',
    label: 'Details',
    blurb: 'Core record. Table: venues',
    groups: [
      {
        title: 'Identification',
        fields: [
          t('venue_name', 'Venue name', 'find'),
          { col: 'venue_category', label: 'Category', type: 'multi', src: 'find',
            options: ['Retreat', 'Wellness'],
            help: 'Which marketplace(s) this venue belongs in. Both is valid.' },
          { col: 'venue_type_id', label: 'Type', type: 'select', lookup: 'venue_types', src: 'find', help: 'Specific classification' },
          t('slug', 'Slug', 'calc', 'Permanent once published'),
          t('venue_code', 'Venue code', 'calc', 'Generated'),
          n('established_year', 'Established year', 'find'),
          { col: 'property_type', label: 'What kind of building', type: 'select',
            src: 'find',
            options: ['Purpose built','Converted farmhouse','Converted barn',
                      'Converted church or monastery','Converted school',
                      'Historic house or castle','Villa','Lodge','Hotel',
                      'Eco build','Traditional or vernacular','Mixed'],
            help: 'The building, not the business. A converted farmhouse and a purpose-built centre can both be dedicated retreat centres.' },
          t('architecture_style', 'Architecture style', 'find'),


          // No database constraint on this one — the list is a convention
          // rather than an enforced set.
          { col: 'business_status', label: 'Business status', type: 'select', src: 'find',
            options: ['Operating', 'Seasonal', 'Temporarily closed', 'Permanently closed', 'Pre-opening'] },
        ],
      },
      {
        title: 'Channels',
        note: 'All read from their site rather than asked for, so they are reliable. Anything found that does not fit a named field lands in Other links.',
        fields: [
          t('website_url', 'Website', 'find'),
          t('logo_url', 'Logo', 'find',
            'Read from their site and shown at the top of every tab. Replace it if what was found is a favicon or the wrong mark.'),
          t('instagram_url', 'Instagram', 'find'),
          t('facebook_url', 'Facebook', 'find'),
          t('linkedin_url', 'LinkedIn', 'find'),
          t('youtube_url', 'YouTube', 'find'),
          t('tiktok_url', 'TikTok', 'find'),
          t('pinterest_url', 'Pinterest', 'find'),
          t('whatsapp_number', 'WhatsApp', 'find',
            'The number, not a link. A wa.me address is built from it.'),
          t('tripadvisor_url', 'TripAdvisor', 'find'),
          t('google_business_url', 'Google Business', 'find'),
          t('booking_engine_url', 'Booking engine', 'find',
            'Where they take bookings themselves — their own system, or a channel manager.'),
          { col: 'other_links', label: 'Other links', type: 'textarea', src: 'find',
            help: 'Anything found that has no field of its own. Newsletters, Vimeo, Substack, a booking platform nobody has heard of.' },
        ],
      },
      {
        title: 'Primary contact',
        fields: [
          t('contact_first_name', 'First name', 'ask'),
          t('contact_surname', 'Surname', 'ask'),
          t('contact_email', 'Email', 'ask'),
          t('contact_phone', 'Phone', 'ask'),
        ],
      },
      {
        title: 'The hosts',
        fields: [
          t('host_display_names', 'Display names', 'ask', 'How they want to be named publicly — "Sarah & James"'),
          x('host_bio', 'Host bio', 'ask'),
          x('host_quote', 'Host quote', 'ask', 'The pull quote on the Overview tab'),
          t('host_image_url', 'Host image URL', 'find'),
          n('years_hosting', 'Years hosting', 'ask'),
          n('retreats_per_year', 'Retreats per year', 'ask'),
          n('total_retreats_hosted', 'Retreats hosted in total', 'ask'),
          b('show_host_profile', 'Show host profile on the listing', 'ask'),
        ],
      },
      {
        title: 'Legal and compliance',
        fields: [
          t('legal_entity_name', 'Legal entity name', 'ask', 'Often differs from the trading name'),
          t('abn_tax_id', 'ABN or tax ID', 'ask'),
          b('gst_registered', 'GST registered', 'ask'),
          t('public_liability_insurer', 'Public liability insurer', 'ask'),
          n('public_liability_amount', 'Cover amount', 'ask'),
          { col: 'public_liability_expiry', label: 'Cover expires', type: 'date', src: 'ask' },
          a('safety_certifications', 'Safety certifications', 'ask'),
          t('water_quality_testing', 'Water quality testing', 'ask', 'Relevant for pools and thermal'),
          b('first_aid_on_site', 'First aid on site', 'ask'),
          b('defibrillator_on_site', 'Defibrillator on site', 'ask'),
          b('emergency_plan_documented', 'Emergency plan documented', 'ask'),
        ],
      },
      {
        title: 'Descriptions',
        fields: [
          x('venue_short_description', 'Short description', 'find'),
          x('venue_full_description', 'Full description', 'find'),
          a('languages', 'Languages spoken', 'ask', 'Comma separated'),
        ],
      },
      {
        title: 'Record status',
        fields: [
          // These must match venues_source_status_check exactly. Anything
          // else is rejected by the database rather than saved.
          //   Sourced   catalogued by TGS, never approached
          //   Applied   came to us via a form
          //   Contacted we have replied
          //   Accepted  agreed to list
          { col: 'venue_status', label: 'Venue status', type: 'select', src: 'calc',
            options: ['Sourced', 'Applied', 'Contacted', 'Accepted', 'Onboarding', 'Live', 'Archived'] },
          { col: 'created_via', label: 'How it arrived', type: 'select',
            src: 'calc',
            options: ['Website read','Venue form','Enquiry form','Airtable import',
                      'Bulk import','Added by hand','Brand location','API'],
            help: 'Set by whatever created the record. Distinct from where the venue was found — a venue spotted on Instagram and then harvested has both.' },
          t('created_via_detail', 'Detail', 'calc'),
          t('venue_source_type', 'Where it was found', 'ask',
            'Google, an industry referral, a directory. Set by hand where somebody went looking.'),
          b('sanctum_vetted', 'Sanctum vetted', 'calc'),
          t('data_confidence', 'Data confidence', 'calc'),
          t('verification_source', 'Verification source', 'calc'),
          t('last_verified_by', 'Last verified by', 'calc'),
        ],
      },
    ],
    children: [
      {
        table: 'venue_contacts', title: 'Contacts', singular: 'contact',
        note: 'One row per person. A phone number belongs to a person, not a building.',
        fields: [
          t('first_name', 'First name'), t('surname', 'Surname'), t('role', 'Role'),
          t('email', 'Email'), t('phone', 'Phone'), t('whatsapp', 'WhatsApp'),
          t('preferred_contact_method', 'Preferred method'), b('is_primary', 'Primary contact'),
          x('notes', 'Notes'),
        ],
      },
    ],
  },

  /* ───────────────────────────────────────────────── LOCATION ──────── */
  {
    slug: 'location',
    label: 'Location',
    blurb: 'Geography, address and surroundings',
    groups: [
      {
        title: 'Arrival — what a map cannot say',
        fields: [
          n('entrance_latitude', 'Entrance latitude', 'ask',
            'Where to actually arrive, where it differs from the address. A rural property may sit a kilometre from its gate.'),
          n('entrance_longitude', 'Entrance longitude', 'ask'),
          x('directions_note', 'Directions', 'ask',
            'The thing a venue always ends up telling guests by phone — "turn at the white gate, 400m past the church".'),
        ],
      },
      {
        title: 'Address',
        fields: [
          t('street_address', 'Street address', 'find'),
          t('postcode', 'Postcode', 'find'),
          t('locality', 'What they call it', 'find',
            'Canggu, Seseh, the Tallebudgera Valley. Often not a city and often not on any list — a retreat is usually somewhere smaller. The city below is the nearest real one, for URLs and filters.'),
          n('latitude', 'Latitude', 'find'),
          n('longitude', 'Longitude', 'find'),
          {
            col: 'coordinates_precision', label: 'How precise', type: 'select', src: 'find',
            options: ['Rooftop', 'Property', 'Street', 'Locality', 'Approximate'],
            help: 'A street-level guess shown at house zoom implies a precision that is not there.',
          },
          t('timezone', 'Timezone', 'find'),
          t('maps_url', 'Their own map link', 'find',
            'As the venue published it. Not used for display — the map is generated from the coordinates so it cannot drift out of step with a corrected address.'),
          t('google_place_id', 'Google place ID', 'find',
            'Survives a rename or an address correction, which a URL does not.'),
          n('entrance_latitude', 'Entrance latitude', 'ask',
            'Where a rural property has a long driveway, this is the coordinate a guest actually needs.'),
          n('entrance_longitude', 'Entrance longitude', 'ask'),
        ],
      },
      {
        title: 'Setting',
        fields: [
          { col: 'climate_type_id', label: 'Climate', type: 'select',
            lookup: 'climate_types', src: 'find',
            help: 'Estimated from the coordinates when a venue is geocoded, then corrected. Latitude gives a band and says nothing about altitude — a venue at 1,600 metres in the tropics is alpine.' },
          { col: 'climate_source', label: 'Where that came from', type: 'select',
            src: 'ask',
            options: ['Estimated from location', 'Stated by the venue', 'Set by hand'] },
          t('best_months', 'Best months to visit', 'ask',
            'February to May, or year round'),
          x('climate_intro', 'Before the seasons table', 'find',
            'The venue\'s own line for what the seasons do not explain — shelter, altitude, prevailing wind.'),
          x('climate_note', 'After the seasons table', 'find',
            'The closing line. "Beautiful year round, each season offers something different."'),
          t('location_tagline', 'Location tagline', 'find'),
          x('location_intro', 'Location introduction', 'find'),
          t('setting_headline', 'Setting headline', 'find'),
          x('setting_description', 'Setting description', 'find'),
          n('property_size', 'Property size', 'ask'),
          t('property_size_unit', 'Size unit', 'ask'),
          a('nearby_attractions', 'Nearby attractions', 'find'),
        ],
      },
      {
        title: 'Access',
        fields: [
          a('transport_access', 'Transport access', 'find'),
          t('nearest_transport', 'Nearest transport', 'find'),
          n('parking_spaces', 'Parking spaces', 'ask'),
          t('parking_type', 'Parking type', 'ask'),
          t('parking_notes', 'Parking notes', 'ask'),
        ],
      },
      {
        title: 'Connectivity',
        fields: [
          b('wifi_available', 'WiFi available', 'ask'),
          t('wifi_coverage', 'WiFi coverage', 'ask', 'Whole property, or common areas only'),
          n('wifi_speed_mbps', 'WiFi speed (Mbps)', 'ask'),
          t('wifi_details', 'WiFi detail', 'ask'),
          t('mobile_coverage', 'Mobile coverage', 'ask'),
          t('mobile_coverage_notes', 'Mobile coverage notes', 'ask'),
        ],
      },
      {
        title: 'Environment',
        fields: [
          a('sustainability_practices', 'Sustainability practices', 'ask'),
          x('environment_notes', 'Environment notes', 'ask'),
        ],
      },
    ],
    children: [
      { table: 'venue_distances', title: 'The local area', singular: 'place',
        note: 'Airport, town, hospital, and anywhere shown as a card on the listing. Travel times can be calculated rather than typed — a typed figure goes stale quietly. Hospital distance matters for insurance.',
        fields: [t('label', 'Label'), n('travel_value', 'Value'), t('travel_unit', 'Unit'),
                 t('category', 'Category'), x('notes', 'Notes'), n('display_order', 'Order')] },
      { table: 'venue_transfer_options', title: 'Transfers', singular: 'transfer',
        note: 'A price with no starting point cannot be compared — "$350 each way from Auckland Airport" needs the airport as much as the price.',
        fields: [
          t('title', 'Title'),
          { col: 'transfer_type', label: 'Kind', type: 'select',
            options: ['Private car','Private van','Coach','Shared shuttle','Ferry',
                      'Helicopter','Rental car guidance','Public transport',
                      'Taxi or rideshare'] },
          t('from_location', 'From where'),
          t('to_location', 'To where'),
          n('duration_minutes', 'How long, in minutes'),
          n('capacity', 'Capacity'),
          n('price', 'Price'), t('price_currency', 'Currency'),
          t('price_basis', 'Basis'),
          b('is_each_way', 'Price is each way'),
          b('is_included', 'Included'), t('included_from', 'Included from'),
          n('booking_notice_hours', 'Notice needed, in hours'),
          t('luggage_note', 'Luggage'),
          x('description', 'Description'),
          b('show_on_listing', 'Show on the listing'),
        ] },
      { table: 'venue_setting_features', title: 'Setting features', singular: 'feature',
        note: 'Native forest, a private beach, a mountain behind. These are the pictures that sell a venue, so each carries its own photograph.',
        fields: [
          t('title', 'Title'), x('description', 'Description'),
          t('image_url', 'Photograph'),
          t('image_caption', 'Caption'), t('image_credit', 'Credit'),
          { col: 'setting_id', label: 'Which setting it shows', type: 'select',
            lookup: 'venue_settings' },
          t('icon', 'Icon'),
          b('show_on_listing', 'Show on the listing'),
        ] },
      { table: 'venue_seasons', title: 'Seasons', singular: 'season',
        note: 'Include the difficult months — wet season, bushfire, closures.',
        fields: [t('season_name', 'Season'), t('months', 'Months'), n('temp_low', 'Temp low'),
                 n('temp_high', 'Temp high'), t('temp_unit', 'Unit'),
                 t('best_for', 'Best for', 'find'), b('is_peak', 'Peak season'),
                 t('rainfall_note', 'Rainfall note', 'find'),
                 x('description', 'Description'), n('display_order', 'Order')] },
    ],
  },

  /* ───────────────────────────────────────────────── SETTING ───────── */
  /* Its own tab rather than fields on Location, because setting is a
     relationship — what the venue is in, what it can reach — and a flat
     field list cannot express a distance attached to a claim. */
  {
    slug: 'setting',
    label: 'Setting',
    blurb: 'What it is in, what it can reach, and what is true of the region',
    custom: true,
    groups: [],
  },

  /* ───────────────────────────────────────────────── CAPACITY ──────── */
  {
    slug: 'capacity',
    label: 'Capacity & Policies',
    blurb: 'Numbers, beds, access and guest policy',
    groups: [
      {
        title: 'Capacity',
        fields: [
          n('max_guests', 'Maximum overnight', 'ask'),
          n('min_guests', 'Minimum guests', 'ask'),
          n('day_guest_capacity', 'Day-use capacity', 'ask'),
          n('max_concurrent_clients', 'Max concurrent clients', 'ask'),
          n('minimum_stay_nights', 'Minimum nights', 'ask'),
          n('total_bedrooms', 'Bedrooms', 'find'),
          n('total_bathrooms', 'Bathrooms', 'find'),
          n('ground_floor_rooms', 'Rooms without stairs', 'ask',
            'Not an accessibility measure — a lift reaches upper floors, and a ground floor room can still have a step at its door. Answers "can I avoid stairs", which bad knees, late pregnancy and recent surgery all ask far more often than wheelchair access.'),
          n('private_ensuites', 'Private ensuites', 'ask'),
          n('shared_bathrooms', 'Shared bathrooms', 'ask'),
          n('treatment_rooms', 'Treatment rooms', 'ask'),
          n('couples_suites', 'Couples suites', 'ask'),
          n('total_practitioners', 'Practitioners', 'ask'),
          n('floor_area', 'Floor area', 'ask'),
        ],
      },
      {
        title: 'Bed inventory',
        fields: [
          n('beds_king', 'King'), n('beds_queen', 'Queen'), n('beds_double', 'Double'),
          n('beds_single', 'Single'), n('beds_twin', 'Twin'), n('beds_bunk', 'Bunk'),
          n('beds_sofa', 'Sofa'), n('beds_rollaway', 'Rollaway'),
        ],
      },
      {
        title: 'Guest policies',
        fields: [
          b('children_allowed', 'Children allowed', 'ask'),
          n('minimum_child_age', 'Minimum child age', 'ask'),
          b('pets_allowed', 'Pets allowed', 'ask'),
          b('smoking_allowed', 'Smoking allowed', 'find'),
        ],
      },
      {
        title: 'Who may attend',
        note: 'The venue\'s own admissions policy, described as they state it. TGS lists what a venue says; the venue makes its own lawful admissions decisions and carries that responsibility. A descriptor, never a filter pointed at people.',
        fields: [
          b('has_access_restriction', 'There is an access policy', 'ask',
            'Members only, affinity, adults only, clothing optional. The pill only shows when this is true — if every venue had one it would mean nothing.'),
          { col: 'access_policy_type', label: 'What kind', type: 'select', src: 'ask',
            options: ['Affinity or community space','Members only','Adults only',
                      'Clothing optional','Women only','Men only','Other'] },
          x('access_policy_details', 'In their words', 'ask',
            'The venue\'s own wording, not a summary of it'),
          { col: 'access_policy_verified_at', label: 'Verified on',
            type: 'date', src: 'calc' },
          t('access_policy_verified_by', 'Verified by', 'calc',
            'Sensitive claims are checked by TGS so a venue cannot mislabel itself'),
        ],
      },
      {
        title: 'What may be held here',
        note: 'The matching function, and the reason a host does not book a monastery for a tantric retreat. Defensible because the subject is the venue\'s capability, never anyone\'s identity.',
        fields: [
          x('hosting_restriction_details', 'Restrictions in their words', 'ask',
            'No alcohol, modest dress, no amplified sound after 9pm'),
          b('permits_ceremony', 'Permits ceremony', 'ask'),
          b('permits_plant_medicine', 'Permits plant medicine', 'ask',
            'Varies by jurisdiction — record the venue\'s policy only, never whether it is lawful'),
        ],
      },
      {
        title: 'Cultural and sacred protocols',
        note: 'TGS never assigns a site its status. Sacred sites, elders and Indigenous protocols are community or host authored, and who wrote it is recorded — which is what makes that principle true rather than merely intended.',
        fields: [
          a('cultural_protocol_flags', 'Protocol flags', 'ask'),
          x('cultural_protocol_details', 'In their words', 'ask'),
          { col: 'cultural_protocol_authored_by', label: 'Who wrote this',
            type: 'select', src: 'ask',
            options: ['The venue','A community representative','An elder','TGS with consent'] },
          { col: 'cultural_protocol_verified_at', label: 'Verified on',
            type: 'date', src: 'calc' },
          t('cultural_protocol_verified_by', 'Verified by', 'calc'),
        ],
      },
      {
        title: 'What a retreat host may bring',
        fields: [
          b('byo_facilitator_friendly', 'Facilitators may bring their own team', 'ask'),
          b('external_practitioners_welcome', 'External practitioners welcome', 'ask'),
          b('byo_chef_permitted', 'Host may bring their own chef', 'ask'),
          b('can_arrange_services', 'Venue can arrange services', 'ask'),
          x('notes_for_retreat_hosts', 'Notes for retreat hosts', 'ask'),
          a('ideal_retreat_types', 'Ideal retreat types', 'ask'),
          x('typical_group_profile', 'Typical group', 'ask'),
          x('what_does_not_work_here', 'What does not work here', 'ask',
            'The most useful question on any venue call'),
        ],
      },
      {
        title: 'Getting in and getting around',
        note: 'The whole path, not the room. Car park to entrance, entrance to bed, bed to bathroom, and out to wherever the retreat actually happens — one step anywhere makes the rest irrelevant. Room and space level answers live on their own tabs.',
        fields: [
          {
            col: 'accessibility_source', label: 'Where this came from', type: 'select',
            src: 'ask',
            options: ['Stated on their website', 'Told to us by the venue',
                      'Verified on a site visit', 'Not known'],
            help: '"The venue says step-free access" and "we have verified it" are different statements. Only the first is ours to make until somebody has been there.',
          },
          x('accessibility_summary', 'What they say about access', 'ask',
            'In their words. Left blank where their site says nothing — never inferred, because a guest could fly somewhere and not get in.'),

          b('accessible_parking', 'Accessible parking', 'ask'),
          b('step_free_entrance', 'Step free at the entrance', 'ask'),
          b('step_free_to_dining', 'Step free to dining', 'ask'),
          b('step_free_to_practice_space', 'Step free to the practice space', 'ask',
            'The question that decides whether somebody can actually do the retreat. An accessible room they cannot leave is not access.'),
          b('elevator_access', 'Lift', 'ask'),
          x('access_path_notes', 'The path itself', 'ask',
            'Gradients, surfaces, distances, where the steps are'),

          n('accessible_rooms', 'Rooms fitted for a wheelchair', 'ask'),
          n('accessible_bathrooms', 'Accessible bathrooms', 'ask'),
          n('ground_floor_rooms', 'Rooms without stairs', 'ask',
            'Not the same as accessible — a lift reaches upper floors, and a ground floor room can still have a step at its door. Answers "can I avoid stairs", which bad knees, late pregnancy and recent surgery ask far more often.'),

          { col: 'check_in_time', label: 'Check-in time', type: 'time', src: 'find' },
          { col: 'check_out_time', label: 'Check-out time', type: 'time', src: 'find' },
          b('early_checkin_available', 'Early check-in', 'ask'),
          b('late_checkout_available', 'Late check-out', 'ask'),

          a('accessibility_features', 'Access features listed', 'ask'),
          x('accessibility_notes', 'Anything else', 'ask',
            'Bathroom dimensions, door widths, hearing loops'),
        ],
      },
    ],
    children: [
      { table: 'venue_opening_hours', title: 'Opening hours', singular: 'day',
        note: 'day_of_week: 0 = Sunday through 6 = Saturday. What these hours actually restrict — appointments, or only when reception is staffed — is set on the Scheduling tab. For a venue hired by the day they are reception hours, and a multi-day stay continues outside them.',
        fields: [n('day_of_week', 'Day (0–6)'),
                 { col: 'opens_at', label: 'Opens', type: 'time' },
                 { col: 'closes_at', label: 'Closes', type: 'time' },
                 b('is_closed', 'Closed'), x('notes', 'Notes')] },
    ],
  },

  /* ───────────────────────────────────────────────── SPACES ────────── */
  {
    slug: 'spaces',
    label: 'Spaces',
    blurb: 'One record per bookable or programmable space. Table: venue_spaces',
    children: [
      { table: 'venue_spaces', title: 'Spaces', singular: 'space',
        note: 'Confirm area, flooring, climate control and acoustics with the venue — rarely published and often inaccurate online.',
        fields: [
          t('name', 'Name', 'find'), t('space_type', 'Type', 'find'),
          n('capacity', 'Capacity (seated)', 'ask'), t('capacity_unit', 'Capacity unit'),
          n('theatre_capacity', 'Theatre', 'ask'), n('boardroom_capacity', 'Boardroom', 'ask'),
          n('classroom_capacity', 'Classroom', 'ask'),
          n('area', 'Area', 'ask'), t('area_unit', 'Area unit', 'ask'),
          t('flooring', 'Flooring', 'ask'), t('climate_control', 'Climate control', 'ask'),
          t('acoustics', 'Acoustics', 'ask'), t('lighting', 'Lighting', 'ask'),
          t('equipment_provided', 'Equipment provided', 'ask'),
          t('suitable_for', 'Suitable for', 'ask'),
          t('wet_weather_alternative', 'Wet weather alternative', 'ask'),
          { col: 'operator_brand_id', label: 'Run by', type: 'select',
            lookup: 'venue_brands', src: 'ask',
            help: 'Where a space is run by somebody other than the venue — Bamford in a hotel, a restaurant brand in a lobby. A guest often recognises the operator before the venue.' },
          t('operator_note', 'How that works', 'ask'),
          { col: 'space_role', label: 'What it is for', type: 'select', src: 'ask',
            options: ['Hireable','Guest facility','Both'],
            help: 'A retreat host looking for a shala should not be shown a gym.' },
          b('step_free_access', 'Reachable without steps', 'ask'),
          t('floor_level', 'Which floor', 'ask'),
          n('distance_from_accommodation_m', 'Metres from accommodation', 'ask'),
          t('path_surface', 'Path surface', 'ask'),
          b('path_is_lit', 'Path is lit', 'ask'),
          b('accessible_bathroom_nearby', 'Accessible bathroom nearby', 'ask'),
          x('access_notes', 'Access notes for this space', 'ask'),
          t('setting', 'Setting'), t('view_type', 'View type'), t('outlook', 'Outlook'),
          b('is_outdoor', 'Outdoor'), b('is_covered', 'Covered'),
          b('is_featured', 'Featured'), b('is_bookable', 'Bookable'),
          n('hire_price', 'Hire price', 'ask'), t('price_basis', 'Price basis'),
          t('currency', 'Currency'), b('is_included', 'Included'),
          n('minimum_hours', 'Minimum hours'),
          x('description', 'Description'), t('primary_image_url', 'Image URL'),
          n('display_order', 'Order'),
        ] },
    ],
  },

  /* ───────────────────────────────────────────── ACCOMMODATION ─────── */
  {
    slug: 'accommodation',
    label: 'Accommodation',
    blurb: 'Room types and sleeping arrangements',
    groups: [
      { title: 'Overview', fields: [x('accommodation_description', 'Accommodation description', 'find')] },
    ],
    children: [
      { table: 'venue_room_types', title: 'Room types', singular: 'room type',
        note: 'Bathroom type and bed configuration are the two most asked accommodation questions.',
        fields: [
          t('name', 'Name', 'find'), n('quantity', 'Quantity', 'find'), n('sleeps', 'Sleeps', 'find'),
          t('bed_configuration', 'Bed configuration', 'ask'), t('bathroom_type', 'Bathroom type', 'ask'),
          a('room_amenities', 'What every room has', 'find'),
          n('max_occupancy', 'Max occupancy', 'ask'), n('max_adults', 'Max adults', 'ask'),
          n('max_children', 'Max children', 'ask'), b('children_permitted', 'Children permitted', 'ask'),
          n('rollaway_beds', 'Rollaway beds', 'ask'),
          n('min_nights', 'Fewest nights', 'ask',
            'Where this room asks for more than the venue does. It may ask for more and never for less.'),
          n('max_nights', 'Most nights', 'ask'),
          { col: 'arrival_days', label: 'Days a stay may begin', type: 'array', src: 'ask',
            help: 'Day numbers, 0 for Sunday. Blank means the venue\'s answer applies.' },
          n('advance_notice_hours', 'Notice needed, in hours', 'ask'),
          n('room_size', 'Room size'), t('room_size_unit', 'Size unit'),
          t('outlook', 'Outlook'),
          b('is_accessible', 'Fitted for a wheelchair'),
          b('step_free_access', 'Reachable without steps'),
          t('floor_level', 'Which floor'),
          n('distance_from_parking_m', 'Metres from parking'),
          t('path_surface', 'Path surface'),
          x('access_notes', 'Access notes for this room'),
          a('room_amenities', 'Room amenities'),
          x('description', 'Description'), t('primary_image_url', 'Image URL'),
          n('display_order', 'Order'),
        ] },
    ],
  },

  /* ───────────────────────────────────────────────── DINING ────────── */
  {
    slug: 'dining',
    label: 'Dining',
    blurb: 'Catering capability and meal records',
    children: [
      { table: 'venue_dining', title: 'Dining capability', singular: 'dining record', singleton: true,
        note: 'One record per venue. "We can do vegan" and "we have a separate prep area" are different answers — use notes.',
        fields: [
          t('meal_service', 'Meal service', 'find'), t('default_menu_type', 'Default menu type', 'find'),
          b('dietary_catered', 'Dietary catered', 'ask'), b('beverages_included', 'Beverages included', 'ask'),
          b('chef_available', 'Chef available', 'ask'), b('self_catering', 'Self-catering permitted', 'ask'),
          x('notes', 'Notes', 'ask'),
        ] },
      { table: 'venue_meals', title: 'Meals', singular: 'meal',
        fields: [
          t('name', 'Name'), t('meal_period', 'Meal period'), t('menu_type', 'Menu type'),
          n('price', 'Price'), t('price_basis', 'Price basis'), t('currency', 'Currency'),
          b('is_included', 'Included'), n('minimum_pax', 'Min pax'), n('maximum_pax', 'Max pax'),
          a('dietary_options', 'Dietary options'), n('dietary_surcharge', 'Dietary surcharge'),
          n('notice_required_hours', 'Notice (hours)'), b('is_bookable', 'Bookable'),
          x('description', 'Description'), n('display_order', 'Order'),
        ] },
    ],
  },

  /* ─────────────────────────────────────────────── SERVICES ────────── */
  {
    slug: 'services',
    label: 'Wellness Services',
    blurb: 'Treatments and practices offered, with what they cost and how long they take',
    children: [
      { table: 'venue_services', title: 'Wellness services', singular: 'service',
        note: 'Category and practice come from the shared taxonomy — 18 categories, 106 practices — so a service can be searched on rather than only read. A treatment named "Sunset Sound Journey" is a Sound Bath, and the practice field is where that is said.',
        fields: [
          t('name', 'Their name for it', undefined,
            'As the venue writes it on their menu. This is what identifies the service — four massages all reading "Body Therapies" tells you nothing about which is which.'),
          { col: 'practice_id', label: 'What it is', type: 'select',
            lookup: 'modality_practices',
            help: 'The taxonomy practice beneath their name. This is what search uses.' },
          { col: 'category_id', label: 'Category', type: 'select',
            lookup: 'modality_categories',
            help: 'Filled from the practice. Only set directly where no practice fits.' },
          t('website_display_name', 'Display name'), t('service_type', 'Service type'),
          n('duration_minutes', 'Duration (min)'), n('base_price', 'Base price'), t('currency', 'Currency'),
          b('price_is_from', 'Price is "from"'), n('price_range_low', 'Range low'), n('price_range_high', 'Range high'),
          t('price_includes', 'Price includes'), t('what_to_bring', 'What to bring'),
          a('treatment_tags', 'Treatment tags'), a('expected_outcomes', 'Expected outcomes'),
          b('couples_available', 'Couples available'), n('min_participants', 'Min participants'),
          n('max_participants', 'Max participants'), n('advance_notice_hours', 'Notice (hours)'),
          b('is_featured', 'Featured'), b('is_bookable', 'Bookable'), b('show_on_website', 'Show on website'),
          x('description', 'Description'), t('image_url', 'Image URL'), n('display_order', 'Order'),
        ] },
      { table: 'venue_practitioners', title: 'Practitioners', singular: 'practitioner',
        note: 'Ask whether a host may bring their own practitioners — policies vary.',
        fields: [
          t('full_name', 'Full name'), t('title', 'Title'), t('credentials', 'Credentials'),
          a('languages', 'Languages'), a('specialties', 'Specialties'),
          b('show_on_website', 'Show on website'), x('bio', 'Bio'),
          t('image_url', 'Image URL'), n('display_order', 'Order'),
        ] },
      
      { table: 'venue_awards', title: 'Awards and recognition', singular: 'award',
        note: 'Only where the venue claims it in words. A logo in a footer is not a claim to repeat on their behalf.',
        fields: [
          { col: 'award_body_id', label: 'Who awarded it', type: 'select',
            lookup: 'award_bodies' },
          t('award_name', 'Or name it',  undefined,
            'For anything not on the list, which there will always be.'),
          t('level', 'Level',  undefined, 'One key, five star, gold'),
          n('year_awarded', 'Year'),
          { col: 'valid_until', label: 'Valid until', type: 'date',
            help: 'Recognition lapses. A 2019 award shown as current is a small lie a guest can check.' },
          b('is_current', 'Still current'),
          { col: 'verified_at', label: 'Verified on', type: 'date' },
          t('source_url', 'Where it says so'),
          b('show_on_listing', 'Show on the listing'),
          n('display_order', 'Order'),
        ] },
      { table: 'venue_excursions', title: 'Excursions', singular: 'excursion',
        fields: [
          t('name', 'Name'), t('duration_label', 'Duration'), t('difficulty', 'Difficulty'),
          n('price', 'Price'), t('price_basis', 'Basis'), t('currency', 'Currency'),
          x('description', 'Description'), t('image_url', 'Image URL'), n('display_order', 'Order'),
        ] },
    ],
  },

  /* ─────────────────────────────────────────────── PRICING ─────────── */
  {
    slug: 'pricing',
    label: 'Pricing',
    blurb: 'Rates, fees, deposits and cancellation',
    groups: [
      {
        title: 'Headline pricing',
        fields: [
          n('price_from', 'Price from', 'find'), t('price_unit', 'Price unit', 'find'),
          t('price_currency', 'Currency', 'find'), t('price_range_category', 'Price band', 'calc'),
          b('price_includes_tax', 'Includes tax', 'ask'), t('tax_label', 'Tax label', 'ask'),
          n('tax_rate', 'Tax rate', 'ask'),
          n('price_review_frequency_days', 'Review frequency (days)', 'calc'),
        ],
      },
    ],
    children: [
      { table: 'venue_fees', title: 'Fees', singular: 'fee',
        note: 'Cleaning, bond, linen, service charge. The gap between advertised and real is where disputes start.',
        fields: [t('name', 'Name'), n('amount', 'Amount'), t('currency', 'Currency'),
                 t('basis', 'Basis'), b('is_mandatory', 'Mandatory'), b('is_refundable', 'Refundable'),
                 x('description', 'Description'), n('display_order', 'Order')] },
      { table: 'cancellation_rules', title: 'Cancellation ladder', singular: 'rule',
        note: 'One row per step. Capture every step, not just the headline.',
        fields: [t('policy_name', 'Policy name'), t('applies_to', 'Applies to'), n('sequence', 'Sequence'),
                 n('days_before_arrival', 'Days before arrival'), n('refund_percent', 'Refund %'),
                 n('refund_fixed_amount', 'Refund fixed'), b('retain_deposit', 'Retain deposit'),
                 b('is_default', 'Default'), x('description', 'Description')] },
      { table: 'venue_seasonal_rates', title: 'Seasonal rates', singular: 'rate',
        fields: [t('rate_name', 'Rate name'), t('months', 'Months'), { col: 'date_from', label: 'From', type: 'date' as FieldType },
                 { col: 'date_to', label: 'To', type: 'date' as FieldType }, n('price', 'Price'),
                 t('price_unit', 'Unit'), t('currency', 'Currency'), n('minimum_stay_nights', 'Min nights'),
                 n('minimum_spend', 'Min spend'), b('is_popular', 'Popular'), n('display_order', 'Order')] },
      { table: 'rate_plans', title: 'Rate plans', singular: 'rate plan',
        fields: [t('name', 'Name'), t('applies_to', 'Applies to'), t('pricing_basis', 'Pricing basis'),
                 n('base_price', 'Base price'), t('currency', 'Currency'), n('minimum_charge', 'Minimum charge'),
                 n('minimum_persons', 'Min persons'), n('included_persons', 'Included persons'),
                 n('extra_person_rate', 'Extra person rate'), n('minimum_nights', 'Min nights'),
                 t('deposit_basis', 'Deposit basis'), n('deposit_value', 'Deposit value'),
                 { col: 'valid_from', label: 'Valid from', type: 'date' as FieldType },
                 { col: 'valid_to', label: 'Valid to', type: 'date' as FieldType },
                 b('is_active', 'Active'), x('notes', 'Notes')] },
      { table: 'venue_booking_settings', title: 'Booking settings', singular: 'settings record', singleton: true,
        note: 'One record per venue — everything about how they take bookings and get paid. One place, because the same facts recorded twice get filled in twice and disagree.',
        fields: [
          t('currency', 'Currency'), t('pricing_model', 'Pricing model'),
          n('base_nightly_rate', 'Base nightly rate'), n('weekend_rate', 'Weekend rate'),
          n('weekly_rate', 'Weekly rate'), n('cleaning_fee', 'Cleaning fee'),
          n('minimum_stay_default', 'Min stay default'), n('minimum_stay_weekends', 'Min stay weekends'),
          n('maximum_stay', 'Maximum stay'), n('minimum_spend', 'Minimum spend'),
          n('deposit_percent', 'Deposit %'), n('deposit_amount', 'Deposit amount'),
          t('deposit_due', 'Deposit due'), t('balance_due', 'Balance due'),
          n('security_bond', 'Security bond'), t('bond_collection_method', 'Bond method'),
          a('accepted_payment_methods', 'Payment methods'), n('payment_terms_days', 'Payment terms (days)'),
          b('accepts_invoice_payment', 'Accepts invoice'),
          t('cancellation_policy_type', 'Cancellation type'), t('cancellation_grace_period', 'Grace period'),
          x('refund_policy_details', 'Refund detail'),
          b('group_bookings_accepted', 'Group bookings'), n('max_group_size', 'Max group size'),
          b('day_pass_available', 'Day pass available'), n('day_pass_price', 'Day pass price'),
          t('day_pass_duration', 'Day pass duration'),
          b('online_booking_enabled', 'Online booking'), t('external_booking_url', 'External booking URL'),

          { col: 'booking_model', label: 'How a stay is taken', type: 'select',
            options: ['On request', 'Free sale'],
            help: 'On request means a person confirms, which is every venue today. Free sale sells against their calendar, which may be hours behind — the only one that can double book.' },
          n('request_response_hours', 'Hours to answer a request', undefined,
            'A guest waiting four days has booked elsewhere. Shorter than the seven days a card hold survives, or the hold dies first.'),
          t('bookings_email', 'Where requests go', undefined,
            'Often not the general address. A request sent to info@ sits in a shared inbox nobody answers from.'),
          t('bookings_phone', 'Bookings phone'),
          b('accepts_sms_approval', 'Will confirm by text', undefined,
            'Some venues answer a text in an hour and an email in a week.'),

          n('advance_notice_hours', 'Notice needed, in hours'),
          n('max_advance_days', 'How far ahead they take bookings', undefined,
            'A venue that has not set next year\'s rates should not be taking next year\'s bookings.'),
          n('turnaround_days', 'Days needed between groups', undefined,
            'Exclusive-use venues need this and it is invisible on a calendar — the room reads as free and is not.'),

          { col: 'payment_terms', label: 'When they get paid', type: 'select',
            options: ['As it stops being refundable','On payment received','On confirmation',
                      'On arrival','On departure','Net 7 after departure',
                      'Net 14 after departure','Net 30 after departure','Custom'],
            help: 'The default holds each portion until their own refund terms stop allowing it back. A generous refund policy means waiting longer to be paid — which is the right way round.' },
          x('payment_terms_note', 'Anything else agreed'),
          { col: 'payment_terms_agreed_at', label: 'Terms agreed on', type: 'date',
            help: 'Terms nobody agreed to are terms TGS invented, and a venue reading them for the first time during a dispute is a bad afternoon.' },
          t('payment_terms_agreed_by', 'Agreed with'),
          { col: 'refund_recourse', label: 'If a refund falls due after payout',
            type: 'select',
            options: ['Reversed through Stripe','Offset against the next booking',
                      'Invoiced to the venue','TGS absorbs it','Not yet agreed'],
            help: 'Agreed in advance, because agreeing it during a cancellation is a negotiation nobody wins. Stripe can be reversed; Wise and TorFX cannot.' },
          x('refund_recourse_note', 'How that works'),

          b('prefers_calendar_invites', 'Send calendar invites', undefined,
            'An email their mail client turns into a Yes button. Their tap is what puts it in their calendar — TGS cannot write into it.'),
          t('calendar_invite_email', 'Where invites go'),
          { col: 'subscribed_to_feed_at', label: 'Subscribed to our feed on', type: 'date',
            help: 'The backstop rather than the mechanism — Google refreshes a subscription every eight to twenty-four hours.' },
          { col: 'checkin_time', label: 'Check-in time', type: 'time' },
          { col: 'checkout_time', label: 'Check-out time', type: 'time' },
          a('permitted_arrival_days', 'Arrival days'), a('permitted_departure_days', 'Departure days'),
          a('whats_included', "What's included"),
          x('internal_notes', 'Internal notes'),
        ] },
    ],
  },

  /* ───────────────────────────────────────────────── MEDIA ─────────── */
  // Media has its own page rather than a generated tab — uploads, image
  // previews and slot guidance need a purpose-built screen.
  { slug: 'media', label: 'Media', blurb: 'Images, video and documents' },

  /* ─────────────────────────────────────────────── CONTENT ─────────── */
  {
    slug: 'record-content',
    label: 'Venue copy',
    blurb: 'Narrative held on the venue record itself',
    groups: [
      {
        title: 'Narrative',
        fields: [
          t('hero_quote', 'Hero quote', 'ask'),
          x('introduction_text', 'Introduction', 'find'),
          x('editor_note', 'Editor note', 'calc'),
          a('venue_highlights', 'Highlights', 'find'),
          a('best_for', 'Best for', 'ask'),
          a('ideal_types', 'Ideal types', 'ask'),
        ],
      },
      {
        title: 'Experience block',
        fields: [
          t('experience_title', 'Experience title', 'find'),
          t('experience_subtitle', 'Experience subtitle', 'find'),
          x('experience_description', 'Experience description', 'find'),
          t('experience_image_url', 'Experience image', 'find'),
          a('signature_treatments', 'Signature treatments', 'find'),
        ],
      },
      {
        title: 'Guest guidance',
        fields: [
          a('we_provide', 'We provide', 'ask'),
          a('please_bring', 'Please bring', 'ask'),
          a('optional_to_bring', 'Optional to bring', 'ask'),
          t('after_hours_available', 'After hours', 'ask'),
          t('pool_type', 'Pool type', 'find'),
        ],
      },
    ],
    children: [
      { table: 'venue_values', title: 'Values', singular: 'value',
        fields: [t('title', 'Title'), x('description', 'Description'), t('icon', 'Icon'),
                 n('display_order', 'Order')] },
      { table: 'venue_policies', title: 'Policies', singular: 'policy',
        note: 'Arrival, etiquette, health and safety, payment. Prose blocks shown on the listing.',
        fields: [t('policy_type', 'Policy type'), t('title', 'Title'), x('body', 'Body'),
                 b('show_on_listing', 'Show on listing'), n('display_order', 'Order')] },
      { table: 'venue_faqs', title: 'FAQs', singular: 'FAQ',
        note: 'Published FAQs are emitted as FAQPage schema. Every question here must be visible on the page.',
        fields: [t('question', 'Question'), x('answer', 'Answer'),
                 { col: 'marketplace', label: 'Marketplace', type: 'select' as FieldType,
                   options: ['Retreat', 'Wellness'], help: 'Blank applies to both' },
                 b('is_published', 'Published'), n('display_order', 'Order')] },
    ],
  },

  /* ─────────────────────────────────────────────── INTERNAL ────────── */
  {
    slug: 'internal',
    label: 'Internal',
    blurb: 'Commercial terms and working notes. Not public.',
    groups: [
      
      
      
      
      {
        title: 'Commercial',
        fields: [
          { col: 'property_condition', label: 'Condition', type: 'select', src: 'ask',
            options: ['Excellent','Good','Fair','Needs work','Under renovation','Unknown'],
            help: 'A valuation input rather than a listing fact — it appears nowhere on the public site. Judged on a visit, not from a website.' },
          n('commission_rate', 'Commission rate'), n('booking_commission_rate', 'Booking commission'),
          n('experience_commission_rate', 'Experience commission'),
          t('venue_tier_internal', 'Internal tier'), t('tier_override', 'Tier override'),
          t('market_segment', 'Market segment'),
          t('stripe_connect_status', 'Stripe Connect status'),
          t('stripe_connect_account_id', 'Stripe account ID'),
        ],
      },
      {
        title: 'Pipeline',
        fields: [
          t('lead_source', 'Lead source'), t('lead_owner', 'Lead owner'),
          { col: 'acquisition_date', label: 'Acquisition date', type: 'date' },
          { col: 'first_contact_date', label: 'First contact', type: 'date' },
          t('internal_priority', 'Priority'), a('priority_flags', 'Priority flags'),
          a('internal_tags', 'Tags'),
        ],
      },
      {
        title: 'Review & quality',
        fields: [
          // Constrained in the database (venues_internal_review_status_check)
          { col: 'internal_review_status', label: 'Review status', type: 'select',
            options: ['Not Reviewed', 'In Review', 'Approved', 'Rejected', 'Needs Work'] }, t('internal_reviewed_by', 'Reviewed by'),
          n('listing_quality_score', 'Quality score'), n('response_rate', 'Response rate'),
          b('is_featured_listing', 'Featured listing'),
          b('editorial_feature', 'Editorial feature'), t('editorial_feature_title', 'Feature title'),
          x('editorial_feature_reason', 'Feature reason'),
          { col: 'editorial_feature_until', label: 'Feature until', type: 'date' },
        ],
      },
      { title: 'Notes', fields: [x('internal_notes', 'Internal notes')] },
    ],
    children: [
      { table: 'venue_notes', title: 'Notes log', singular: 'note',
        fields: [x('body', 'Note'), t('note_type', 'Type'), t('author', 'Author'), b('is_pinned', 'Pinned')] },
    ],
  },

  /* ─────────────────────────────────────────────── LISTINGS ────────── */
  { slug: 'listings', label: 'Listings', blurb: 'Public presentation records' },
];

export const getTab = (slug: string) => VENUE_TABS.find((t) => t.slug === slug);

/** Every venue column the schema declares — used as the server-side
 *  allow-list so a typo fails loudly rather than writing a stray column. */
export const VENUE_COLUMNS = new Set(
  VENUE_TABS.flatMap((t) => t.groups ?? []).flatMap((g) => g.fields).map((f) => f.col)
);

/** Child tables and their writable columns, same purpose. */
export const CHILD_TABLES: Record<string, { cols: Set<string>; singleton: boolean }> =
  Object.fromEntries(
    VENUE_TABS.flatMap((t) => t.children ?? []).map((c) => [
      c.table,
      { cols: new Set(c.fields.map((f) => f.col)), singleton: !!c.singleton },
    ])
  );
