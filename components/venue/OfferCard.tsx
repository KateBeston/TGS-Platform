'use client';

import { useState } from 'react';
import { AddToCart } from '@/components/venue/BookingCart';
import { MEDICAL_NOTICE, SAFETY_HEADING } from '@/lib/safetyNotice';
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
  const [modalMain, setModalMain] = useState(0);
  const [open, setOpen] = useState(false);
  /* Which length is selected. null is the advertised one, which is how a
     card with lengths behaves identically to one without until somebody
     chooses — and it is what goes in the cart if they never do. */
  const [chosen, setChosen] = useState<number | null>(null);
  const o = offer;

  const shownPrice = chosen === null
    ? o.price
    : (o.lengths?.find((L) => L.id === chosen)?.price ?? o.price);

  /* What it was before the offer, for the strike-through. Per length
     where one is chosen, since each length carries its own offer. */
  const wasPrice = chosen === null
    ? (o.offer?.was ?? null)
    : (o.lengths?.find((L) => L.id === chosen)?.was ?? null);

  /* The offer in the venue's own words — "20% off" rather than a
     calculated saving, because that is what was advertised. */
  const savingLabel = (() => {
    if (wasPrice == null || shownPrice == null || wasPrice <= shownPrice) return null;
    if (chosen === null && o.offer) {
      if (o.offer.kind === 'Percentage off' && o.offer.value != null) {
        return `${o.offer.value}% off`;
      }
      return `${money(wasPrice - shownPrice, o.currency)} off`;
    }
    return `${money(wasPrice - shownPrice, o.currency)} off`;
  })();

  const hasImages = o.images.length > 0;
  const thumbs = o.images.filter((_, i) => i !== main).slice(0, 3);

  return (
    <>
      {/* Featured no longer resizes the card. One service rendered larger than
          its neighbours read as a rendering fault rather than as emphasis, and
          there was nothing on screen saying why. Prominence belongs in a
          section of its own, not in a card that quietly grows. */}
      <article className={`ofc${hasImages ? '' : ' ofc--noimg'}`}>
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
          {/* The dot points belong here, not only behind More detail. Without
              them the card is a name, a line and a price, which is why it read
              as sparse. Capped at four so a long list does not unbalance a
              column of cards; the rest are in the modal. */}
          {o.detail && o.detail.included.length > 0 && (
            <ul className="ofc-incl">
              {o.detail.included.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}
              {o.detail.included.length > 4 && (
                <li className="ofc-incl-more">and {o.detail.included.length - 4} more</li>
              )}
            </ul>
          )}

          {o.tags.length > 0 && (
            <div className="ofc-tags">
              {o.tags.map((t) => <span key={t} className="ofc-tag">{t}</span>)}
            </div>
          )}

          {/* A short fact strip. Notice and group size are the two questions
              people actually ask before adding something. */}
          {o.detail && o.detail.facts.length > 0 && (
            <div className="ofc-quick">
              {o.detail.facts.filter((f) => f.label !== 'Duration').slice(0, 3).map((f, i) => (
                <span key={i}><b>{f.label}</b>{f.value}</span>
              ))}
            </div>
          )}

          {/* Contraindications, before the price rather than after it: a
              guest who cannot safely have this should not first be sold
              on it. The signs are in the sauna, not at the front door, so
              these sit on the service they belong to. */}
          {!!o.safety?.length && (
            <div className="ofc-safety">
              <div className="ofc-safety-h">{SAFETY_HEADING}</div>
              <ul className="ofc-safety-list">
                {o.safety.map((f, i) => (
                  <li key={i}
                      className={f.severity === 'Critical' ? 'is-critical' : undefined}>
                    {f.label}
                    {f.notSuitableIf && <span> — {f.notSuitableIf}</span>}
                    {!f.notSuitableIf && f.note && <span> — {f.note}</span>}
                    {f.requirement && <span> {f.requirement}</span>}
                  </li>
                ))}
              </ul>
              {o.seriousSafety && (
                <p className="ofc-safety-note">{MEDICAL_NOTICE}</p>
              )}
            </div>
          )}

          {/* The same treatment at other lengths. The advertised one is
              first and selected, so a card with lengths reads the same as
              one without until somebody chooses. */}
          {!!o.lengths?.length && (
            <div className="ofc-lengths" role="group" aria-label="Length">
              {[{ id: null as number | null, minutes: o.minutes ?? null,
                  price: o.price, note: null as string | null },
                ...o.lengths].map((L) => {
                const on = chosen === L.id;
                return (
                  <button key={L.id ?? 'advertised'} type="button"
                    className={`ofc-length${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    title={L.note ?? undefined}
                    onClick={() => setChosen(L.id)}>
                    {L.minutes ? `${L.minutes} min` : 'Standard'}
                    {L.price != null && (
                      <small>{money(L.price, o.currency)}</small>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="ofc-price">
            <span className="ofc-fig">
              {/* "From" belongs to the advertised price. Once a length is
                  chosen the figure is that length's price exactly. */}
              {o.priceFrom && chosen === null && <small>From</small>}
              {/* What it was, struck through, where this is a discounted
                  price. Only ever shown for an offer with no conditions
                  attached, so it cannot promise a price the checkout
                  will not honour. */}
              {wasPrice != null && wasPrice > (shownPrice ?? 0) && (
                <s className="ofc-was">{money(wasPrice, o.currency)}</s>
              )}
              {money(shownPrice, o.currency) ?? 'On request'}
            </span>
            {o.priceBasis && <span className="ofc-basis">{o.priceBasis}</span>}
            {savingLabel && <span className="ofc-save">{savingLabel}</span>}
          </div>
          {o.priceAlt.length > 0 && <p className="ofc-alt">{o.priceAlt.join(' \u00b7 ')}</p>}

          <div className="ofc-foot">
            {/* "Detail" said nothing about what was behind it. This names the
                reward for clicking, which is the whole job of the control. */}
            {o.detail && (
              <button type="button" className="ofc-more" onClick={() => setOpen(true)}>
                See full detail
              </button>
            )}
            {/* Policies sits on the card permanently rather than inside the
                modal: someone checking cancellation before they commit should
                not have to open something else first. */}
            <a className="ofc-policies" href="#policies">Policies</a>
            <span className="ofc-foot-spacer" />
            {o.bookable
              ? (chosen !== null
                  /* A length is its own sellable item with its own code, so
                     it goes in as its own line rather than as this service
                     with a note on it. */
                  ? <AddToCart kind="svclen" id={chosen} max={o.maxQty} />
                  : <AddToCart
                      kind={o.kind === 'exp' ? 'exp' : o.kind === 'package' ? 'package' : 'extra'}
                      id={o.id} max={o.maxQty} />)
              : <a className="ofc-enquire" href="#enquire">Enquire</a>}
          </div>
        </div>
      </article>

      {open && o.detail && (
        <div className="ofc-modal" role="dialog" aria-modal="true" aria-label={o.name}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="ofc-modal-box">
            {/* The modal showed one fixed image while the card had a working
                gallery, which made opening it feel like a step backwards. Same
                images, same swap, larger. */}
            {hasImages && (
              <div className="ofc-modal-gallery">
                <div className="ofc-modal-hero" style={{ backgroundImage: `url(${o.images[modalMain]})` }}>
                  <button type="button" className="ofc-modal-x" onClick={() => setOpen(false)} aria-label="Close">&times;</button>
                </div>
                {o.images.length > 1 && (
                  <div className="ofc-modal-thumbs">
                    {o.images.map((src, i) => (
                      <button key={src + i} type="button"
                        className={`ofc-modal-thumb${i === modalMain ? ' on' : ''}`}
                        style={{ backgroundImage: `url(${src})` }}
                        aria-label={`Photo ${i + 1} of ${o.images.length}`}
                        onClick={() => setModalMain(i)} />
                    ))}
                  </div>
                )}
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

              {/* Adding has to be possible from here. Someone who opened this
                  to decide should not have to close it to act. */}
              <div className="ofc-modal-foot">
                <div className="ofc-modal-price">
                  <span className="ofc-fig">
                    {o.priceFrom && <small>From</small>}
                    {money(o.price, o.currency) ?? 'On request'}
                  </span>
                  {o.priceBasis && <span className="ofc-basis">{o.priceBasis}</span>}
                </div>
                <div className="ofc-modal-acts">
                  <a className="ofc-policies" href="#policies" onClick={() => setOpen(false)}>Policies</a>
                  {o.bookable
                    ? <AddToCart kind={o.kind === 'exp' ? 'exp' : 'extra'} id={o.id} max={o.maxQty} />
                    : <a className="ofc-enquire" href="#enquire" onClick={() => setOpen(false)}>Enquire</a>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** A run of offers, featured first. Same card either way. */
export function OfferList({ offers }: { offers: Offer[] }) {
  if (!offers.length) return null;
  const ordered = [...offers].sort((a, b) => Number(b.featured) - Number(a.featured));
  return (
    <div className="ofc-list">
      {ordered.map((o) => <OfferCard key={`${o.kind}-${o.id}`} offer={o} />)}
    </div>
  );
}

/* Prominence, given its own section rather than a card that quietly grows.
   Renders nothing when nothing is flagged, so a venue that has picked no
   signature treatment simply does not get the section. */
export function FeaturedOffers({ offers, label = 'Signature', title = 'What this venue is known for' }:
  { offers: Offer[]; label?: string; title?: string }) {
  const featured = offers.filter((o) => o.featured);
  if (!featured.length) return null;
  return (
    <section className="section section--cream ofc-featured">
      <div className="wrap">
        <div className="section-header">
          <div className="section-label">{label}</div>
          <h2 className="section-title">{title}</h2>
        </div>
        <div className="ofc-list">
          {featured.map((o) => <OfferCard key={`f-${o.kind}-${o.id}`} offer={o} />)}
        </div>
      </div>
    </section>
  );
}
