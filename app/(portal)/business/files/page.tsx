import Link from 'next/link';
import { areas, files } from '@/app/actions/files';
import FileLibrary from '@/components/FileLibrary';

export const dynamic = 'force-dynamic';

export default async function FilesPage({
  searchParams,
}: { searchParams: Promise<{ area?: string; q?: string }> }) {
  const sp = await searchParams;
  const [tree, list] = await Promise.all([
    areas(), files(sp.area, sp.q),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/business">The business</Link> · Files
      </div>
      <FileLibrary areas={tree} files={list}
                   area={sp.area ?? 'all'} query={sp.q ?? ''} />
    </div></div>
  );
}
