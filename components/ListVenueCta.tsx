'use client';

import { useState } from 'react';

const VMS = 'https://vms.theglobalsanctum.com';

/* The "Apply to list your venue" CTA. Opens a brief modal that frames the hand-off
 * and routes to Sanctum VMS, where the owner account is actually created (the
 * session must live on the VMS domain, so account creation happens there, not here).
 * The VMS handles the "you already have a Global Sanctum account" case. */
export default function ListVenueCta({
  className, style, label = 'Apply to list your venue',
}: { className?: string; style?: React.CSSProperties; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div className="lvm-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="lvm" onClick={(e) => e.stopPropagation()}>
            <button className="lvm-close" onClick={() => setOpen(false)} aria-label="Close">&times;</button>
            <div className="lvm-eyebrow">The Global Sanctum</div>
            <h2 className="lvm-title">List your venue</h2>
            <p className="lvm-body">
              Venue partners are managed in <strong>Sanctum VMS</strong>, our venue management portal.
              Create your account to begin — or sign in with your existing Global Sanctum account and
              we&rsquo;ll add venue management to it. Every venue is reviewed by our team before it goes live.
            </p>
            <a className="lvm-btn" href={`${VMS}/?join=1`}>Create your account &rarr;</a>
            <p className="lvm-alt">Already a partner? <a href={`${VMS}/login`}>Sign in</a></p>
          </div>
        </div>
      )}
    </>
  );
}
