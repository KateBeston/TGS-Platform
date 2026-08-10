import Link from 'next/link';
import { statements, statementsDue } from '@/app/actions/billing';
import StatementsScreen from '@/components/StatementsScreen';

export const dynamic = 'force-dynamic';

export default async function StatementsPage() {
  const [list, due] = await Promise.all([statements(), statementsDue()]);
  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/finance">Finance</Link> · Statements
      </div>
      <StatementsScreen statements={list} due={due} />
    </div></div>
  );
}
