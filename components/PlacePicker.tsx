'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  addLocality, citiesIn, continents as loadContinents, countriesIn,
  localitiesIn, setPlace, statesIn, type Place,
} from '@/app/actions/geography';
import { useSaveState } from './SaveState';

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '8px 10px', fontSize: 13.5, width: '100%',
};

/* ═══════════════════════════════════════════════════════════════════════
   WHERE A VENUE IS

   Continent, then country, then state, then city — each one narrowing
   what the next offers.

   Loaded a level at a time rather than all at once. There are 152,605
   cities, and sending them to a browser to be filtered there would be a
   twelve megabyte page for a field somebody uses once.

   Choosing a city sets its state and country too. Those are facts about
   the city rather than separate answers, and letting somebody pick a city
   in one country and a country in another is how the geography breaks.
   ═══════════════════════════════════════════════════════════════════════ */

export default function PlacePicker({
  venueId, initial,
}: {
  venueId: number;
  initial: {
    continent_id: number | null; country_id: number | null;
    state_id: number | null; city_id: number | null;
    locality_id?: number | null; their_wording?: string | null;
  };
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();

  const [continentId, setContinentId] = useState(initial.continent_id);
  const [countryId, setCountryId] = useState(initial.country_id);
  const [stateId, setStateId] = useState(initial.state_id);
  const [cityId, setCityId] = useState(initial.city_id);
  const [localityId, setLocalityId] = useState(initial.locality_id ?? null);

  const [continentList, setContinentList] = useState<Place[]>([]);
  const [countryList, setCountryList] = useState<Place[]>([]);
  const [stateList, setStateList] = useState<Place[]>([]);
  const [cityList, setCityList] = useState<Place[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [localityList, setLocalityList] = useState<Place[]>([]);
  const [localitySearch, setLocalitySearch] = useState('');
  const [newLocality, setNewLocality] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { loadContinents().then(setContinentList); }, []);
  useEffect(() => { countriesIn(continentId).then(setCountryList); }, [continentId]);
  useEffect(() => { statesIn(countryId).then(setStateList); }, [countryId]);

  // Debounced, because a search fires on every keystroke otherwise and
  // most of those requests are for a word half typed.
  useEffect(() => {
    const t = setTimeout(() => {
      citiesIn(stateId, countryId, citySearch).then(setCityList);
    }, 250);
    return () => clearTimeout(t);
  }, [stateId, countryId, citySearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      localitiesIn(cityId, localitySearch).then(setLocalityList);
    }, 250);
    return () => clearTimeout(t);
  }, [cityId, localitySearch]);

  const save = (level: 'country' | 'state' | 'city' | 'locality', id: number | null) =>
    start(async () => {
      report('saving');
      const r = await setPlace(venueId, level, id);
      report(r.ok ? 'saved' : 'error');
      if (!r.ok) setMsg((r as any).error);
    });

  return (
    <div className="sect">
      <h3>Where it is</h3>
      <div className="note">
        Each level narrows the next. Choosing a city sets its state and country too — those
        are facts about the city, not separate answers.
      </div>

      {msg && <div className="note bad">{msg}</div>}

      <div className="grid">
        <div className="f">
          <label htmlFor="continent">Continent</label>
          <select id="continent" style={sel} value={continentId ?? ''} disabled={pending}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setContinentId(v);
              // The country belonged to the old continent.
              if (countryId) { setCountryId(null); setStateId(null); setCityId(null);
                               save('country', null); }
            }}>
            <option value="">Anywhere</option>
            {continentList.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span className="help">Narrows the countries below</span>
        </div>

        <div className="f">
          <label htmlFor="country">Country</label>
          <select id="country" style={sel} value={countryId ?? ''} disabled={pending}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setCountryId(v); setStateId(null); setCityId(null);
              save('country', v);
            }}>
            <option value="">Not set</option>
            {countryList.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {!continentId && (
            <span className="help">{countryList.length} countries — pick a continent to narrow</span>
          )}
        </div>

        <div className="f">
          <label htmlFor="state">State or province</label>
          <select id="state" style={sel} value={stateId ?? ''}
            disabled={pending || !countryId}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setStateId(v); setCityId(null);
              save('state', v);
            }}>
            <option value="">{countryId ? 'Not set' : 'Choose a country first'}</option>
            {stateList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {countryId && !stateList.length && (
            <span className="help">This country has no states recorded</span>
          )}
        </div>

        <div className="f">
          <label htmlFor="city">City or suburb</label>
          <input data-bwignore style={{ ...sel, marginBottom: 6 }}
            placeholder={stateId || countryId ? 'Search' : 'Choose a country first'}
            disabled={pending || (!stateId && !countryId)}
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)} />
          <select id="city" style={sel} value={cityId ?? ''}
            disabled={pending || (!stateId && !countryId)}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setCityId(v); setLocalityId(null);
              save('city', v);
            }}>
            <option value="">Not set</option>
            {cityList.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <span className="help">
            {cityList.length === 200
              ? 'Showing the first 200 — search to narrow'
              : `${cityList.length} to choose from`}
          </span>
        </div>

        {/* The level venues actually sit at. Bali has twenty-five cities
            and none is Canggu; Brisbane is one city and a venue there is
            in Paddington. */}
        <div className="f">
          <label htmlFor="locality">Suburb or area</label>
          <input data-bwignore style={{ ...sel, marginBottom: 6 }}
            placeholder={cityId ? 'Search' : 'Choose a city first'}
            disabled={pending || !cityId}
            value={localitySearch}
            onChange={(e) => setLocalitySearch(e.target.value)} />
          <select id="locality" style={sel} value={localityId ?? ''}
            disabled={pending || !cityId}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setLocalityId(v); save('locality', v);
            }}>
            <option value="">Not set</option>
            {localityList.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}{l.note ? ` · ${l.note}` : ''}
              </option>
            ))}
          </select>

          {cityId && !!localitySearch.trim()
            && !localityList.some((l) =>
                 l.name.toLowerCase() === localitySearch.trim().toLowerCase()) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="link-btn" disabled={pending}
                onClick={() => start(async () => {
                  report('saving');
                  const r = await addLocality(localitySearch.trim(), cityId);
                  if (r.ok && r.id) {
                    setLocalityId(r.id);
                    await setPlace(venueId, 'locality', r.id);
                    setLocalitySearch('');
                    localitiesIn(cityId, '').then(setLocalityList);
                  }
                  report(r.ok ? 'saved' : 'error');
                  if (!r.ok) setMsg((r as any).error);
                })}>
                Add &ldquo;{localitySearch.trim()}&rdquo;
              </button>
            </div>
          )}

          <span className="help">
            {initial.their_wording && initial.their_wording !== localityList.find(
              (l) => l.id === localityId)?.name
              ? `They call it "${initial.their_wording}".`
              : 'Where a venue actually is. Add one if it is not listed — a list that has never heard of Canggu is the thing that is wrong.'}
          </span>
        </div>
      </div>
    </div>
  );
}
