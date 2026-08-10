'use client';

import { useState, useTransition } from 'react';
import { codesSeen, makeRecoveryCodes } from '@/app/actions/security';
import { useSaveState } from './SaveState';

/* ═══════════════════════════════════════════════════════════════════════
   RECOVERY CODES

   The answer to losing the phone.

   Without them, an account with 2FA and no second device is locked out
   permanently — and for a business with one person in it, that is the
   sole Owner account and every venue record behind it.

   Ten codes, hashed on the way in. Shown once, because after that they
   only exist as hashes. Losing them means generating new ones, which
   invalidates the old — correct behaviour rather than a limitation.
   ═══════════════════════════════════════════════════════════════════════ */

export default function RecoveryCodes({
  status,
}: { status: Record<string, any> | null }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState('');

  const left = Number(status?.codes_left ?? 0);
  const seen = status?.codes_seen === true;

  const generate = () => start(async () => {
    report('saving');
    const r = await makeRecoveryCodes();
    if (r.ok && r.codes) { setCodes(r.codes); setMsg(r.message ?? ''); }
    else setMsg((r as any).error);
    report(r.ok ? 'saved' : 'error');
    setConfirming(false);
  });

  return (
    <div className="sect">
      <h3>Recovery codes</h3>

      {msg && <div className="note">{msg}</div>}

      {codes ? (
        <>
          <div className="note bad">
            <strong>This is the only time these are shown.</strong> They are stored hashed, so
            nobody — including anybody with access to the database — can read them back.
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
            gap: 'var(--s3)', padding: 'var(--s5)', background: 'var(--warm-cream)',
            border: '1px solid var(--border)', fontFamily: 'ui-monospace, monospace',
            fontSize: 15, letterSpacing: '.04em',
          }}>
            {codes.map((c) => <div key={c}>{c}</div>)}
          </div>

          <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s4)',
                        flexWrap: 'wrap' }}>
            <button className="btn quiet"
              onClick={() => {
                navigator.clipboard?.writeText(codes.join('\n'));
                setMsg('Copied. Put them somewhere that is not this computer.');
              }}>Copy all</button>
            <button className="btn quiet"
              onClick={() => {
                const blob = new Blob(
                  ['The Global Sanctum — recovery codes\n'
                   + `Generated ${new Date().toLocaleDateString('en-AU')}\n`
                   + 'Each works once. Keep them somewhere that is not this computer.\n\n'
                   + codes.join('\n')],
                  { type: 'text/plain' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'tgs-recovery-codes.txt';
                a.click();
              }}>Download</button>
            <button className="btn" disabled={pending}
              onClick={() => start(async () => {
                await codesSeen();
                setCodes(null);
                setMsg('Kept. Make sure they are somewhere you can reach without this laptop.');
              })}>
              I have saved them
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={left === 0 ? 'note bad' : left <= 3 ? 'note' : 'note'}>
            {left === 0 ? (
              <>
                <strong>No recovery codes.</strong> If the phone holding your authenticator is
                lost, this account cannot be signed into — and there is no second administrator
                to restore it.
              </>
            ) : left <= 3 ? (
              <><strong>{left} left.</strong> Worth generating a new set.</>
            ) : (
              <>
                <strong>{left} unused.</strong> Each works once, and they are the way back in if
                the authenticator is lost.
              </>
            )}
            {left > 0 && !seen && (
              <> They have been generated but not confirmed as saved.</>
            )}
          </div>

          <button className={`btn ${left === 0 ? '' : 'quiet'}`} disabled={pending}
            onClick={() => {
              if (left > 0 && !confirming) { setConfirming(true); return; }
              generate();
            }}>
            {pending ? 'Generating…'
              : confirming ? 'Confirm — the existing codes stop working'
              : left === 0 ? 'Generate ten codes' : 'Generate a new set'}
          </button>

          {confirming && (
            <button className="btn quiet" style={{ marginLeft: 'var(--s3)' }}
              onClick={() => setConfirming(false)}>Cancel</button>
          )}
        </>
      )}
    </div>
  );
}
