/* Tabs for the Analytics section.
   `live` marks a tab that has real data behind it today. The rest render
   an honest empty state naming what they are waiting on — a dashboard
   showing invented numbers is worse than one showing none. */

export type AnalyticsTab = {
  slug: string;
  label: string;
  blurb: string;
  live: boolean;
  waitingOn?: string;
};

export const ANALYTICS_TABS: AnalyticsTab[] = [
  { slug: 'overview', label: 'Overview', live: true,
    blurb: 'The house at a glance' },
  { slug: 'acquisition', label: 'Acquisition', live: true,
    blurb: 'Where leads and traffic come from' },
  { slug: 'venues', label: 'Venues', live: true,
    blurb: 'Supply — catalogue depth, enrichment, geography' },
  { slug: 'bookings', label: 'Bookings', live: false,
    blurb: 'Conversion, seasonality and lead times',
    waitingOn: 'the first booking' },
  { slug: 'revenue', label: 'Revenue', live: false,
    blurb: 'Commission, subscriptions and profit by division',
    waitingOn: 'the first subscription or booking' },
  { slug: 'content', label: 'Content', live: false,
    blurb: 'Journal, Quarterly and Wellness Edit performance',
    waitingOn: 'published editorial and a Search Console connection' },
];

export const getAnalyticsTab = (slug: string) =>
  ANALYTICS_TABS.find((t) => t.slug === slug);
