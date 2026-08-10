import Link from 'next/link';
import { legalDocumentList } from '@/app/actions/legal';
import BatchLegalUpload from '@/components/BatchLegalUpload';

export const dynamic = 'force-dynamic';

export default async function BatchUploadPage() {
  const documents = await legalDocumentList();
  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/legal">Legal</Link> · Batch upload
      </div>
      <BatchLegalUpload documents={documents} />
    </div></div>
  );
}
