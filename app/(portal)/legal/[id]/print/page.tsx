import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LegalPrint from '@/components/LegalPrint';

export const dynamic = 'force-dynamic';

export default async function LegalPrintPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ audience?: string; version?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const docId = Number(id);
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('legal_documents').select('*').eq('id', docId).single();
  if (!doc) notFound();

  const { data: versions } = await supabase
    .from('legal_document_versions').select('*')
    .eq('legal_document_id', docId)
    .order('effective_from', { ascending: false, nullsFirst: false });

  // A named version can be printed, so what was in force on a given date
  // can be produced if it is ever questioned.
  const chosen = sp.version
    ? (versions ?? []).find((v: any) => String(v.id) === sp.version)
    : (versions ?? []).find((v: any) => v.is_current) ?? (versions ?? [])[0];

  const { data: settings } = await supabase
    .from('tgs_settings').select('setting_key,setting_value')
    .eq('setting_group', 'Legal entity');

  return (
    <LegalPrint
      doc={doc}
      version={chosen ?? null}
      versions={versions ?? []}
      entity={Object.fromEntries(
        (settings ?? []).map((s: any) => [s.setting_key, s.setting_value]))}
      audience={sp.audience === 'internal' ? 'internal' : 'public'}
    />
  );
}
