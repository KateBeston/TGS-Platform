import { businessRecords, emailAliases, renewals, settings } from '@/app/actions/business';
import EmailAliases from '@/components/EmailAliases';
import TheBusiness from '@/components/TheBusiness';

export const dynamic = 'force-dynamic';

export default async function BusinessPage({
  searchParams,
}: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const [records, due, config, aliases] = await Promise.all([
    businessRecords(sp.type), renewals(), settings(), emailAliases(),
  ]);
  return (
    <div className="content"><div className="wrap">
      <TheBusiness records={records} renewals={due} settings={config}
                   type={sp.type ?? 'all'} />
      <EmailAliases aliases={aliases} />
    </div></div>
  );
}
