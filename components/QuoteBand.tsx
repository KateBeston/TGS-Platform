'use client';

import { useEffect, useRef, useState } from 'react';

/* The quote, typed on scroll.
 *
 * The mockup types it in character by character when the band comes into
 * view. Kept, because the pause it creates is the point of the section.
 *
 * The full text is in the DOM from the start and revealed by slicing, so
 * a crawler and a screen reader get the whole thing rather than an empty
 * paragraph. Somebody who prefers reduced motion gets it immediately. */

export default function QuoteBand({ quote, author }: { quote: string; author: string }) {
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const band = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setShown(quote.length); setDone(true); return; }

    const el = band.current;
    if (!el) return;

    let timer: ReturnType<typeof setInterval>;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();

      let i = 0;
      timer = setInterval(() => {
        i += 1;
        setShown(i);
        if (i >= quote.length) { clearInterval(timer); setDone(true); }
      }, 28);
    }, { threshold: 0.4 });

    io.observe(el);
    return () => { io.disconnect(); clearInterval(timer); };
  }, [quote]);

  return (
    <section className="quote-section" ref={band}>
      <p className="quote-text">
        <span className="quote-open">&ldquo;</span>
        {quote.slice(0, shown)}
        {!done && <span className="quote-cursor" aria-hidden="true" />}
        {done && <span className="quote-close">&rdquo;</span>}
      </p>
      <div className="quote-author" style={{ opacity: done ? 1 : 0 }}>
        &mdash; {author}
      </div>
    </section>
  );
}
