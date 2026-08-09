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
  children, perSlide = 3, label, autoplay = true, interval = 6000,
}: {
  children: React.ReactNode[];
  perSlide?: number;
  label: string;
  autoplay?: boolean;
  interval?: number;
}) {
  const [slide, setSlide] = useState(0);
  const [perView, setPerView] = useState(perSlide);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
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

  // Respect a reader who has asked the system for less motion — no
  // autoplay for them.
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(m.matches);
    sync();
    m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, []);

  // Advance on a slow timer so the row moves on its own, elegantly. The
  // effect is keyed on `at`, so any manual arrow or dot resets the dwell
  // rather than jumping straight after. Hover or keyboard focus pauses it
  // so nobody loses the card they are reading.
  useEffect(() => {
    if (!autoplay || reduced || paused || count <= 1) return;
    const id = window.setTimeout(() => setSlide((s) => (s + 1) % count), interval);
    return () => window.clearTimeout(id);
  }, [autoplay, reduced, paused, count, at, interval]);

  if (!items.length) return null;

  const go = (n: number) => setSlide(((n % count) + count) % count);

  return (
    <div className="carousel"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
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
