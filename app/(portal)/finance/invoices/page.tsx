import Link from 'next/link';
import { invoices, readyToInvoice } from '@/app/actions/billing';
import InvoicesScreen from '@/components/InvoicesScreen';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage({
  searchParams,
}: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const [list, ready] = await Promise.all([
    invoices(sp.status), readyToInvoice(),
  ]);
  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/finance">Finance</Link> · Invoices
      </div>
      <InvoicesScreen invoices={list} ready={ready} status={sp.status ?? 'all'} />
    </div></div>
  );
}
