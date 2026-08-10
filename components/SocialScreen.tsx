'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  addPost, recordSnapshot, removePost, saveAccount, savePost,
} from '@/app/actions/social';
import { useSaveState } from './SaveState';

type Row = Record<string, any>;

const PLATFORM_COLOUR: Record<string, string> = {
  Instagram: '#C4703C', Facebook: '#3C5A99',
  LinkedIn: '#2867B2', Pinterest: '#B4453C',
};

const CATEGORIES = ['Venue feature', 'Retreat host', 'Practice or modality', 'Journal',
  'Wellness Edit', 'Brand', 'Announcement', 'Behind the scenes', 'Guest story', 'Seasonal'];

const STATUSES = ['Idea', 'Drafted', 'Approved', 'Scheduled', 'Published', 'Skipped'];

const sel: React.CSSProperties = {
  background: 'var(--warm-white)', border: '1px solid var(--border-input)',
  padding: '5px 7px', fontSize: 12, width: '100%',
};

const when = (d: string | null) => d
  ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

/* ═══════════════════════════════════════════════════════════════════════
   SOCIAL

   No API connections, so figures are entered by hand. That answers "is
   this growing" perfectly well — and an integration that breaks silently
   answers it worse.

   The number that matters is not followers. It is whether a venue has
   been posted about, and whether anything came back.
   ═══════════════════════════════════════════════════════════════════════ */

export default function SocialScreen({
  accounts, posts, snapshots, unfeatured, status,
}: { accounts: Row[]; posts: Row[]; snapshots: Row[]; unfeatured: Row[]; status: string }) {
  const { report } = useSaveState();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [measuring, setMeasuring] = useState<number | null>(null);
  const [figures, setFigures] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [forAccounts, setForAccounts] = useState<Set<number>>(new Set());
  const [category, setCategory] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const act = (fn: () => Promise<any>) => start(async () => {
    report('saving');
    const r = await fn();
    setMsg(r?.ok === false ? r.error : (r?.message ?? ''));
    report(r?.ok === false ? 'error' : 'saved');
    if (r?.ok !== false) {
      setMeasuring(null); setFigures({}); setAdding(false);
      setTitle(''); setForAccounts(new Set());
    }
  });

  const queued = posts.filter((p) => ['Approved', 'Scheduled'].includes(p.status));
  const totalFollowers = accounts.reduce((s, a) => s + Number(a.followers ?? 0), 0);

  return (
    <>
      <div className="ph">
        <div>
          <h2>Social</h2>
          <div className="ph-sub">
            {accounts.length} accounts
            {totalFollowers ? ` · ${totalFollowers.toLocaleString('en-AU')} followers` : ''}
            {queued.length ? ` · ${queued.length} queued` : ''}
          </div>
        </div>
        <div className="ph-act">
          <button className="btn" onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : 'Plan a post'}
          </button>
        </div>
      </div>

      {msg && <div className="note">{msg}</div>}

      {/* ── the accounts ──────────────────────────────────────── */}
      <div className="tiles" style={{ marginBottom: 'var(--s5)' }}>
        {accounts.map((a) => (
          <div className="tile" key={a.id} style={{ padding: 'var(--s5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'baseline' }}>
              <a href={a.profile_url} target="_blank" rel="noopener"
                 style={{ fontFamily: 'var(--serif)', fontSize: 19,
                          color: PLATFORM_COLOUR[a.platform] ?? 'var(--charcoal)',
                          textDecoration: 'none' }}>
                {a.platform}
              </a>
              {a.status !== 'Active' && (
                <span className="pill empty" style={{ fontSize: 9 }}>{a.status}</span>
              )}
            </div>

            <div className="v-slug" style={{ marginTop: 2, wordBreak: 'break-all' }}>
              {a.handle}
            </div>

            <div style={{ marginTop: 'var(--s3)', display: 'flex',
                          alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 25 }}>
                {a.followers != null ? Number(a.followers).toLocaleString('en-AU') : '—'}
              </span>
              {a.change_since_last != null && (
                <span style={{ fontSize: 12,
                  color: a.change_since_last >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                  {a.change_since_last >= 0 ? '+' : ''}{a.change_since_last}
                </span>
              )}
            </div>
            <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
                          color: 'var(--ink-quiet)' }}>
              followers {a.measured_on ? `· ${when(a.measured_on)}` : '· never measured'}
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 'var(--s3)' }}>
              {a.published} published{a.queued ? ` · ${a.queued} queued` : ''}
              {a.last_posted && <div>last {when(a.last_posted)}</div>}
            </div>

            {a.content_focus && (
              <p style={{ fontSize: 12, lineHeight: 1.5, marginTop: 'var(--s3)',
                          color: 'var(--ink-quiet)' }}>{a.content_focus}</p>
            )}

            <button className="link-btn" style={{ marginTop: 'var(--s3)' }}
              onClick={() => setMeasuring(measuring === a.id ? null : a.id)}>
              {measuring === a.id ? 'Close' : 'Record this month'}
            </button>

            {measuring === a.id && (
              <div style={{ marginTop: 'var(--s3)' }}>
                {([['followers', 'Followers'], ['posts_in_period', 'Posts this month'],
                   ['reach', 'Reach'], ['engagements', 'Engagements'],
                   ['link_clicks', 'Link clicks'],
                   ['enquiries_attributed', 'Enquiries from here']] as [string, string][])
                  .map(([k, label]) => (
                    <div className="f" key={k} style={{ marginBottom: 5 }}>
                      <label style={{ fontSize: 9 }}>{label}</label>
                      <input type="number" data-bwignore style={sel}
                        value={figures[k] ?? ''}
                        onChange={(e) => setFigures({ ...figures, [k]: e.target.value })} />
                    </div>
                  ))}
                <button className="btn" disabled={pending}
                  style={{ marginTop: 6, width: '100%' }}
                  onClick={() => act(() => recordSnapshot(
                    a.id, new Date().toISOString().slice(0, 10),
                    Object.fromEntries(Object.entries(figures)
                      .map(([k, v]) => [k, v === '' ? null : Number(v)]))))}>
                  Save
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── planning ──────────────────────────────────────────── */}
      {adding && (
        <div className="sect">
          <div className="grid">
            <div className="f" style={{ gridColumn: '1 / -1' }}>
              <label>Post title</label>
              <input data-bwignore value={title} style={sel}
                placeholder="Udara Bali — the Lotus Temple"
                onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="f">
              <label>Kind</label>
              <select value={category} style={sel}
                onChange={(e) => setCategory(e.target.value)}>
                <option value="">Choose</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="f" style={{ gridColumn: '1 / -1' }}>
              <label>Where</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {accounts.map((a) => {
                  const on = forAccounts.has(a.id);
                  return (
                    <button key={a.id} type="button" className={`pill ${on ? 'gold' : ''}`}
                      style={{ cursor: 'pointer',
                               background: on ? undefined : 'var(--warm-white)' }}
                      onClick={() => {
                        const next = new Set(forAccounts);
                        next.has(a.id) ? next.delete(a.id) : next.add(a.id);
                        setForAccounts(next);
                      }}>{a.platform}</button>
                  );
                })}
              </div>
              <span className="help">
                Choose one or more
              </span>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button className="btn" disabled={pending || !title.trim() || !forAccounts.size}
                onClick={() => act(() =>
                  addPost(title, Array.from(forAccounts), category))}>
                Add it
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap',
                    marginBottom: 'var(--s4)' }}>
        {['all', ...STATUSES].map((s) => (
          <Link key={s} className={`btn ${status === s ? '' : 'quiet'}`}
                href={s === 'all' ? '/marketing/social' : `/marketing/social?status=${s}`}>
            {s === 'all' ? 'Everything' : s}
          </Link>
        ))}
      </div>

      <div className="sect">
        <h3>Posts</h3>
        {!posts.length ? (
          <div className="note" style={{ marginBottom: 0 }}>
            Nothing planned. The easiest place to start is a venue nobody has posted about.
          </div>
        ) : posts.map((p) => (
          <div className="row-card" key={p.id} style={{ marginBottom: 'var(--s2)' }}>
            <header>
              <div>
                <div className="rt" style={{ fontSize: 17 }}>{p.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-quiet)', marginTop: 2 }}>
                  {[p.category, p.social_accounts?.platform,
                    p.scheduled_for && `for ${when(p.scheduled_for)}`,
                    p.published_at && `posted ${when(p.published_at)}`]
                    .filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
                <select defaultValue={p.status} style={{ ...sel, width: 'auto' }}
                  onChange={(e) => act(() => savePost(p.id, 'status', e.target.value))}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button className="link-btn" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  {open === p.id ? 'Close' : 'Open'}
                </button>
              </div>
            </header>

            {open === p.id && (
              <div className="grid">
                <div className="f" style={{ gridColumn: '1 / -1' }}>
                  <label>Caption</label>
                  <textarea data-bwignore defaultValue={p.caption ?? ''}
                    onBlur={(e) => e.target.value !== (p.caption ?? '')
                      && act(() => savePost(p.id, 'caption', e.target.value || null))} />
                </div>
                <div className="f">
                  <label>Scheduled for</label>
                  <input type="date" data-bwignore style={sel}
                    defaultValue={p.scheduled_for?.slice(0, 10) ?? ''}
                    onChange={(e) => act(() => savePost(p.id, 'scheduled_for',
                      e.target.value ? new Date(e.target.value).toISOString() : null))} />
                </div>
                <div className="f">
                  <label>Link it goes to</label>
                  <input data-bwignore style={sel} defaultValue={p.link_url ?? ''}
                    onBlur={(e) => e.target.value !== (p.link_url ?? '')
                      && act(() => savePost(p.id, 'link_url', e.target.value || null))} />
                </div>
                <div className="f">
                  <label>Link to the published post</label>
                  <input data-bwignore style={sel} defaultValue={p.published_url ?? ''}
                    onBlur={(e) => e.target.value !== (p.published_url ?? '')
                      && act(() => savePost(p.id, 'published_url', e.target.value || null))} />
                </div>
                <div className="f">
                  <label>Notes on the image or video</label>
                  <input data-bwignore style={sel} defaultValue={p.asset_note ?? ''}
                    onBlur={(e) => e.target.value !== (p.asset_note ?? '')
                      && act(() => savePost(p.id, 'asset_note', e.target.value || null))} />
                </div>

                {p.status === 'Published' && (
                  <>
                    {([['likes','Likes'],['comments','Comments'],
                       ['shares','Shares'],['saves','Saves'],['reach','Reach']] as [string,string][])
                      .map(([k, l]) => (
                        <div className="f" key={k}>
                          <label>{l}</label>
                          <input type="number" data-bwignore style={sel}
                            defaultValue={p[k] ?? ''}
                            onBlur={(e) => act(() => savePost(p.id, k,
                              e.target.value ? Number(e.target.value) : null))} />
                        </div>
                      ))}
                  </>
                )}

                <div style={{ gridColumn: '1 / -1' }}>
                  <button className="link-btn" disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Remove "${p.title}"?`)) return;
                      act(() => removePost(p.id));
                    }}>Remove</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── what to post about ────────────────────────────────── */}
      {!!unfeatured.length && (
        <div className="sect">
          <h3>Never posted about</h3>
          <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
            Published venues with no social post against them
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {unfeatured.map((v) => (
              <Link key={v.id} className="pill" href={`/venues/${v.id}/details`}
                    style={{ textDecoration: 'none' }}>
                {v.venue_name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
