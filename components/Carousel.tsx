'use client';

import { useEffect, useRef, useState } from 'react';

/* A carousel, as the mockup has it.
 *
 * Slides of three, arrows and dots, and a long gentle easing rather than
 * a snap. The transform is on the track so the browser animates one
 * element rather than reflowing the row.
 *
 * Every slide is in the DOM, so a crawler reads all of them and nothing
 * depends on somebody pressing an arrow.
 */

export default function Carousel({
  children, perSlide = 3, label,
}: {
  children: React.ReactNode[];
  perSlide?: number;
  label: string;
}) {
  const [slide, setSlide] = useState(0);
  const [perView, setPerView] = useState(perSlide);
  const track = useRef<HTMLDivElement>(null);

  // One at a time on a phone, two on a tablet. A three-across slide on a
  // narrow screen is three cards nobody can read.
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth;
      setPerView(w < 700 ? 1 : w < 1080 ? 2 : perSlide);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [perSlide]);

  const items = children.filter(Boolean);
  const slides: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += perView) {
    slides.push(items.slice(i, i + perView));
  }

  const count = slides.length;
  const at = Math.min(slide, count - 1);

  useEffect(() => { if (slide > count - 1) setSlide(0); }, [count, slide]);

  if (!items.length) return null;

  const go = (n: number) => setSlide(((n % count) + count) % count);

  return (
    <div className="carousel">
      <div className="carousel-viewport">
        <div ref={track} className="carousel-track"
          style={{ transform: `translateX(-${at * 100}%)` }}>
          {slides.map((group, i) => (
            <div key={i} className="carousel-slide"
              style={{ gridTemplateColumns: `repeat(${perView}, 1fr)` }}
              aria-hidden={i !== at}>
              {group}
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <div className="carousel-controls">
          <button type="button" className="carousel-arrow"
            aria-label={`Previous ${label}`} onClick={() => go(at - 1)}>&larr;</button>

          <div className="carousel-dots">
            {slides.map((_, i) => (
              <button key={i} type="button"
                className={`carousel-dot ${i === at ? 'is-on' : ''}`}
                aria-label={`Slide ${i + 1} of ${count}`}
                aria-current={i === at}
                onClick={() => go(i)} />
            ))}
          </div>

          <button type="button" className="carousel-arrow"
            aria-label={`Next ${label}`} onClick={() => go(at + 1)}>&rarr;</button>
        </div>
      )}
    </div>
  );
}
