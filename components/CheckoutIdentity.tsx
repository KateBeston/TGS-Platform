'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthModal } from '@/components/AuthModal';
import { trackCartEvent } from '@/lib/track';

/* Guest, or signed in.
 *
 * Checkout already worked without an account — contact details in local
 * storage and nothing else — so this does not add guest checkout; it
 * makes the choice visible, and records which way people go.
 *
 * The choice is not a gate. Nothing below it is disabled and the guest
 * route is the default, because a marketplace that makes you register
 * before it will take your money loses the people who were ready to pay.
 * An account is offered for what it is actually worth to the guest —
 * their booking in one place afterwards — and not pressed twice.
 */

export default function CheckoutIdentity({
  email,
}: {
  /* Whatever the contact step already collected, so the offer can name
     the address rather than asking for it again. */
  email?: string | null;
}) {
  const authModal = useAuthModal();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [choice, setChoice] = useState<'guest' | 'account' | null>(null);

  useEffect(() => {
    let live = true;
    const supabase = createClient();

    const read = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!live) return;
      setSignedIn(!!user);
      setName(user?.email ?? null);
      /* Signing in is the deliberate act, so it settles the choice on
         its own. Choosing guest has to be said out loud. */
      if (user) {
        setChoice('account');
        trackCartEvent({ eventType: 'checkout_as_account' });
      }
    };

    read();
    const { data: sub } = supabase.auth.onAuthStateChange(() => read());
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);

  /* Reported once, when a signed-out guest is actually shown the offer.
     Counting prompts nobody saw makes the take-up rate meaningless. */
  useEffect(() => {
    if (signedIn === false) trackCartEvent({ eventType: 'account_prompt_shown' });
  }, [signedIn]);

  if (signedIn === null) return null;

  if (signedIn) {
    return (
      <section className="ck-sec">
        <h2 className="ck-h2">Your account</h2>
        <p className="ck-note">
          Signed in{name ? <> as <strong>{name}</strong></> : ''}. This booking will be
          saved to your account.
        </p>
      </section>
    );
  }

  return (
    <section className="ck-sec">
      <h2 className="ck-h2">Guest or account</h2>

      <div style={{ display: 'grid', gap: 12,
                    gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <button type="button"
          onClick={() => { setChoice('guest'); trackCartEvent({ eventType: 'checkout_as_guest' }); }}
          aria-pressed={choice === 'guest'}
          style={{ textAlign: 'left', padding: 14, cursor: 'pointer',
                   background: 'var(--paper, #fff)',
                   border: `1px solid ${choice === 'guest' ? 'var(--gold-dark)' : 'rgba(0,0,0,.14)'}`,
                   boxShadow: choice === 'guest' ? 'inset 0 0 0 1px var(--gold-dark)' : 'none' }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
            Continue as a guest
          </span>
          <span style={{ display: 'block', fontSize: 13, opacity: .72, lineHeight: 1.5 }}>
            Book now with the details you have already given. Your confirmation
            comes by email.
          </span>
        </button>

        <button type="button"
          onClick={() => { trackCartEvent({ eventType: 'checkout_as_account' }); authModal?.open('login'); }}
          style={{ textAlign: 'left', padding: 14, cursor: 'pointer',
                   background: 'var(--paper, #fff)',
                   border: '1px solid rgba(0,0,0,.14)' }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
            Sign in
          </span>
          <span style={{ display: 'block', fontSize: 13, opacity: .72, lineHeight: 1.5 }}>
            Already have an account? Your saved venues and past bookings come
            with you.
          </span>
        </button>
      </div>

      {/* Offered once, after the choice, and never in the way of it. */}
      <p className="ck-note" style={{ marginTop: 12 }}>
        New here? You can{' '}
        <button type="button"
          onClick={() => {
            trackCartEvent({ eventType: 'account_created_at_checkout',
                             metadata: { from: 'checkout_offer' } });
            authModal?.open('signup');
          }}
          style={{ border: 'none', background: 'none', padding: 0, font: 'inherit',
                   color: 'var(--gold-dark)', textDecoration: 'underline',
                   cursor: 'pointer' }}>
          create an account
        </button>
        {email ? <> with {email}</> : null} to keep this booking, your saved venues and
        your documents in one place. It is not required to book.
      </p>
    </section>
  );
}
