import AnalyticsNav from '@/components/AnalyticsNav';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="content"><div className="wrap">
      <div className="ph">
        <div>
          <h2>Analytics</h2>
          <div className="ph-sub">
            How The Global Sanctum is performing. Sanctum Institute is separate — that is the
            market data product, built on the analytics_ tables.
          </div>
        </div>
      </div>
      <AnalyticsNav />
      {children}
    </div></div>
  );
}
