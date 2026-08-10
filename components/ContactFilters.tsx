'use client';

import { useRouter } from 'next/navigation';

export default function ContactFilters({
  q, role, tag, status, sortKey, size, sorts, roles, tags,
}: {
  q: string; role: string; tag: string; status: string; sortKey: string; size: number;
  sorts: { key: string; label: string }[];
  roles: { id: number; role_key: string; label: string; division: string | null }[];
  tags: { id: number; name: string; tag_group: string | null }[];
}) {
  const router = useRouter();

  const go = (changes: Record<string, string>) => {
    const p = new URLSearchParams();
    const next = { q, role, tag, status, sort: sortKey, size: String(size), ...changes };
    Object.entries(next).forEach(([k, v]) => {
      if (v && !(k === 'sort' && v === 'surname_asc') && !(k === 'size' && v === '50')) p.set(k, v);
    });
    router.push(`/contacts${p.toString() ? `?${p}` : ''}`);
  };

  const sel = { background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                padding: '8px 10px', width: '100%', fontSize: 13 };

  // Tags grouped so a list of 72 is navigable
  const groups = tags.reduce<Record<string, typeof tags>>((a, t) => {
    (a[t.tag_group ?? 'Other'] ||= []).push(t); return a;
  }, {});

  return (
    <div style={{ background: 'var(--warm-cream)', border: '1px solid var(--border)',
                  padding: 'var(--s4)', marginBottom: 'var(--s4)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
                    gap: 'var(--s3)' }}>
        <form onSubmit={(e) => { e.preventDefault();
          go({ q: new FormData(e.currentTarget).get('q') as string }); }} className="f">
          <label htmlFor="q">Search</label>
          <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="q" name="q" defaultValue={q} placeholder="Name, organisation, email" style={sel} />
        </form>

        <div className="f">
          <label htmlFor="role">Role</label>
          <select data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="role" value={role} style={sel} onChange={(e) => go({ role: e.target.value })}>
            <option value="">All roles</option>
            {roles.map((r) => <option key={r.id} value={r.role_key}>{r.label}</option>)}
          </select>
        </div>

        <div className="f">
          <label htmlFor="tag">Tag</label>
          <select data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="tag" value={tag} style={sel} onChange={(e) => go({ tag: e.target.value })}>
            <option value="">All tags</option>
            {Object.entries(groups).map(([g, items]) => (
              <optgroup key={g} label={g}>
                {items.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="f">
          <label htmlFor="status">Status</label>
          <select data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="status" value={status} style={sel} onChange={(e) => go({ status: e.target.value })}>
            <option value="">All statuses</option>
            {['Active','Inactive','Unsubscribed','Archived'].map((s) =>
              <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="f">
          <label htmlFor="sort">Sort by</label>
          <select data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="sort" value={sortKey} style={sel} onChange={(e) => go({ sort: e.target.value })}>
            {sorts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {(q || role || tag || status) && (
        <div style={{ marginTop: 'var(--s3)' }}>
          <button className="link-btn" onClick={() => router.push('/contacts')}>Clear all</button>
        </div>
      )}
    </div>
  );
}
