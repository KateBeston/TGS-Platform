'use client';

import { useState } from 'react';

/* Sharing an article.
 *
 * The audit lists this as missing entirely. Uses the browser's own share
 * sheet where there is one — which on a phone is every app somebody
 * actually shares with — and falls back to copying the link.
 *
 * No third-party buttons. A row of social widgets is four trackers and a
 * layout shift to do what one button does. */

export default function ShareArticle({ title }: { title: string }) {
  const [said, setSaid] = useState('');

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSaid('Link copied');
      setTimeout(() => setSaid(''), 2400);
    } catch {
      // Cancelled, or a browser that allows neither. Nothing to say.
    }
  };

  return (
    <button type="button" className="btn-line share-btn" onClick={share}>
      {said || 'Share this'}
    </button>
  );
}
