'use client';

import { useState } from 'react';

/* The pricing table.
 *
 * Every figure comes from partner_pricing, which does the arithmetic in
 * the database. Nothing here multiplies anything — a discount applied in
 * two places is a discount that disagrees with itself the first time one
 * of them is edited.
 *
 * Yearly is shown first because it is what most venues take and because
 * the monthly figure alone makes the annual saving invisible.
 */

type Row = {
  program_slug: string; program: string; discount_percent: string;
  is_lifetime: boolean; venue_cap: number | null; places_left: number | null;
  tier_slug: string; tier: string; tagline: string | null;
  commission_rate: string; processing_rate: string | null; tier_order: number;
  full_monthly: string; full_annual: string;
  monthly: string; annual: string; annual_as_monthly: string;
  annual_saving: string | null; annual_saving_percent: string | null;
};

const money = (n: string | number | null) => {
  if (n === null || n === undefined) return null;
  const v = Number(n);
  return v === 0 ? 'Free' : `$${v.toLocaleString('en-AU')}`;
};

export default function PricingTable({
  rows, offering, placesLeft,
}: { rows: Row[]; offering: string; placesLeft: number | null }) {
  const [yearly, setYearly] = useState(true);

  const shown = rows.filter((r) => r.program_slug === offering)
    .sort((a, b) => a.tier_order - b.tier_order);

  if (!shown.length) return null;

  const program = shown[0];
  const discounted = Number(program.discount_percent) > 0;

  return (
    <>
      {discounted && (
        <div className="pricing-note">
          <strong>You are seeing {program.program} pricing.</strong>{' '}
          {Number(program.discount_percent)}% off
          {program.is_lifetime && ' for as long as you stay'}
          {placesLeft !== null && program.venue_cap
            && ` — ${placesLeft} of ${program.venue_cap} places left`}.
        </div>
      )}

      <div className="pricing-switch">
        <button type="button" className={yearly ? 'is-on' : ''}
          onClick={() => setYearly(true)}>Yearly</button>
        <button type="button" className={!yearly ? 'is-on' : ''}
          onClick={() => setYearly(false)}>Monthly</button>
      </div>

      <div className="pricing-grid">
        {shown.map((r) => {
          const free = Number(r.annual) === 0 && Number(r.monthly) === 0;
          const price = yearly ? r.annual : r.monthly;
          const was = yearly ? r.full_annual : r.full_monthly;
          const featured = r.tier_slug === 'featured';

          return (
            <div key={r.tier_slug} className={`pricing-card ${featured ? 'is-featured' : ''}`}>
              {featured && <div className="pricing-flag">Most taken</div>}

              <h3 className="pricing-tier">{r.tier}</h3>
              {r.tagline && <div className="pricing-tagline">{r.tagline}</div>}

              {/* Against full retail, which is what the partner
                  discount actually is. The annual-versus-monthly saving
                  is a smaller, separate thing and showing both invites
                  the reader to add them together. */}
              {discounted && !free && (
                <div className="pricing-was">
                  Normally {money(was)} {yearly ? 'a year' : 'a month'}
                </div>
              )}

              <div className="pricing-amount">
                {free ? (
                  <span className="pricing-free">Free</span>
                ) : (
                  <>
                    <span className="pricing-currency">$</span>
                    <span className="pricing-n">
                      {Number(price).toLocaleString('en-AU')}
                    </span>
                    <span className="pricing-per">{yearly ? '/yr' : '/mo'}</span>
                  </>
                )}
              </div>

              {/* Two savings exist and only one is stated here. The
                  headline is the discount off full retail, because that
                  is what the partner programme is. The annual-versus-
                  monthly difference goes underneath, smaller and
                  labelled, so nobody adds the two together. */}
              {discounted && !free && (
                <div className="pricing-saving">
                  {money(Number(was) - Number(price))} off
                  {' '}({Number(r.discount_percent)}%)
                </div>
              )}

              {yearly && !free && (
                <div className="pricing-equiv">
                  Works out at {money(r.annual_as_monthly)} a month
                  {r.annual_saving && Number(r.annual_saving) > 0 && (
                    <>, and {money(r.annual_saving)} less than paying monthly</>
                  )}
                </div>
              )}

              {!yearly && !free && r.annual_saving
                && Number(r.annual_saving) > 0 && (
                <div className="pricing-equiv">
                  Paying yearly instead saves a further {money(r.annual_saving)}
                </div>
              )}

              <div className="pricing-commission">
                <span className="pricing-rate">{Number(r.commission_rate)}%</span>
                <span className="pricing-rate-note">
                  commission on bookings
                  {r.processing_rate && ` · ${Number(r.processing_rate)}% processing`}
                </span>
              </div>

              <a className={featured ? 'btn-solid' : 'btn-line'} href="/list-your-venue">
                {free ? 'Start here' : 'Choose this'}
              </a>
            </div>
          );
        })}
      </div>

      {/* One line. The full position is in the Venue Owner Agreement,
          which is linked and which somebody signs — repeating it here at
          length makes the price harder to read, and a price nobody reads
          is worse than one with a footnote. */}
      <p className="pricing-terms">
        Prices in AUD, excluding GST. Australian venues have GST added at 10%.
        Commission applies to bookings made through the platform.{' '}
        <a href="/legal/venue-owner-agreement">Full terms</a>.
      </p>
    </>
  );
}
