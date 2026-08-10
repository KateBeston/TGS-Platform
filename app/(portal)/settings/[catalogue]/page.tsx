import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCatalogue } from '@/lib/catalogueSchema';
import CatalogueEditor from '@/components/CatalogueEditor';

export const dynamic = 'force-dynamic';

export default async function CataloguePage({
  params,
}: { params: Promise<{ catalogue: string }> }) {
  const { catalogue } = await params;
  const def = getCatalogue(catalogue);
  if (!def) notFound();

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from(def.table).select('*')
    .order('display_order', { nullsFirst: false }).order('name');

  let parents: { id: number; name: string }[] = [];
  if (def.parent) {
    const { data } = await supabase.from(def.parent.table).select('id,name').order('name');
    parents = data ?? [];
  }

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/settings">Settings</Link> · {def.label}
      </div>

      <div className="ph">
        <div>
          <h2>{def.label}</h2>
          <div className="ph-sub">{def.blurb}</div>
        </div>
      </div>

      {error && <div className="note bad"><strong>Query failed.</strong> {error.message}</div>}

      {def.protected && (
        <div className="note">
          <strong>Slugs on this catalogue are protected.</strong> Each is read-only until
          unlocked, and the database refuses a change while the record is published —
          changing a live slug breaks the URL and every link pointing at it.
        </div>
      )}

      <CatalogueEditor def={def} rows={rows ?? []} parents={parents} />
    </div></div>
  );
}
