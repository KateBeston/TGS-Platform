'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

/** The challenge widget.
 *
 *  Managed mode: it decides whether to show anything at all, and for a
 *  person signing in from their usual machine it shows nothing. The token
 *  arrives silently and goes with the form.
 */
export default function Turnstile({
  siteKey, onToken,
}: { siteKey?: string; onToken: (token: string) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    // Not configured means not shown. The server treats a missing token
    // the same way, so the portal works either way.
    if (!siteKey || !holder.current) return;

    const render = () => {
      if (!window.turnstile || !holder.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(holder.current, {
        sitekey: siteKey,
        theme: 'light',
        appearance: 'interaction-only',
        callback: (token: string) => onToken(token),
        'expired-callback': () => {
          // Five minutes, then it lapses. Reset rather than leave a dead
          // token that fails on submit with nothing explaining why.
          if (widgetId.current) window.turnstile?.reset(widgetId.current);
        },
      });
    };

    if (window.turnstile) { render(); return; }

    const existing = document.querySelector('script[data-turnstile]');
    if (!existing) {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.defer = true;
      s.dataset.turnstile = 'true';
      s.onload = render;
      document.head.appendChild(s);
    } else {
      existing.addEventListener('load', render);
    }

    return () => {
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch {}
        widgetId.current = null;
      }
    };
  }, [siteKey, onToken]);

  if (!siteKey) return null;
  return <div ref={holder} style={{ marginTop: 16 }} />;
}
