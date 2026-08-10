import Link from 'next/link';
import { toReconcile } from '@/app/actions/manualPayments';
import { createClient } from '@/lib/supabase/server';
import ManualPayment from '@/components/ManualPayment';
import NewBooking from '@/components/NewBooking';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const supabase = await createClient();
  const [unreconciled, { data: hostTypes }] = await Promise.all([
    toReconcile(),
    supabase.from('host_types').select('id,name')
      .eq('is_active', true).order('display_order'),
  ]);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/finance/subscriptions">Finance</Link> · Payments
      </div>
      <NewBooking hostTypes={hostTypes ?? []} />
      <ManualPayment unreconciled={unreconciled} />
    </div></div>
  );
}
