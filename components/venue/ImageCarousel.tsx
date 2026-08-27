'use client';

/* Shared image carousel used by the accommodation room cards and the venue hero.
 * A clean main image that slides gently to the next; a small frameless carousel
 * of square thumbnails with arrows floats bottom-right; the leftmost thumbnail is
 * the next one up, and clicking any brings it to the main. Auto-advances on a
 * timer, and pauses while the pointer is over it. `children` render over the
 * image (used by the hero for its overlay, name, location and type). */

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type ReactNode } from 'react';

export function ImageCarousel({
  images, alt, variant = 'card', intervalMs = 12000, children,
}: {
  images: string[];
  alt: string;
  variant?: 'card' | 'hero';
  intervalMs?: number;
  children?: ReactNode;
}) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const n = images.length;
  const many = n > 1;

  // Auto-advance. Restarts whenever the shown image changes (manual or auto),
  // so a click gives a fresh full interval before the next slide.
  useEffect(() => {
    if (!many || paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), intervalMs);
    return () => clearInterval(t);
  }, [many, paused, n, intervalMs, i]);

  if (!n) {
    return variant === 'card'
      ? <div className="room-card-image"><div className="placeholder-img">{alt}</div></div>
      : <div className="ic ic--hero">{children}</div>;
  }

  const idx = Math.min(i, n - 1);
  const others = many ? Array.from({ length: n - 1 }, (_, k) => (idx + 1 + k) % n) : [];
  const step = (d: number) => setI((idx + d + n) % n);

  return (
    <div
      className={`ic ic--${variant}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="ic-stage">
        {images.map((src, k) => (
          <img
            key={`${src}-${k}`}
            src={src}
            alt={k === idx ? alt : ''}
            aria-hidden={k !== idx}
            className={`ic-slide${k === idx ? ' on' : ''}`}
          />
        ))}
      </div>

      {children}

      {many && (
        <div className="ic-car">
          <button type="button" className="ic-cbtn" onClick={() => step(-1)} aria-label="Previous image">‹</button>
          <div className="ic-strip">
            {others.map((k) => (
              <button key={k} type="button" className="ic-thumb" onClick={() => setI(k)} aria-label={`Show image ${k + 1}`}>
                <img src={images[k]} alt="" />
              </button>
            ))}
          </div>
          <button type="button" className="ic-cbtn" onClick={() => step(1)} aria-label="Next image">›</button>
        </div>
      )}
    </div>
  );
}
