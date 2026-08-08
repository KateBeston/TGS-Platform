'use client';

import { useState } from 'react';

/* Load more.
 *
 * The articles are already on the page — all of them are server-rendered
 * so a crawler reads every one — and this reveals the rest. Fetching on
 * click would mean the tenth article existed only for somebody who
 * pressed a button. */

export default function EditMore({ hidden }: { hidden: number }) {
  const [shown, setShown] = useState(false);
  if (!hidden || shown) return null;

  return (
    <div className="edit-more">
      <button type="button" className="btn-line" onClick={() => {
        setShown(true);
        document.querySelectorAll('.edit-card.is-hidden')
          .forEach((el) => el.classList.remove('is-hidden'));
      }}>
        Load more articles
      </button>
    </div>
  );
}
