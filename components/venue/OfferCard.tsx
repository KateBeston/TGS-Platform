'use client';

import { useState } from 'react';
import { AddToCart } from '@/components/venue/BookingCart';
import type { Offer } from '@/lib/offers';

/* One card for treatments, packages, excursions and room extras.
 *
 * Image left, detail centre, price and actions right. The actions column is a
 * fixed width rather than flexible: if it flexed, the price and the button
 * would sit at a different distance from the right edge on every card, and a
 * column of six would look ragged. A hairline separates it rather than a
 * filled panel, so the card stays one object.
 *
 * Everything is conditional. Almost no offer has images, tags or inclusions
 * yet, so the card has to degrade to a name, a price and a button without
 * looking broken.
 */

const money = (n: number | null, c: string | null) =>
  n == null ? null : new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: c ?? 'AUD', maximumFractionDigits: 0,
  }).format(n);

export default function OfferCard({ offer }: { offer: Offer }) {
  const [main, setMain] = useState(0);
  const [open, setOpen] = useState(false);
  const o = offer;
  const hasImages = o.images.length > 0;
  const thumbs = o.images.filter((_, i) => i !== main).slice(0, 3);

  return (
    <>
      <article className={`ofc${hasImages ? '' : ' ofc--noimg'}${o.featured ? ' ofc--feature' : ''}`}>
        {hasImages && (
          <div className="ofc-media">
            <div className="ofc-img" style={{ backgroundImage: `url(${o.images[main]})` }} role="img" aria-label={o.name} />
            {o.flag && <span className="ofc-flag">{o.flag}</span>}
            {thumbs.length > 0 && (
              <div className="ofc-thumbs">
                {thumbs.map((src) => (
                  <button key={src} type="button" className="ofc-thumb" aria-label="Show this photo"
                    style={{ backgroundImage: `url(${src})` }}
                    onClick={() => setMain(o.images.indexOf(src))} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* One body column, not two. Name, meta, description and tags run down
            it; the price sits at the foot under a rule with the actions
            beneath. Splitting the price into its own bordered rail was a
            different design and made the card read as two objects. */}
        <div className="ofc-body">
          <h3 className="ofc-name">{o.name}</h3>
          {o.meta.length > 0 && <p className="ofc-meta">{o.meta.join(' \u00b7 ')}</p>}
          {o.description && <p className="ofc-desc">{o.description}</p>}
          {o.tags.length > 0 && (
            <div className="ofc-tags">
              {o.tags.map((t) => <span key={t} className="ofc-tag">{t}</span>)}
            </div>
          )}

          <div className="ofc-price">
            <span className="ofc-fig">
              {o.priceFrom && <small>From</small>}
              {money(o.price, o.currency) ?? 'On request'}
            </span>
            {o.priceBasis && <span className="ofc-basis">{o.priceBasis}</span>}
          </div>
          {o.priceAlt.length > 0 && <p className="ofc-alt">{o.priceAlt.join(' \u00b7 ')}</p>}

          <div className="ofc-foot">
            {o.detail && (
              <button type="button" className="ofc-more" onClick={() => setOpen(true)}>Detail</button>
            )}
            {o.bookable
              ? <AddToCart kind={o.kind === 'exp' ? 'exp' : 'extra'} id={o.id} max={o.maxQty} />
              : <a className="ofc-enquire" href="#enquire">Enquire</a>}
          </div>
        </div>
      </article>

      {open && o.detail && (
        <div className="ofc-modal" role="dialog" aria-modal="true" aria-label={o.name}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="ofc-modal-box">
            {hasImages && (
              <div className="ofc-modal-hero" style={{ backgroundImage: `url(${o.images[0]})` }}>
                <button type="button" className="ofc-modal-x" onClick={() => setOpen(false)} aria-label="Close">&times;</button>
              </div>
            )}
            <div className="ofc-modal-in">
              {!hasImages && (
                <button type="button" className="ofc-modal-x ofc-modal-x--plain" onClick={() => setOpen(false)} aria-label="Close">&times;</button>
              )}
              <h3 className="ofc-modal-title">{o.name}</h3>
              {o.meta.length > 0 && <p className="ofc-modal-sub">{o.meta.join(' · ')}</p>}

              <div className="ofc-modal-grid">
                {o.detail.whoFor && (
                  <div className="ofc-sec"><h4>Who it&rsquo;s for</h4><p>{o.detail.whoFor}</p></div>
                )}
                {o.detail.whatToBring && (
                  <div className="ofc-sec"><h4>What to bring</h4><p>{o.detail.whatToBring}</p></div>
                )}
                {o.detail.included.length > 0 && (
                  <div className="ofc-sec">
                    <h4>What&rsquo;s included</h4>
                    <ul>{o.detail.included.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                )}
                {o.detail.goodToKnow && (
                  <div className="ofc-sec"><h4>Good to know</h4><p>{o.detail.goodToKnow}</p></div>
                )}
                {o.detail.facts.length > 0 && (
                  <div className="ofc-sec ofc-sec-full">
                    <div className="ofc-facts">
                      {o.detail.facts.map((f, i) => (
                        <div key={i}><b>{f.label}</b><span>{f.value}</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** A run of offers, with the featured ones first. */
export function OfferList({ offers }: { offers: Offer[] }) {
  if (!offers.length) return null;
  const ordered = [...offers].sort((a, b) => Number(b.featured) - Number(a.featured));
  return (
    <div className="ofc-list">
      {ordered.map((o) => <OfferCard key={`${o.kind}-${o.id}`} offer={o} />)}
    </div>
  );
}
