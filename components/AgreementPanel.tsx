'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   AGREEING TO SOMETHING, THE SAME WAY EVERY TIME

   One panel for every agreement TGS asks anybody to accept: booking
   terms, a venue owner agreement, a host agreement, a waiver. The shape
   is the same wherever it appears, because somebody who has signed one
   should recognise the next.

   WHAT IT ASKS FOR, AND WHY IN THAT ORDER

   Each section has to be opened before the agreement tick will enable.
   A single tick under a wall of text records that somebody clicked, not
   that they read; opening each part is a weaker claim than reading but
   it is an honest one, and it is the difference between "it was shown"
   and "it was put in front of them one piece at a time".

   Then a typed phrase, then a signature. Both are deliberate friction.
   Ticking is automatic by the time somebody has ticked four things;
   typing the words and signing are not, and they are what somebody
   remembers doing if they are ever asked whether they agreed.

   WHAT IT DOES NOT DO

   It does not decide what the agreement says, which documents apply, or
   where the result is stored. It is handed sections and hands back what
   the person did. That is what lets the booking flow, the venue portal
   and the VMS share it without one of them quietly growing its own
   version with a weaker test.
   ═══════════════════════════════════════════════════════════════════════ */

export type AgreementSection = {
  /** Stable key, usually the document slug, returned in the result. */
  key: string;
  title: string;
  /** The one line shown before it is opened: what this part covers. */
  summary: string;
  /** The full text. A string is rendered as paragraphs on blank lines. */
  body: React.ReactNode | string;
};

/** A separate, explicit acknowledgement that sits outside the sections. */
export type AgreementTick = {
  key: string;
  label: string;
  /** Shown smaller under the label. */
  hint?: string;
};

export type AgreementSignature =
  | { kind: 'drawn'; dataUrl: string }
  | { kind: 'typed'; name: string };

export type AgreementResult = {
  /** Section keys, in the order they were opened. */
  sectionsRead: string[];
  /** Every extra tick, by key, whether or not it was ticked. */
  ticks: Record<string, boolean>;
  /** What they typed, where an affirmation was asked for. */
  typed: string | null;
  signature: AgreementSignature | null;
  /** When Confirm was pressed, from the browser. The server records its own. */
  agreedAt: string;
};

type Props = {
  heading: string;
  intro: string;
  sections: AgreementSection[];
  /** Extra acknowledgements. All of them must be ticked to confirm. */
  ticks?: AgreementTick[];
  masterLabel: string;
  /** Shown under the master tick while it is still disabled. */
  masterHint: string;
  /** The paragraph the typed phrase confirms. Omit to skip that step. */
  statement?: string;
  /** What they must type, compared case-insensitively. Default "I agree". */
  affirmPhrase?: string;
  /** Omit to skip the signature. */
  signatureLabel?: string;
  confirmLabel: string;
  busy?: boolean;
  /** Shown above the button when a confirm attempt failed. */
  error?: string | null;
  onConfirm: (result: AgreementResult) => void | Promise<void>;
};

const asParagraphs = (body: React.ReactNode | string) =>
  typeof body !== 'string'
    ? body
    : body.split(/\n{2,}/).map((p, i) => <p key={i}>{p.trim()}</p>);

export default function AgreementPanel({
  heading, intro, sections, ticks = [], masterLabel, masterHint,
  statement, affirmPhrase = 'I agree', signatureLabel,
  confirmLabel, busy = false, error = null, onConfirm,
}: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [read, setRead] = useState<string[]>([]);
  const [master, setMaster] = useState(false);
  const [tickState, setTickState] = useState<Record<string, boolean>>({});
  const [typed, setTyped] = useState('');
  const [sigMode, setSigMode] = useState<'drawn' | 'typed'>('drawn');
  const [sigName, setSigName] = useState('');
  const [hasDrawing, setHasDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const allRead = read.length === sections.length && sections.length > 0;
  const allTicked = ticks.every((t) => tickState[t.key]);
  const typedOk = !statement || typed.trim().toLowerCase() === affirmPhrase.toLowerCase();
  const signed = !signatureLabel
    || (sigMode === 'typed' ? sigName.trim().length > 1 : hasDrawing);
  const canConfirm = allRead && master && allTicked && typedOk && signed && !busy;

  const toggleOpen = (key: string) => {
    setOpen((cur) => (cur === key ? null : key));
    /* Counted once, on first opening. Closing it again does not take the
       reading back, and re-opening does not count twice. */
    setRead((cur) => (cur.includes(key) ? cur : [...cur, key]));
  };

  /* ── the drawn signature ─────────────────────────────────────────
     A canvas sized to its own box in device pixels, so a line drawn on
     a phone is not a blurred smear. Pointer events rather than mouse
     and touch separately, because a stylus is neither. */
  const sizeCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (!rect.width || !rect.height) return;
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#313131';
  }, []);

  useEffect(() => {
    if (!signatureLabel || sigMode !== 'drawn') return;
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
    return () => window.removeEventListener('resize', sizeCanvas);
  }, [signatureLabel, sigMode, sizeCanvas]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pointFrom(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointFrom(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawing) setHasDrawing(true);
  };

  const endDraw = () => { drawing.current = false; };

  const clearDrawing = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    setHasDrawing(false);
  };

  const signature = useMemo((): AgreementSignature | null => {
    if (!signatureLabel) return null;
    if (sigMode === 'typed') {
      return sigName.trim() ? { kind: 'typed', name: sigName.trim() } : null;
    }
    const c = canvasRef.current;
    return c && hasDrawing ? { kind: 'drawn', dataUrl: c.toDataURL('image/png') } : null;
  }, [signatureLabel, sigMode, sigName, hasDrawing]);

  const confirm = () => {
    if (!canConfirm) return;
    void onConfirm({
      sectionsRead: read,
      ticks: Object.fromEntries(ticks.map((t) => [t.key, !!tickState[t.key]])),
      typed: statement ? typed.trim() : null,
      signature,
      agreedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="ag-panel">
      <div className="ag-head">
        <div className="ag-head-row">
          <h2 className="ag-title">{heading}</h2>
          <span className="ag-count">{read.length} / {sections.length} read</span>
        </div>
        <p className="ag-intro">{intro}</p>
      </div>

      <div className="ag-sections">
        {sections.map((s) => {
          const isOpen = open === s.key;
          const isRead = read.includes(s.key);
          return (
            <div key={s.key} className={`ag-section${isRead ? ' is-read' : ''}`}>
              <div className="ag-section-head">
                <span className={`ag-mark${isRead ? ' is-read' : ''}`} aria-hidden="true" />
                <div className="ag-section-text">
                  <div className="ag-section-title">{s.title}</div>
                  <div className="ag-section-summary">{s.summary}</div>
                </div>
                <button
                  type="button"
                  className="ag-open"
                  aria-expanded={isOpen}
                  onClick={() => toggleOpen(s.key)}
                >
                  {isRead ? 'Read' : 'Open and read'}
                  <span className={`ag-chev${isOpen ? ' is-open' : ''}`} aria-hidden="true" />
                </button>
              </div>
              {isOpen && <div className="ag-body">{asParagraphs(s.body)}</div>}
            </div>
          );
        })}
      </div>

      <label className={`ag-master${allRead ? '' : ' is-locked'}`}>
        <input
          type="checkbox"
          checked={master}
          disabled={!allRead}
          onChange={(e) => setMaster(e.target.checked)}
        />
        <span>
          {masterLabel}
          {!allRead && <span className="ag-master-hint">{masterHint}</span>}
        </span>
      </label>

      {ticks.map((t) => (
        <label key={t.key} className="ag-tick">
          <input
            type="checkbox"
            checked={!!tickState[t.key]}
            onChange={(e) => setTickState((cur) => ({ ...cur, [t.key]: e.target.checked }))}
          />
          <span>
            {t.label}
            {t.hint && <span className="ag-tick-hint">{t.hint}</span>}
          </span>
        </label>
      ))}

      {statement && (
        <div className="ag-affirm">
          <p className="ag-statement">{statement}</p>
          <label className="ag-field">
            <span>Type <b>{affirmPhrase}</b> to confirm the statement above</span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={`Type "${affirmPhrase}"`}
              autoComplete="off"
            />
          </label>
        </div>
      )}

      {signatureLabel && (
        <div className="ag-sign">
          <div className="ag-sign-head">
            <span className="ag-sign-label">{signatureLabel}</span>
            <div className="ag-sign-modes">
              <button
                type="button"
                className={`ag-mode${sigMode === 'drawn' ? ' is-on' : ''}`}
                onClick={() => setSigMode('drawn')}
              >Draw</button>
              <button
                type="button"
                className={`ag-mode${sigMode === 'typed' ? ' is-on' : ''}`}
                onClick={() => setSigMode('typed')}
              >Type your name</button>
            </div>
          </div>

          {sigMode === 'drawn' ? (
            <>
              <div className="ag-pad-wrap">
                {!hasDrawing && <span className="ag-pad-hint">Draw your signature here</span>}
                <canvas
                  ref={canvasRef}
                  className="ag-pad"
                  onPointerDown={startDraw}
                  onPointerMove={moveDraw}
                  onPointerUp={endDraw}
                  onPointerLeave={endDraw}
                  onPointerCancel={endDraw}
                />
              </div>
              <button type="button" className="ag-clear" onClick={clearDrawing}>Clear</button>
            </>
          ) : (
            <input
              className="ag-typed-sign"
              value={sigName}
              onChange={(e) => setSigName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
            />
          )}
        </div>
      )}

      {error && <p className="ag-error">{error}</p>}

      <button
        type="button"
        className="ag-confirm"
        disabled={!canConfirm}
        onClick={confirm}
      >
        {busy ? 'Saving…' : confirmLabel}
      </button>
    </div>
  );
}
