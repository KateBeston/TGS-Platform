'use client';

import { useEffect, useState, useTransition } from 'react';
import { citiesFor, countriesWithVenues, statesFor } from '@/app/actions/search';

type Row = Record<string, any>;

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '7px 9px', width: '100%', fontSize: 13,
};

/* ═══════════════════════════════════════════════════════════════════════
   GEOGRAPHY FILTER — continent → country → state → city

   Each level narrows the next. Choosing Asia leaves 50 countries rather
   than 245; choosing Australia leaves its 8 states rather than 5,244.

   Countries are held in the browser because 245 is small. States and
   cities are not: there are 5,244 states and 152,605 cities, so they are
   fetched only once something above has been chosen. Cities are also
   searchable by name, because a single state can hold hundreds.

   Clearing a level clears everything below it. Leaving a stale city
   selected under a country you have just deselected produces a search
   that returns nothing for no visible reason.
   ═══════════════════════════════════════════════════════════════════════ */

export default function GeographyFilter({
  continents, countries, value, onChange,
}: {
  continents: Row[];
  countries: Row[];
  value: {
    p_continent_ids?: number[] | null;
    p_country_ids?: number[] | null;
    p_state_ids?: number[] | null;
    p_city_ids?: number[] | null;
  };
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const [, start] = useTransition();
  const [states, setStates] = useState<Row[]>([]);
  const [cities, setCities] = useState<Row[]>([]);
  const [cityQuery, setCityQuery] = useState('');
  const [onlyWithVenues, setOnlyWithVenues] = useState(false);
  const [venueCountryIds, setVenueCountryIds] = useState<number[] | null>(null);
  const [loading, setLoading] = useState<'states' | 'cities' | null>(null);

  const chosenContinents = value.p_continent_ids ?? [];
  const chosenCountries = value.p_country_ids ?? [];
  const chosenStates = value.p_state_ids ?? [];
  const chosenCities = value.p_city_ids ?? [];

  // Countries narrow to the chosen continents, and optionally to those
  // that actually hold venues.
  const visibleCountries = countries.filter((c) => {
    if (chosenContinents.length && !chosenContinents.includes(c.continent_id)) return false;
    if (onlyWithVenues && venueCountryIds && !venueCountryIds.includes(c.id)) return false;
    return true;
  });

  useEffect(() => {
    if (!onlyWithVenues || venueCountryIds) return;
    start(async () => setVenueCountryIds(await countriesWithVenues()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyWithVenues]);

  // States follow the chosen countries.
  useEffect(() => {
    if (!chosenCountries.length) { setStates([]); return; }
    setLoading('states');
    start(async () => {
      setStates(await statesFor(chosenCountries));
      setLoading(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenCountries.join(',')]);

  // Cities follow the chosen states.
  useEffect(() => {
    if (!chosenStates.length) { setCities([]); return; }
    setLoading('cities');
    start(async () => {
      setCities(await citiesFor(chosenStates, cityQuery));
      setLoading(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenStates.join(','), cityQuery]);

  /** Choosing above always clears below. A city left selected under a
   *  deselected country silently returns nothing. */
  const setContinents = (ids: number[]) => {
    const keep = countries
      .filter((c) => !ids.length || ids.includes(c.continent_id))
      .map((c) => c.id);
    const stillValid = chosenCountries.filter((id) => keep.includes(id));
    onChange({
      p_continent_ids: ids.length ? ids : null,
      p_country_ids: stillValid.length ? stillValid : null,
      p_state_ids: null,
      p_city_ids: null,
    });
  };

  const setCountries = (ids: number[]) =>
    onChange({
      p_country_ids: ids.length ? ids : null,
      p_state_ids: null,
      p_city_ids: null,
    });

  const setStatesSel = (ids: number[]) =>
    onChange({ p_state_ids: ids.length ? ids : null, p_city_ids: null });

  const setCitiesSel = (ids: number[]) =>
    onChange({ p_city_ids: ids.length ? ids : null });

  const multi = (e: React.ChangeEvent<HTMLSelectElement>) =>
    Array.from(e.target.selectedOptions, (o) => Number(o.value));

  // 101 subdivision types exist across 229 countries — province, prefecture,
  // canton, emirate, oblast. Using the real word rather than "State" means
  // the filter reads correctly wherever it is pointed.
  const types = Array.from(new Set(states.map((s) => s.state_type).filter(Boolean)));
  const stateLabel = types.length === 1
    ? String(types[0]).replace(/^\w/, (c: string) => c.toUpperCase())
    : 'State or region';

  return (
    <>
      <div className="f" style={{ marginBottom: 'var(--s3)' }}>
        <label>Continent</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {continents.map((c) => {
            const on = chosenContinents.includes(c.id);
            return (
              <button key={c.id} type="button" className={`pill ${on ? 'gold' : ''}`}
                style={{ cursor: 'pointer',
                         background: on ? undefined : 'var(--warm-white)' }}
                onClick={() => setContinents(
                  on ? chosenContinents.filter((x) => x !== c.id)
                     : [...chosenContinents, c.id])}>
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="f" style={{ marginBottom: 'var(--s3)' }}>
        <label htmlFor="gf-country">
          Country
          <span style={{ float: 'right', fontWeight: 400, textTransform: 'none',
                         letterSpacing: 0, color: 'var(--ink-quiet)' }}>
            {visibleCountries.length} of {countries.length}
          </span>
        </label>
        <select id="gf-country" multiple size={7} style={{ ...sel, height: 'auto' }}
          value={chosenCountries.map(String)}
          onChange={(e) => setCountries(multi(e))}>
          {visibleCountries.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginTop: 4, gap: 8 }}>
          <span className="help" style={{ margin: 0 }}>Ctrl or Cmd to choose several</span>
          <button type="button" className="link-btn" style={{ fontSize: 11 }}
            onClick={() => setOnlyWithVenues(!onlyWithVenues)}>
            {onlyWithVenues ? 'Show all countries' : 'Only where we have venues'}
          </button>
        </div>
      </div>

      {!!chosenCountries.length && (
        <div className="f" style={{ marginBottom: 'var(--s3)' }}>
          <label htmlFor="gf-state">
            {stateLabel}
            <span style={{ float: 'right', fontWeight: 400, textTransform: 'none',
                           letterSpacing: 0, color: 'var(--ink-quiet)' }}>
              {loading === 'states' ? 'loading…' : `${states.length}`}
            </span>
          </label>
          {states.length ? (
            <select id="gf-state" multiple size={6} style={{ ...sel, height: 'auto' }}
              value={chosenStates.map(String)}
              onChange={(e) => setStatesSel(multi(e))}>
              {states.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            <div className="help" style={{ fontStyle: 'normal' }}>
              {loading === 'states'
                ? 'Loading…'
                : 'No subdivisions recorded for the selected countries.'}
            </div>
          )}
        </div>
      )}

      {!!chosenStates.length && (
        <div className="f">
          <label htmlFor="gf-city">
            City
            <span style={{ float: 'right', fontWeight: 400, textTransform: 'none',
                           letterSpacing: 0, color: 'var(--ink-quiet)' }}>
              {loading === 'cities' ? 'loading…' : `${cities.length}${cities.length === 300 ? '+' : ''}`}
            </span>
          </label>
          <input data-bwignore value={cityQuery} placeholder="Type to narrow"
            style={{ ...sel, marginBottom: 4 }}
            onChange={(e) => setCityQuery(e.target.value)} />
          {cities.length ? (
            <select id="gf-city" multiple size={6} style={{ ...sel, height: 'auto' }}
              value={chosenCities.map(String)}
              onChange={(e) => setCitiesSel(multi(e))}>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <div className="help" style={{ fontStyle: 'normal' }}>
              {loading === 'cities' ? 'Loading…'
                : cityQuery ? 'Nothing matches that name.'
                : 'No cities recorded for the selected regions.'}
            </div>
          )}
          {cities.length === 300 && (
            <span className="help">
              First 300 shown. Type above to narrow — there are 152,605 cities in total.
            </span>
          )}
        </div>
      )}
    </>
  );
}
