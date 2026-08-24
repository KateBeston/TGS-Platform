'use client';

import { useEffect } from 'react';

// Registers the service worker so the site is installable (Add to Home Screen)
// and works offline. No effect on how the site looks or behaves in a browser.
export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
