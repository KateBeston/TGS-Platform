'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ALL_NO, ALL_YES, applyConsent, readConsent, writeConsent, type Consent,
} from '@/lib/consent';

/* The cookie banner.
 *
 * Accept and decline sit side by side, the same size, the same weight.
 * The audit asks for rejection to be as easy as acceptance and the
 * regulators ask for the same thing — a decline hidden behind "manage
 * preferences" is a decline made deliberately harder.
 *
 * Nothing loads until a choice is made. Consent Mode is set to denied
 * before any tag runs, so a visitor who ignores the banner is treated as
 * having declined rather than as having agreed by silence.
 */

export default function ConsentBanner() {
  const [show, setShow] = useState(false);
  const [detail, setDetail] = useState(false);
  const [choice, setChoice] = useState({
    functional: true, analytics: false, marketing: false,
  });

  useEffect(() => {
    const stored = readConsent();
    if (stored) {
      applyConsent(stored);
      return;
    }
    // A small delay so the banner does not fight the page for attention
    // in the first moment somebody arrives.
    const t = setTimeout(() => setShow(true), 700);
    return () => clearTimeout(t);
  }, []);

  // Re-openable, because a choice somebody cannot change is not a
  // choice. The footer links to #cookie-settings.
  useEffect(() => {
    const open = () => { setShow(true); setDetail(true); };
    const fromHash = () => {
      if (window.location.hash === '#cookie-settings') open();
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    window.addEventListener('tgs:cookie-settings', open);
    return () => {
      window.removeEventListener('hashchange', fromHash);
      window.removeEventListener('tgs:cookie-settings', open);
    };
  }, []);

  const decide = (c: Parameters<typeof writeConsent>[0]) => {
    writeConsent(c);
    setShow(false);
    setDetail(false);
    if (window.location.hash === '#cookie-settings') {
      history.replaceState(null, '', window.location.pathname);
    }
  };

  if (!show) return null;

  return (
    <div className="consent" role="dialog" aria-live="polite"
      aria-label="Cookie preferences">
      <div className="consent-inner">
        <div className="consent-text">
          <strong>A word about cookies</strong>
          <p>
            We use cookies that are necessary for the site to work. We would also
            like to use analytics to understand what is useful, and marketing
            cookies to measure whether our own advertising reaches anybody.
            Neither is necessary and you can decline both.{' '}
            <Link href="/legal#cookie-policy">Read the cookie policy</Link>.
          </p>
        </div>

        {detail && (
          <div className="consent-detail">
            <label className="consent-row is-fixed">
              <input type="checkbox" checked disabled readOnly />
              <span>
                <strong>Necessary</strong>
                <span className="consent-note">
                  Security, and remembering this choice. Cannot be turned off,
                  so we do not pretend to ask.
                </span>
              </span>
            </label>

            <label className="consent-row">
              <input type="checkbox" checked={choice.functional}
                onChange={(e) => setChoice({ ...choice, functional: e.target.checked })} />
              <span>
                <strong>Functional</strong>
                <span className="consent-note">
                  Remembering preferences, so the site does not ask twice.
                </span>
              </span>
            </label>

            <label className="consent-row">
              <input type="checkbox" checked={choice.analytics}
                onChange={(e) => setChoice({ ...choice, analytics: e.target.checked })} />
              <span>
                <strong>Analytics</strong>
                <span className="consent-note">
                  Which pages are read and which are not. We see numbers, not
                  people.
                </span>
              </span>
            </label>

            <label className="consent-row">
              <input type="checkbox" checked={choice.marketing}
                onChange={(e) => setChoice({ ...choice, marketing: e.target.checked })} />
              <span>
                <strong>Marketing</strong>
                <span className="consent-note">
                  Measuring whether our own advertising reached anybody. We do not
                  sell your details and we do not run ads on this site.
                </span>
              </span>
            </label>
          </div>
        )}

        <div className="consent-actions">
          {/* Same size, same weight, side by side. A decline hidden
              behind "manage preferences" is a decline made harder. */}
          <button type="button" className="btn-solid"
            onClick={() => decide(ALL_YES)}>Accept all</button>
          <button type="button" className="btn-line"
            onClick={() => decide(ALL_NO)}>Decline all</button>

          {detail ? (
            <button type="button" className="btn-line"
              onClick={() => decide(choice)}>Save my choices</button>
          ) : (
            <button type="button" className="consent-more"
              onClick={() => setDetail(true)}>Choose individually</button>
          )}
        </div>
      </div>
    </div>
  );
}
