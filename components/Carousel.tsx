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

/* How long each slide holds, in milliseconds.
 *
 * 3500 to match the reference Kate timed at three to four seconds. Changed
 * here and it changes everywhere, because every carousel on the site uses this
 * component.
 *
 * The crossfade in globals.css is tuned to this number rather than set
 * independently: at 800ms in, the row is at rest for 77% of each cycle, which
 * is close to the 82% the previous six-second hold gave. Much below about 60%
 * and something is always moving, which is the difference between elegant and
 * restless — so if this number drops further, the fade has to come down with
 * it.
 *
 * A carousel can override it with the interval prop where a section genuinely
 * needs a different pace. */
const HOLD_MS = 3500;

export default function Carousel({
  children, perSlide = 3, label, autoplay = true, interval = HOLD_MS,
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
  const [progress, setProgress] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const startedAt = useRef<number>(Date.now());
  const frame = useRef<number>(0);

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
  /* One clock drives both the advance and the runner filling beneath it, so
     the bar cannot drift from the change it is describing. A setTimeout for
     the advance and a separate animation for the bar would eventually
     disagree, and the disagreement is exactly what you notice. */
  useEffect(() => {
    if (!autoplay || reduced || paused || count <= 1) return;
    startedAt.current = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - startedAt.current) / interval, 1);
      setProgress(p);
      if (p >= 1) {
        setSlide((s) => (s + 1) % count);
        startedAt.current = Date.now();
        setProgress(0);
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [autoplay, reduced, paused, count, at, interval]);

  if (!items.length) return null;

  const go = (n: number) => {
    setSlide(((n % count) + count) % count);
    setProgress(0);
    startedAt.current = Date.now();
  };

  return (
    <div className="carousel"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      {/* A crossfade rather than a slide. The cards dissolve where they
          stand, so nothing travels across the eye and the row reads as a
          held moment rather than a filmstrip being pulled past.
          Every slide stays in the DOM, so a crawler reads all of them. */}
      <div className="carousel-viewport carousel-fade">
        <div ref={track} className="carousel-stack">
          {slides.map((group, i) => (
            <div key={i}
              className={`carousel-slide${i === at ? ' is-on' : ''}`}
              style={{ gridTemplateColumns: `repeat(${perView}, 1fr)` }}
              aria-hidden={i !== at}
              /* Out of the tab order when hidden, so nobody tabs into a card
                 they cannot see. */
              inert={i !== at}>
              {group}
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <div className="carousel-controls">
          <button type="button" className="carousel-arrow"
            aria-label={`Previous ${label}`} onClick={() => go(at - 1)}>&larr;</button>

          {/* Runners rather than dots. A dot says which one you are on; a
              runner says that and how long is left, which is the difference
              between a marker and an invitation to wait. */}
          <div className="carousel-runners">
            {slides.map((_, i) => (
              <button key={i} type="button"
                className={`carousel-runner${i === at ? ' is-on' : ''}`}
                aria-label={`Slide ${i + 1} of ${count}`}
                aria-current={i === at}
                onClick={() => go(i)}>
                <span className="carousel-runner-fill"
                  style={{ transform: `scaleX(${
                    i < at ? 1 : i === at ? (reduced || paused ? 1 : progress) : 0
                  })` }} />
              </button>
            ))}
          </div>

          <button type="button" className="carousel-arrow"
            aria-label={`Next ${label}`} onClick={() => go(at + 1)}>&rarr;</button>
        </div>
      )}
    </div>
  );
}
