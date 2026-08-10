import Link from 'next/link';
import { notFound } from 'next/navigation';
import { doc, docVersions } from '@/app/actions/internalDocs';
import DocEditor from '@/components/DocEditor';

export const dynamic = 'force-dynamic';

export default async function DocPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await doc(slug);
  if (!d) notFound();
  const versions = await docVersions(d.id);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/docs">Internal docs</Link> · {d.category}
      </div>
      <DocEditor doc={d} versions={versions} />
    </div></div>
  );
}
