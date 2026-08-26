'use client';

/* Room image gallery on the accommodation card: a main image with prev/next
 * arrows, and a strip of square thumbnails below. Clicking a thumbnail (or an
 * arrow) changes the main image. Falls back gracefully to a single image or a
 * placeholder. */

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';

export function RoomGallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);

  if (!images.length) {
    return <div className="room-card-image"><div className="placeholder-img">{name}</div></div>;
  }

  const idx = Math.min(i, images.length - 1);
  const go = (d: number) => setI((idx + d + images.length) % images.length);
  const many = images.length > 1;

  return (
    <div className="rmg">
      <div className="rmg-main">
        <img src={images[idx]} alt={`${name} — image ${idx + 1}`} />
        {many && (
          <>
            <button type="button" className="rmg-arrow rmg-prev" onClick={() => go(-1)} aria-label="Previous image">‹</button>
            <button type="button" className="rmg-arrow rmg-next" onClick={() => go(1)} aria-label="Next image">›</button>
            <div className="rmg-count">{idx + 1} / {images.length}</div>
          </>
        )}
      </div>
      {many && (
        <div className="rmg-thumbs">
          {images.map((src, n) => (
            <button
              key={`${src}-${n}`}
              type="button"
              className={`rmg-thumb${n === idx ? ' on' : ''}`}
              onClick={() => setI(n)}
              aria-label={`Show image ${n + 1}`}
              aria-current={n === idx}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
