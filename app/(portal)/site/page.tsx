import { listCategories, listAllPractices } from '@/app/actions/siteContent';
import SiteTaxonomy from '@/components/SiteTaxonomy';
import { AddCategory } from '@/components/SiteCreate';

export const dynamic = 'force-dynamic';

export default async function SitePage() {
  const [cats, practices] = await Promise.all([
    listCategories(),
    listAllPractices(),
  ]);

  const byCat = new Map<number, any[]>();
  for (const p of practices as any[]) {
    const list = byCat.get(p.category_id) ?? [];
    list.push(p);
    byCat.set(p.category_id, list);
  }
  const withPractices = (cats as any[]).map((c) => ({ ...c, practices: byCat.get(c.id) ?? [] }));

  return (
    <>
      <div className="ph">
        <h2>Platform site</h2>
        <div className="ph-sub">
          The wellness &amp; retreat taxonomy and the editorial content that shows on
          the public site. Only <strong>Active</strong> pages are live; slugs lock
          once active.
        </div>
      </div>

      <div className="sect">
        <h3>Add a category</h3>
        <AddCategory />
      </div>

      <div className="sect">
        <h3>Categories &amp; practices</h3>
        <div className="ph-sub" style={{ marginBottom: 'var(--s3)' }}>
          {withPractices.length} categories. Each practice is listed under its category —
          set Shown-in and Status inline, add a practice straight into a category, or open
          a name to write its page.
        </div>
        <SiteTaxonomy categories={withPractices} />
      </div>
    </>
  );
}
