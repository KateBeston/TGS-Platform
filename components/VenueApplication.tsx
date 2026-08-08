'use client';

import { useState } from 'react';
import { trackOnce } from '@/lib/track';

/* The venue application.
 *
 * Six steps rather than one long form. A hundred and forty questions on
 * one screen is a form people abandon, and the answers arrive in a
 * natural order anyway — who you are, what the place is, what it holds,
 * who may come, what it costs, and then the agreements.
 *
 * Progress is kept in state, so somebody who goes back to correct
 * something does not lose the rest.
 *
 * The questions from step three onward depend on which marketplace they
 * chose. A bathhouse has no bedrooms and a retreat centre has no
 * treatment menu, and asking both of everybody is how a form gets
 * abandoned at question sixty.
 */

type Marketplace = 'Retreat' | 'Wellness' | 'Both';

const SPACE_TYPES = ['Yoga shala', 'Meditation hall', 'Movement studio',
  'Treatment rooms', 'Ceremony space', 'Outdoor deck', 'Workshop room'];

const SERVICES = ['Spa & treatments', 'Thermal & bathing', 'Massage & bodywork',
  'Movement & yoga'];

const BEDS = ['King', 'Queen', 'Double', 'Twin', 'Single', 'Bunk'];

const ACCOMMODATION = ['Air conditioning', 'Heating', 'Private balconies', 'Kitchenettes'];

const AMENITIES = ['Pool', 'Sauna', 'Hot tub or mineral pool', 'Cold plunge', 'Firepit',
  'Hiking trails', 'Spa or treatment rooms', 'Commercial kitchen', 'Dining hall',
  'Gardens', 'Beach access', 'Wifi', 'Parking'];

const WHO = ['Open to all', 'Women only', 'Men only', 'LGBTQ+ affinity',
  'Faith or community only', 'Members only', 'Adults only'];

const ORIENTATIONS = ['Secular / non-denominational', 'Faith or tradition-based',
  'Indigenous-led', 'Interfaith', 'Prefer not to say'];

const PROTOCOLS = ['No specific protocols', 'Sacred land, protocols apply',
  'Elder or custodian involvement', 'Cultural observance required'];

const HEARD = ['Google or web search', 'Instagram', 'LinkedIn', 'Pinterest',
  'The Sanctum Journal', 'A friend or colleague', 'Industry referral',
  'An event or retreat', 'Press or a publication'];

/* Each agreement at its own URL rather than as an anchor on /legal.
 *
 * These are not tabs — nobody browses to a Data Accuracy Declaration —
 * and a hash naming something not on the page opens the first tab
 * instead, which is silently wrong. Somebody clicking through to read
 * what they are signing must land on it. */
const AGREEMENTS: [string, string, string][] = [
  ['website-terms-of-use', 'Website Terms of Use', '/legal/website-terms-of-use'],
  ['venue-owner-agreement', 'Venue Owner Agreement', '/legal/venue-owner-agreement'],
  ['concierge-introduction-terms', 'Concierge Introduction Terms',
   '/legal/concierge-introduction-terms'],
  ['venue-data-accuracy-declaration', 'Venue Data Accuracy Declaration',
   '/legal/venue-data-accuracy-declaration'],
  ['health-safety-liability-declaration',
   'Venue Owner Health, Safety and Liability Declaration',
   '/legal/health-safety-liability-declaration'],
];

export default function VenueApplication({
  venueTypes, categories,
}: {
  venueTypes: { id: number; name: string; applies_to: string }[];
  categories: { id: number; name: string; in_retreat: boolean }[];
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  const [trap, setTrap] = useState('');

  const [f, setF] = useState<Record<string, any>>({
    marketplace: '' as Marketplace | '',
    whoMayAttend: [], culturalProtocols: [], spaceTypes: [],
    services: [], bedConfiguration: [], accommodationFeatures: [], amenities: [],
    retreatCategories: [], agreements: {},
    priceCurrency: 'AUD',
    signedOn: new Date().toISOString().slice(0, 10),
  });

  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));

  const toggle = (k: string, v: string) => setF((x) => {
    const list: string[] = x[k] ?? [];
    return { ...x, [k]: list.includes(v) ? list.filter((i) => i !== v) : [...list, v] };
  });

  const agree = (slug: string, on: boolean) =>
    setF((x) => ({ ...x, agreements: { ...x.agreements, [slug]: on } }));

  const isRetreat = f.marketplace === 'Retreat' || f.marketplace === 'Both';
  const isWellness = f.marketplace === 'Wellness' || f.marketplace === 'Both';

  const steps = [
    'About you', 'Your venue', 'What it holds', 'Who may come',
    'What it costs', 'Agreements',
  ];

  const submit = async () => {
    if (busy) return;
    setBusy(true); setProblem('');
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...f, website: trap }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error ?? 'That did not go through.');
      trackOnce('venue_application_submitted', {
        marketplace: f.marketplace || 'unstated',
      });
      setDone(out.reference ?? 'received');
    } catch (e: any) {
      setProblem(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="apply-done">
        <div className="section-label">Received</div>
        <h2 className="section-title">Thank you</h2>
        <p>
          Your application is with us{done !== 'received' && <> as <strong>{done}</strong></>}.
          We read every one properly rather than filtering them, so it takes a few days.
          You will hear from us either way.
        </p>
      </div>
    );
  }

  const Field = ({ label, k, type = 'text', help, wide, placeholder }: {
    label: string; k: string; type?: string; help?: string;
    wide?: boolean; placeholder?: string;
  }) => (
    <div className={`f ${wide ? 'f-wide' : ''}`}>
      <label htmlFor={`a-${k}`}>{label}</label>
      {type === 'textarea'
        ? <textarea id={`a-${k}`} rows={4} defaultValue={f[k] ?? ''}
            placeholder={placeholder}
            onBlur={(e) => set(k, e.target.value)} />
        : <input id={`a-${k}`} type={type} defaultValue={f[k] ?? ''}
            placeholder={placeholder}
            onBlur={(e) => set(k, e.target.value)} />}
      {help && <span className="help">{help}</span>}
    </div>
  );

  const Ticks = ({ label, k, options, help }: {
    label: string; k: string; options: string[]; help?: string;
  }) => (
    <div className="f f-wide">
      <label>{label}</label>
      <div className="tick-row">
        {options.map((o) => (
          <label key={o} className={`tick ${(f[k] ?? []).includes(o) ? 'is-on' : ''}`}>
            <input type="checkbox" checked={(f[k] ?? []).includes(o)}
              onChange={() => toggle(k, o)} />
            {o}
          </label>
        ))}
      </div>
      {help && <span className="help">{help}</span>}
    </div>
  );

  return (
    <div className="apply">
      <div className="apply-steps">
        {steps.map((s, i) => (
          <button key={s} type="button"
            className={`apply-step ${i === step ? 'is-on' : ''} ${i < step ? 'is-done' : ''}`}
            onClick={() => setStep(i)}>
            <span className="apply-step-n">{i + 1}</span>{s}
          </button>
        ))}
      </div>

      <div className="trap" aria-hidden="true">
        <label htmlFor="a-site">Website</label>
        <input id="a-site" tabIndex={-1} autoComplete="off"
          value={trap} onChange={(e) => setTrap(e.target.value)} />
      </div>

      {step === 0 && (
        <div className="apply-grid">
          <Field label="Salutation" k="salutation" />
          <Field label="First name" k="firstName" />
          <Field label="Surname" k="surname" />
          <Field label="Email" k="email" type="email" />
          <Field label="Phone" k="phone" />
          <Field label="Your role" k="role" placeholder="Owner, manager, agent" />
          <Field label="Business or trading name" k="businessName" wide />
          <Field label="Business or registered address" k="businessAddress" wide />
          <Field label="ABN or business number" k="abn" />
        </div>
      )}

      {step === 1 && (
        <div className="apply-grid">
          <Field label="Venue name" k="venueName" wide />
          <Field label="Location" k="location" wide
            placeholder="Town or area, and country" />

          <div className="f f-wide">
            <label>Which marketplace</label>
            <div className="tick-row">
              {(['Retreat', 'Wellness', 'Both'] as Marketplace[]).map((m) => (
                <label key={m} className={`tick ${f.marketplace === m ? 'is-on' : ''}`}>
                  <input type="radio" name="marketplace" checked={f.marketplace === m}
                    onChange={() => set('marketplace', m)} />
                  {m === 'Retreat' ? 'Retreat venue — hosts groups'
                    : m === 'Wellness' ? 'Wellness venue — sessions and visits'
                    : 'Both'}
                </label>
              ))}
            </div>
            <span className="help">
              This decides what we ask next. A bathhouse has no bedrooms and a retreat
              centre has no treatment menu.
            </span>
          </div>

          <div className="f">
            <label htmlFor="a-type">Venue type</label>
            <select id="a-type" value={f.venueTypeId ?? ''}
              onChange={(e) => set('venueTypeId', e.target.value)}>
              <option value="">Choose</option>
              {venueTypes
                .filter((t) => !f.marketplace || f.marketplace === 'Both'
                  || t.applies_to === f.marketplace)
                .map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="other">Something else</option>
            </select>
          </div>
          {f.venueTypeId === 'other' && (
            <Field label="Please specify" k="venueTypeOther" />
          )}

          <Field label="Website" k="venueWebsite" placeholder="https://" />
          <Field label="Instagram" k="instagram" />
          <Field label="Facebook" k="facebook" />
        </div>
      )}

      {step === 2 && (
        <div className="apply-grid">
          {isRetreat && (
            <>
              <Ticks label="Practice and retreat spaces" k="spaceTypes"
                options={SPACE_TYPES} />
              <Field label="Practice space capacity" k="practiceCapacity" type="number"
                help="The largest number the main space holds, seated" />
              <Ticks label="Retreat categories this venue can host"
                k="retreatCategories"
                options={categories.filter((c) => c.in_retreat).map((c) => c.name)} />
              <Field label="Accommodation capacity" k="accommodationCapacity" type="number" />
              <Field label="Total bedrooms" k="bedrooms" type="number" />
              <Field label="Ensuites" k="ensuites" type="number" />
              <Field label="Shared bathrooms" k="sharedBathrooms" type="number" />
              <Ticks label="Bed configuration" k="bedConfiguration" options={BEDS} />
              <Ticks label="Accommodation features" k="accommodationFeatures"
                options={ACCOMMODATION} />
            </>
          )}

          {isWellness && (
            <>
              <Ticks label="Services offered" k="services" options={SERVICES} />
              <Field label="Daily guest capacity" k="dailyCapacity" type="number" />
              <Field label="Experience format" k="experienceFormat"
                placeholder="Sessions, day passes, multi-day" />
            </>
          )}

          <Ticks label="Venue amenities" k="amenities" options={AMENITIES} />
          <Field label="Anything else" k="otherAmenities" wide />
        </div>
      )}

      {step === 3 && (
        <div className="apply-grid">
          <Ticks label="Who may attend" k="whoMayAttend" options={WHO}
            help="Asked now because it is far harder to ask later, and a retreat host needs it before they enquire rather than after." />
          {(f.whoMayAttend ?? []).some((w: string) =>
            w.includes('Faith') || w.includes('Members')) && (
            <Field label="Please specify" k="whoMayAttendOther" wide />
          )}

          <div className="f f-wide">
            <label>Tradition or orientation</label>
            <div className="tick-row">
              {ORIENTATIONS.map((o) => (
                <label key={o} className={`tick ${f.orientation === o ? 'is-on' : ''}`}>
                  <input type="radio" name="orientation" checked={f.orientation === o}
                    onChange={() => set('orientation', o)} />
                  {o}
                </label>
              ))}
            </div>
          </div>

          <Ticks label="Sacred or cultural protocols" k="culturalProtocols"
            options={PROTOCOLS} />
          {(f.culturalProtocols ?? []).some((p: string) => !p.startsWith('No specific')) && (
            <Field label="Where is this stated?" k="protocolsWhere" wide
              help="A page on your site, a document, or a conversation we should have" />
          )}

          <Field label="Hosting and access notes" k="hostingNotes" type="textarea" wide
            help="Anything a host or guest should know before they arrive" />
        </div>
      )}

      {step === 4 && (
        <div className="apply-grid">
          <Field label="Price from" k="priceFrom" type="number" />
          <div className="f">
            <label htmlFor="a-cur">Currency</label>
            <input id="a-cur" defaultValue={f.priceCurrency}
              onBlur={(e) => set('priceCurrency', e.target.value)} />
          </div>
          <Field label="Per" k="priceBasis"
            placeholder="Night, person per night, whole venue, session" />
          <Field label="Inclusive of" k="priceIncludes" wide
            placeholder="What that price covers" />
          <Field label="Anything you would like us to know" k="message"
            type="textarea" wide />
          <div className="f">
            <label htmlFor="a-heard">How did you hear about us</label>
            <select id="a-heard" value={f.heardAbout ?? ''}
              onChange={(e) => set('heardAbout', e.target.value)}>
              <option value="">Choose</option>
              {HEARD.map((h) => <option key={h}>{h}</option>)}
            </select>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="apply-agreements">
          <p className="apply-note">
            Five documents, each linked. We record which wording you agreed to and when,
            so a change we make later does not become something you agreed to.
          </p>

          {AGREEMENTS.map(([slug, name, href]) => (
            <label key={slug} className={`agreement ${f.agreements[slug] ? 'is-on' : ''}`}>
              <input type="checkbox" checked={!!f.agreements[slug]}
                onChange={(e) => agree(slug, e.target.checked)} />
              <span>
                I have read and agree to the <a href={href} target="_blank"
                  rel="noopener">{name}</a>
              </span>
            </label>
          ))}

          <div className="apply-grid" style={{ marginTop: 'var(--s5)' }}>
            <Field label="Full name" k="signedName"
              help="Typed as your signature" />
            <Field label="Date" k="signedOn" type="date" />
          </div>

          <label className={`agreement ${f.confirmedAccurate ? 'is-on' : ''}`}>
            <input type="checkbox" checked={!!f.confirmedAccurate}
              onChange={(e) => set('confirmedAccurate', e.target.checked)} />
            <span>
              I confirm the information I have provided is accurate, and that I am
              authorised to list this venue.
            </span>
          </label>

          <label className={`agreement ${f.wantsJournal ? 'is-on' : ''}`}>
            <input type="checkbox" checked={!!f.wantsJournal}
              onChange={(e) => set('wantsJournal', e.target.checked)} />
            <span>
              Send me The Sanctum Journal and occasional news for venue partners.
            </span>
          </label>

          {problem && <p className="enquiry-problem">{problem}</p>}
        </div>
      )}

      <div className="apply-actions">
        {step > 0 && (
          <button type="button" className="btn-line"
            onClick={() => setStep(step - 1)}>Back</button>
        )}
        {step < steps.length - 1 ? (
          <button type="button" className="btn-solid"
            onClick={() => setStep(step + 1)}>Continue</button>
        ) : (
          <button type="button" className="btn-solid" disabled={busy}
            onClick={submit}>
            {busy ? 'Sending' : 'Submit the application'}
          </button>
        )}
      </div>
    </div>
  );
}
