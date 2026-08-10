'use client';

import { useState, useTransition } from 'react';
import {
  cancelScheduledChange, quoteTierChange, requestTierChange,
} from '@/app/actions/commission';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const money = (n: unknown, ccy = 'AUD') =>
  n == null ? '—' : `${ccy} ${Number(n).toLocaleString('en-AU',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const date = (d: string) => new Date(d).toLocaleDateString('en-AU',
  { day: 'numeric', month: 'long', year: 'numeric' });

/* ═══════════════════════════════════════════════════════════════════════
   CHANGING TIER

   Built for the venue portal before the venue portal exists, because the
   rules are decided now and not in six months when somebody clicks the
   button.

   An upgrade is immediate with credit for the unused period. A downgrade
   waits until the end of what has been paid for — taking features away
   mid-month for money already taken is not a downgrade.

   And the lifetime discount survives. A Founding Partner moving up pays
   60% off the NEW price.
   ═══════════════════════════════════════════════════════════════════════ */

export default function TierChange({
  venueId, tiers, current, pending,
}: { venueId: number; tiers: Row[]; current: Row | null; pending: Row | null }) {
  const { report } = useSaveState();
  const [busy, start] = useTransition();
  const [quote, setQuote] = useState<Row | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [billing, setBilling] = useState(current?.billing_period ?? 'Monthly');
  const [msg, setMsg] = useState('');

  const ask = (tierId: number) => start(async () => {
    setChosen(tierId);
    const q = await quoteTierChange(venueId, tierId, billing);
    setQuote(q.error ? null : q);
    setMsg(q.error ?? '');
  });

  const currentTierId = current?.tier_id;

  return (
    <div className="sect">
      <h3>Change tier</h3>

      {pending && (
        <div className="note">
          <strong>{pending.to_tier?.name} from {date(pending.effective_at)}.</strong>{' '}
          Nothing changes before then.
          <button className="link-btn" style={{ marginLeft: 8 }} disabled={busy}
            onClick={() => start(async () => {
              report('saving');
              const r = await cancelScheduledChange(pending.id);
              setMsg(r.ok ? r.message ?? '' : r.error);
              report(r.ok ? 'saved' : 'error');
            })}>
            Cancel it
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--s3)', marginBottom: 'var(--s4)',
                    alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase',
                       color: 'var(--ink-quiet)' }}>Billed</span>
        {['Monthly', 'Annual'].map((b) => (
          <button key={b} type="button" className={`pill ${billing === b ? 'gold' : ''}`}
            style={{ cursor: 'pointer',
                     background: billing === b ? undefined : 'var(--warm-white)' }}
            onClick={() => { setBilling(b); setQuote(null); setChosen(null); }}>
            {b}
          </button>
        ))}
      </div>

      <div className="tiles">
        {tiers.map((t) => {
          const isCurrent = t.id === currentTierId;
          const price = billing === 'Annual' ? t.annual_price : t.monthly_price;
          return (
            <button key={t.id} type="button" className="tile" disabled={busy || isCurrent}
              style={{
                textAlign: 'left', padding: 'var(--s5)',
                cursor: isCurrent ? 'default' : 'pointer',
                border: chosen === t.id ? '2px solid var(--gold)'
                      : isCurrent ? '1px solid var(--gold)' : undefined,
                opacity: isCurrent ? 0.75 : 1,
              }}
              onClick={() => !isCurrent && ask(t.id)}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 21 }}>{t.name}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {Number(price) === 0 ? 'No fee' : money(price, t.currency)}
                {Number(price) > 0 && (billing === 'Annual' ? ' a year' : ' a month')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-gold)', marginTop: 2 }}>
                {t.commission_rate}% commission
              </div>
              {isCurrent && (
                <div className="v-slug" style={{ marginTop: 6 }}>Currently on this</div>
              )}
            </button>
          );
        })}
      </div>

      {msg && <div className="note">{msg}</div>}

      {quote && !quote.error && (
        <div style={{ border: '1px solid var(--gold)', borderLeft: '3px solid var(--gold)',
                      padding: 'var(--s5)', marginTop: 'var(--s4)' }}>
          <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase',
                        color: 'var(--ink-gold)' }}>
            {quote.kind} · {quote.from_tier ?? 'no subscription'} to {quote.to_tier}
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr',
                       gap: '4px var(--s4)', margin: 'var(--s4) 0 0', fontSize: 13 }}>
            <dt style={{ color: 'var(--ink-quiet)' }}>List price</dt>
            <dd style={{ margin: 0 }}>{money(quote.list_price, quote.currency)}</dd>

            {Number(quote.discount_percent) > 0 && (
              <>
                <dt style={{ color: 'var(--ink-quiet)' }}>Their discount</dt>
                <dd style={{ margin: 0, color: 'var(--ink-gold)' }}>
                  {quote.discount_percent}% off — carried across
                </dd>
              </>
            )}

            <dt style={{ color: 'var(--ink-quiet)' }}>They pay</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>
              {money(quote.new_price, quote.currency)}
              {billing === 'Annual' ? ' a year' : ' a month'}
            </dd>

            {Number(quote.proration_credit) > 0 && (
              <>
                <dt style={{ color: 'var(--ink-quiet)' }}>Credit</dt>
                <dd style={{ margin: 0 }}>
                  {money(quote.proration_credit, quote.currency)} for the unused period
                </dd>
              </>
            )}

            <dt style={{ color: 'var(--ink-quiet)' }}>Due now</dt>
            <dd style={{ margin: 0, fontWeight: 500 }}>
              {money(quote.amount_due, quote.currency)}
            </dd>

            <dt style={{ color: 'var(--ink-quiet)' }}>Commission</dt>
            <dd style={{ margin: 0 }}>
              {quote.commission_now}% → <strong>{quote.commission_after}%</strong>
              {Number(quote.commission_after) > Number(quote.commission_now) && (
                <span style={{ color: 'var(--warn)' }}> — higher</span>
              )}
            </dd>

            <dt style={{ color: 'var(--ink-quiet)' }}>From</dt>
            <dd style={{ margin: 0 }}>{date(quote.effective_at)}</dd>
          </dl>

          {quote.note && <div className="note" style={{ marginTop: 'var(--s4)' }}>{quote.note}</div>}

          <div className="note" style={{ marginTop: 'var(--s3)' }}>
            Bookings already taken keep the rate they were made at.
          </div>

          <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s4)' }}>
            <button className="btn" disabled={busy}
              onClick={() => start(async () => {
                report('saving');
                const r = await requestTierChange(venueId, chosen!, billing);
                setMsg(r.ok ? r.message ?? '' : r.error);
                report(r.ok ? 'saved' : 'error');
                if (r.ok) { setQuote(null); setChosen(null); }
              })}>
              {quote.kind === 'Downgrade' ? 'Schedule it' : 'Apply it now'}
            </button>
            <button className="btn quiet" onClick={() => { setQuote(null); setChosen(null); }}>
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
