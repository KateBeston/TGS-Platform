import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ChangeLog from '@/components/ChangeLog';

export const dynamic = 'force-dynamic';

export default async function ChangesPage({
  searchParams,
}: { searchParams: Promise<{ filter?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('legal_change_log')
    .select('*, legal_documents(id,name,requires_acceptance)')
    .order('changed_at', { ascending: false })
    .limit(300);

  if (sp.filter === 'unexplained') {
    query = query.is('reason', null)
      .in('change_type', ['Wording', 'Put in force', 'Published', 'Field']);
  }

  const [{ data: entries }, { count: unexplained }] = await Promise.all([
    query,
    supabase.from('unexplained_legal_changes')
      .select('*', { count: 'exact', head: true }),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/legal">Legal</Link> · Change history
      </div>
      <ChangeLog
        entries={entries ?? []}
        unexplained={unexplained ?? 0}
        filter={sp.filter ?? 'all'}
      />
    </div></div>
  );
}
