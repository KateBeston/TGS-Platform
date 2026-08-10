'use client';

import { useEffect, useState } from 'react';
import AutosaveSelect, { type Option } from './AutosaveSelect';
import { getCities, getStates } from '@/app/actions/venues';

/** Country -> state -> city, cascading.
 *  Cities are never loaded wholesale: there are 152,605 of them, and they
 *  are unique per state rather than per country. Always filter by state. */
export default function GeographyPicker({
  venueId, countries, countryId, stateId, cityId,
}: {
  venueId: number; countries: Option[];
  countryId: number | null; stateId: number | null; cityId: number | null;
}) {
  const [country, setCountry] = useState(countryId);
  const [state, setState] = useState(stateId);
  const [states, setStates] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);

  useEffect(() => {
    if (!country) { setStates([]); return; }
    getStates(country).then(setStates);
  }, [country]);

  useEffect(() => {
    if (!state) { setCities([]); return; }
    getCities(state).then(setCities);
  }, [state]);

  return (
    <>
      <AutosaveSelect
        venueId={venueId} column="country_id" label="Country" source="find"
        initial={country} options={countries}
        onChanged={(v) => { setCountry(v); setState(null); }}
      />
      <AutosaveSelect
        venueId={venueId} column="state_id" label="State / region" source="find"
        initial={state} options={states}
        blank={country ? 'Not set' : 'Choose a country first'}
        disabled={!country}
        help="Required for location hub pages"
        onChanged={(v) => setState(v)}
      />
      <AutosaveSelect
        venueId={venueId} column="city_id" label="City" source="find"
        initial={cityId} options={cities}
        blank={state ? 'Not set' : 'Choose a state first'}
        disabled={!state}
      />
    </>
  );
}
