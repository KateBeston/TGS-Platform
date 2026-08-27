'use client';

/* Room image gallery: a clean main image with a small carousel floating in the
 * bottom-right corner. Small arrows step through the images; the leftmost
 * thumbnail is the next one up, and clicking it (or any thumbnail) brings that
 * image into the main view. No frame, no borders — just the squares and arrows. */

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';

export function RoomGallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);

  if (!images.length) {
    return <div className="room-card-image"><div className="placeholder-img">{name}</div></div>;
  }

  const n = images.length;
  const idx = Math.min(i, n - 1);
  const many = n > 1;
  // Upcoming images, next first (leftmost), current one excluded.
  const others = many ? Array.from({ length: n - 1 }, (_, k) => (idx + 1 + k) % n) : [];
  const step = (d: number) => setI((idx + d + n) % n);

  return (
    <div className="rmg-main">
      <img src={images[idx]} alt={`${name} — image ${idx + 1}`} />
      {many && (
        <div className="rmg-car">
          <button type="button" className="rmg-cbtn" onClick={() => step(-1)} aria-label="Previous image">‹</button>
          <div className="rmg-strip">
            {others.map((imgIdx) => (
              <button
                key={imgIdx}
                type="button"
                className="rmg-thumb"
                onClick={() => setI(imgIdx)}
                aria-label={`Show image ${imgIdx + 1}`}
              >
                <img src={images[imgIdx]} alt="" />
              </button>
            ))}
          </div>
          <button type="button" className="rmg-cbtn" onClick={() => step(1)} aria-label="Next image">›</button>
        </div>
      )}
    </div>
  );
}
