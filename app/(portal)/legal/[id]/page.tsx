import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LegalDocumentEditor from '@/components/LegalDocumentEditor';

export const dynamic = 'force-dynamic';

export default async function LegalDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docId = Number(id);
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('legal_documents').select('*').eq('id', docId).single();
  if (!doc) notFound();

  const [{ data: versions }, { data: files }, { count: acceptances },
         { data: changes }, { data: access }] = await Promise.all([
    supabase.from('legal_document_versions').select('*')
      .eq('legal_document_id', docId)
      .order('effective_from', { ascending: false, nullsFirst: false }),
    supabase.from('legal_files').select('*')
      .eq('legal_document_id', docId).order('uploaded_at', { ascending: false }),
    supabase.from('legal_acceptances')
      .select('*', { count: 'exact', head: true }).eq('legal_document_id', docId),
    supabase.from('legal_change_log').select('*')
      .eq('legal_document_id', docId)
      .order('changed_at', { ascending: false }).limit(40),
    supabase.from('legal_file_access').select('*')
      .eq('legal_document_id', docId)
      .order('accessed_at', { ascending: false }).limit(30),
  ]);

  // No signed URLs up front. A URL generated on page load is a file
  // handed out whether or not anybody opens it, and it leaves no record.
  // Downloads go through openLegalFile(), which logs the access and
  // returns a URL lasting five minutes.

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/legal">Legal</Link> · {doc.name}
      </div>
      <LegalDocumentEditor
        doc={doc}
        versions={versions ?? []}
        files={files ?? []}
        acceptances={acceptances ?? 0}
        changes={changes ?? []}
        access={access ?? []}
      />
    </div></div>
  );
}
