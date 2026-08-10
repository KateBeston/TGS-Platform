import { getAnalyticsTab } from '@/lib/analyticsTabs';

export default function Page() {
  const tab = getAnalyticsTab('content')!;
  return (
    <div className="note" style={{ marginBottom: 0 }}>
      <strong>{tab.blurb}.</strong> Nothing to show yet — this tab is waiting on {tab.waitingOn}.
      It will fill on its own once that exists. Showing sample figures here would be worse than
      showing none, because a dashboard is trusted by default.
    </div>
  );
}
