import Link from 'next/link';
import { headers } from 'next/headers';
import { accessHistory, failedAttempts, invitations } from '@/app/actions/access';
import { myRank, peopleAccess, roleDefinitions } from '@/app/actions/people';
import AccessLog from '@/components/AccessLog';
import PeopleAccess from '@/components/PeopleAccess';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const [people, roles, rank, invites, history, failed, h] = await Promise.all([
    peopleAccess(), roleDefinitions(), myRank(),
    invitations(), accessHistory(undefined, 60), failedAttempts(), headers(),
  ]);

  // The invitation link has to carry the real address, and the request
  // knows it where the server does not.
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${h.get('host') ?? 'localhost:3000'}`;

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/settings">Settings</Link> · People
      </div>
      <PeopleAccess people={people} roles={roles} myRank={rank} />
      <AccessLog invitations={invites} history={history} failed={failed}
                 roles={roles} myRank={rank} origin={origin} />
    </div></div>
  );
}
