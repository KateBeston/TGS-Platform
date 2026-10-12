'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import Link from 'next/link';
import { AuthPanel } from './AuthForms';

type Mode = 'login' | 'signup' | 'reset';
type Ctx = { open: (mode?: Mode) => void; close: () => void; isOpen: boolean };

const AuthModalCtx = createContext<Ctx | null>(null);
export function useAuthModal() { return useContext(AuthModalCtx); }

const HEADINGS: Record<Mode, { title: string; sub: string }> = {
  login: { title: 'Welcome back', sub: 'Sign in to your account.' },
  signup: { title: 'Create your account', sub: 'Save venues, keep your bookings and build your profile.' },
  reset: { title: 'Reset your password', sub: 'We\u2019ll email you a link to set a new one.' },
};

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const open = (m: Mode = 'login') => { setMode(m); setIsOpen(true); };
  const close = () => setIsOpen(false);

  return (
    <AuthModalCtx.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen && (
        <div className="auth-modal-overlay" onClick={close}>
          {/* Sign-up is the only one of the three that is too tall for a
              single column. Signing in is two fields and a button, and a
              wide two-pane box around that would look like a mistake, so
              the wide layout is signup's alone. */}
          <div className={`auth-modal${mode === 'signup' ? ' auth-modal-wide' : ''}`}
               role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="auth-modal-close" onClick={close} aria-label="Close">&times;</button>
            <div className="auth-modal-inner">
              {mode === 'signup' ? (
                <div className="auth-split">
                  {/* Why bother, on the left. The reasons do not change
                      while you type, so they have no business taking up
                      room above the fields. */}
                  <div className="auth-split-pitch">
                    <div className="auth-eyebrow">The Global Sanctum</div>
                    <h2 className="auth-title">{HEADINGS[mode].title}</h2>
                    <p className="auth-sub">{HEADINGS[mode].sub}</p>
                    <ul className="auth-benefits">
                      <li>Save venues to your own collection</li>
                      <li>Keep your bookings, quotes and enquiries in one place</li>
                      <li>Early access to new venues and member offers</li>
                    </ul>
                    <p className="auth-legal auth-legal-pitch">
                      By continuing you agree to our <Link href="/legal#terms-and-conditions" onClick={close}>Terms</Link> and{' '}
                      <Link href="/legal#privacy-policy" onClick={close}>Privacy&nbsp;Policy</Link>.
                    </p>
                  </div>
                  <div className="auth-split-form">
                    <AuthPanel mode={mode} setMode={setMode} onSuccess={close} showBenefits={false} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="auth-eyebrow">The Global Sanctum</div>
                  <h2 className="auth-title">{HEADINGS[mode].title}</h2>
                  <p className="auth-sub">{HEADINGS[mode].sub}</p>
                  <AuthPanel mode={mode} setMode={setMode} onSuccess={close} />
                  <p className="auth-legal">
                    By continuing you agree to our <Link href="/legal#terms-and-conditions" onClick={close}>Terms</Link> and{' '}
                    <Link href="/legal#privacy-policy" onClick={close}>Privacy&nbsp;Policy</Link>.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AuthModalCtx.Provider>
  );
}
