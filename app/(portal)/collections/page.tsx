import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import NewCollection from '@/components/NewCollection';

export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  const supabase = await createClient();

  const [{ data: collections }, { data: counts }] = await Promise.all([
    supabase.from('collections').select('*').order('display_order').order('name'),
    supabase.from('collection_venues').select('collection_id'),
  ]);

  const tally = new Map<number, number>();
  (counts ?? []).forEach((c: any) =>
    tally.set(c.collection_id, (tally.get(c.collection_id) ?? 0) + 1));

  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Collections</h2>
          <div className="ph-sub">
            Curated groupings for the venues index and home page
          </div>
        </div>
      </div>

      <div className="note">
        <strong>A collection is an editorial judgement, not a filter.</strong></div>

      <div style={{ marginBottom: 'var(--s6)', paddingBottom: 'var(--s5)',
                    borderBottom: '1px solid var(--border)' }}>
        <NewCollection />
      </div>

      {!collections?.length && <div className="note">None yet.</div>}

      {!!collections?.length && (
        <table>
          <thead>
            <tr><th>Collection</th><th>Marketplace</th><th>Venues</th><th>Status</th><th>Slug</th></tr>
          </thead>
          <tbody>
            {collections.map((c: any) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/collections/${c.id}`} style={{ textDecoration: 'none' }}>
                    <div className="v-name">{c.name}</div>
                    {c.tagline && <div className="v-slug">{c.tagline}</div>}
                  </Link>
                </td>
                <td>{c.marketplace
                  ? <span className="pill">{c.marketplace}</span>
                  : <span className="pill empty">Both</span>}</td>
                <td>{tally.get(c.id) ?? 0}</td>
                <td>
                  {c.is_published
                    ? <span className="pill gold">Published</span>
                    : <span className="pill empty">Draft</span>}
                  {c.is_featured && <span className="pill" style={{ marginLeft: 4 }}>Featured</span>}
                </td>
                <td className="v-slug">{c.slug}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div></div>
  );
}
