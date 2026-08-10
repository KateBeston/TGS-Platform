'use client';

import { useState, useTransition } from 'react';
import {
  cancelSubscription, createSubscription, saveSubscriptionField,
} from '@/app/actions/subscriptions';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const STATUSES = ['Pending', 'Trialing', 'Active', 'Past Due', 'Cancelled', 'Expired'];
const LIVE = ['Pending', 'Trialing', 'Active', 'Past Due'];

const money = (v: any, cur = 'AUD') =>
  v == null ? '—' : `${cur} ${Number(v).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;

export default function SubscriptionEditor({
  venueId, subscriptions, tiers, programs, listingCount,
}: {
  venueId: number; subscriptions: Row[]; tiers: Row[]; programs: Row[]; listingCount: number;
}) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [newTier, setNewTier] = useState('');

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const res = await fn();
    setMsg(res.ok ? (res.message ?? 'Saved.') : res.error);
    report(res.ok ? 'saved' : 'error', res.ok ? undefined : 'Failed');
  });

  const current = subscriptions.find((s) => LIVE.includes(s.status));
  const history = subscriptions.filter((s) => s !== current);

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Subscription</h2>
          <div className="ph-sub">
            What this venue pays, and what TGS earns on each booking
          </div>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {!current && (
        <>
          <div className="note">
            <strong>No subscription.</strong> Every venue in the catalogue starts here — the 5,886
            imported records are sourced, not signed. Adding one sets the commission rate that
            applies to bookings through this venue.
          </div>

          <div className="sect">
            <h3>Start a subscription</h3>
            <div style={{ display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))',
                          gap: 'var(--s3)', marginBottom: 'var(--s4)' }}>
              {tiers.map((t) => (
                <button key={t.id} type="button" onClick={() => setNewTier(String(t.id))}
                  style={{ textAlign: 'left', padding: 'var(--s4)', cursor: 'pointer',
                           background: 'var(--warm-white)',
                           border: newTier === String(t.id)
                             ? '2px solid var(--gold)' : '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 21 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-quiet)', marginTop: 2 }}>
                    {t.tagline}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 'var(--s3)' }}>
                    {Number(t.monthly_price) === 0
                      ? 'No monthly fee'
                      : `${t.currency} ${t.monthly_price}/mo · ${t.currency} ${t.annual_price}/yr`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-gold)', marginTop: 2 }}>
                    {t.commission_rate}% commission
                  </div>
                </button>
              ))}
            </div>
            <button className="btn" disabled={pending || !newTier}
              onClick={() => act(() => createSubscription(venueId, Number(newTier)))}>
              Create subscription
            </button>
          </div>
        </>
      )}

      {current && (
        <Current sub={current} venueId={venueId} tiers={tiers} programs={programs}
                 act={act} pending={pending} listingCount={listingCount} />
      )}

      {!!history.length && (
        <div className="sect">
          <h3>History</h3>
          <table>
            <thead>
              <tr><th>Tier</th><th>Status</th><th>Started</th><th>Ended</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id}>
                  <td>{tiers.find((t) => t.id === s.tier_id)?.name ?? '—'}</td>
                  <td><span className="pill empty">{s.status}</span></td>
                  <td className="v-slug">
                    {s.started_at ? new Date(s.started_at).toLocaleDateString('en-AU') : '—'}
                  </td>
                  <td className="v-slug">
                    {s.cancelled_at ? new Date(s.cancelled_at).toLocaleDateString('en-AU') : '—'}
                  </td>
                  <td className="v-slug">{s.cancellation_reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div></div>
  );
}

function Current({
  sub, venueId, tiers, programs, act, pending, listingCount,
}: {
  sub: Row; venueId: number; tiers: Row[]; programs: Row[];
  act: (fn: () => Promise<any>) => void; pending: boolean; listingCount: number;
}) {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  const save = (col: string, val: unknown) =>
    act(() => saveSubscriptionField(sub.id, venueId, col, val));

  const tier = tiers.find((t) => t.id === sub.tier_id);
  const program = programs.find((p) => p.id === sub.partner_program_id);
  const secondaryDue = listingCount > 1 && !sub.secondary_listing_included;

  const sel = { background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                padding: '8px 10px', width: '100%', fontSize: 13 };

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="v" style={{ fontSize: 26 }}>{tier?.name ?? '—'}</div>
          <div className="l">Tier</div>
        </div>
        <div className="stat">
          <div className="v" style={{ fontSize: 26 }}>{money(sub.charged_price, sub.currency)}</div>
          <div className="l">Charged {sub.billing_period?.toLowerCase()}</div>
        </div>
        <div className="stat">
          <div className="v" style={{ fontSize: 26 }}>{sub.commission_rate ?? '—'}%</div>
          <div className="l">Commission</div>
        </div>
        <div className="stat">
          <div className="v" style={{ fontSize: 26 }}>
            {sub.discount_percent ? `${sub.discount_percent}%` : '—'}
          </div>
          <div className="l">Partner discount</div>
        </div>
      </div>

      <div className="note">
        <strong>Price and commission are derived, not typed.</strong> They come from the tier and
        any partner program, and recalculate whenever either changes — so the three figures can
        never disagree with each other.
        {sub.is_complimentary && ' This subscription is complimentary, so the charged price is zero regardless of tier.'}
      </div>

      <div className="sect">
        <h3>Plan</h3>
        <div className="grid">
          <div className="f">
            <label>Tier</label>
            <select defaultValue={sub.tier_id ?? ''} disabled={pending} style={sel}
              onChange={(e) => save('tier_id', Number(e.target.value))}>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="f">
            <label>Billing period</label>
            <select defaultValue={sub.billing_period ?? 'Monthly'} disabled={pending} style={sel}
              onChange={(e) => save('billing_period', e.target.value)}>
              <option>Monthly</option><option>Annual</option>
            </select>
          </div>

          <div className="f">
            <label>Partner program</label>
            <select defaultValue={sub.partner_program_id ?? ''} disabled={pending} style={sel}
              onChange={(e) => save('partner_program_id',
                e.target.value ? Number(e.target.value) : null)}>
              <option value="">None</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.discount_percent ? ` · ${p.discount_percent}% off` : ''}
                  {p.is_lifetime ? ' lifetime' : ''}
                </option>
              ))}
            </select>
            {program?.venue_cap && (
              <span className="help">Capped at {program.venue_cap} venues</span>
            )}
          </div>

          <div className="f">
            <label>Status</label>
            <select defaultValue={sub.status} disabled={pending} style={sel}
              onChange={(e) => save('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="sect">
        <h3>Pricing</h3>
        <table>
          <tbody>
            <tr><td style={{ width: 240, color: 'var(--ink-quiet)' }}>List price</td>
              <td>{money(sub.list_price, sub.currency)} {sub.billing_period?.toLowerCase()}</td></tr>
            <tr><td style={{ color: 'var(--ink-quiet)' }}>Partner discount</td>
              <td>{sub.discount_percent ? `${sub.discount_percent}%` : 'None'}</td></tr>
            <tr><td style={{ color: 'var(--ink-quiet)' }}>Charged</td>
              <td><strong>{money(sub.charged_price, sub.currency)}</strong></td></tr>
            <tr><td style={{ color: 'var(--ink-quiet)' }}>Booking commission</td>
              <td>{sub.commission_rate ?? '—'}%</td></tr>
            <tr><td style={{ color: 'var(--ink-quiet)' }}>Second listing</td>
              <td>
                {sub.secondary_listing_included
                  ? 'Included'
                  : `${money(sub.secondary_listing_fee, sub.currency)} per month`}
                {secondaryDue && (
                  <span style={{ color: 'var(--warn)' }}>
                    {' '}· this venue has {listingCount} listings, so a fee applies
                  </span>
                )}
              </td></tr>
          </tbody>
        </table>

        <div className="grid" style={{ marginTop: 'var(--s4)' }}>
          <div className="f">
            <label>Complimentary</label>
            <div className="tri">
              <button type="button" className={sub.is_complimentary ? 'on' : ''}
                onClick={() => save('is_complimentary', true)}>Yes</button>
              <button type="button" className={!sub.is_complimentary ? 'on' : ''}
                onClick={() => save('is_complimentary', false)}>No</button>
            </div>
            <span className="help">Charged price becomes zero, commission is unaffected</span>
          </div>
          <DateField label="Complimentary until" initial={sub.complimentary_until}
                     onSave={(v) => save('complimentary_until', v)} />
        </div>
      </div>

      <div className="sect">
        <h3>Dates and Stripe</h3>
        <div className="grid">
          <DateField label="Started" initial={sub.started_at} onSave={(v) => save('started_at', v)} />
          <DateField label="Trial ends" initial={sub.trial_ends_at}
                     onSave={(v) => save('trial_ends_at', v)} />
          <DateField label="Current period ends" initial={sub.current_period_end}
                     onSave={(v) => save('current_period_end', v)} />
          <TextField label="Stripe customer ID" initial={sub.stripe_customer_id}
                     onSave={(v) => save('stripe_customer_id', v)} />
          <TextField label="Stripe subscription ID" initial={sub.stripe_subscription_id}
                     onSave={(v) => save('stripe_subscription_id', v)}
                     help="Recorded, not created here — Stripe remains the source of truth for billing" />
        </div>
      </div>

      <div className="sect">
        <h3>Notes</h3>
        <div className="grid one">
          <TextField label="Internal notes" textarea initial={sub.notes}
                     onSave={(v) => save('notes', v)} />
        </div>
      </div>

      <div className="sect">
        <h3>Cancel</h3>
        {!confirming && (
          <button className="btn quiet" disabled={pending}
                  onClick={() => setConfirming(true)}>Cancel subscription</button>
        )}
        {confirming && (
          <>
            <div className="note">
              Cancelling keeps the record and its history. It does not cancel anything in Stripe —
              that must be done there as well.
            </div>
            <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end' }}>
              <div className="f" style={{ flex: 1 }}>
                <label>Reason</label>
                <input data-bwignore value={reason} style={sel}
                       onChange={(e) => setReason(e.target.value)} />
              </div>
              <button className="btn" disabled={pending}
                onClick={() => act(() => cancelSubscription(sub.id, venueId, reason))}>
                Confirm
              </button>
              <button className="btn quiet" onClick={() => setConfirming(false)}>Keep</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function TextField({
  label, initial, onSave, help, textarea,
}: {
  label: string; initial: any; onSave: (v: string | null) => void;
  help?: string; textarea?: boolean;
}) {
  const [v, setV] = useState(initial ?? '');
  const commit = () => { if (v !== (initial ?? '')) onSave(v === '' ? null : v); };
  return (
    <div className="f">
      <label>{label}</label>
      {textarea
        ? <textarea data-bwignore value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />
        : <input data-bwignore value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} />}
      {help && <span className="help">{help}</span>}
    </div>
  );
}

function DateField({
  label, initial, onSave,
}: { label: string; initial: any; onSave: (v: string | null) => void }) {
  const asDate = initial ? String(initial).slice(0, 10) : '';
  const [v, setV] = useState(asDate);
  return (
    <div className="f">
      <label>{label}</label>
      <input type="date" data-bwignore value={v}
             onChange={(e) => setV(e.target.value)}
             onBlur={() => v !== asDate && onSave(v || null)} />
    </div>
  );
}
