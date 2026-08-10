'use client';

import VenueSearchPanel from './VenueSearchPanel';

type Row = Record<string, any>;

export default function AdvancedSearch({
  options, saved,
}: { options: Record<string, Row[]>; saved: Row[] }) {
  return <VenueSearchPanel options={options} saved={saved} />;
}
