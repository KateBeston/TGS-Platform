'use client';

import Link from 'next/link';

const LABELS: Record<string, string> = {
  venue_type_id: 'Venue type',
  venue_short_description: 'Short description',
  max_guests: 'Maximum guests',
  total_bedrooms: 'Bedrooms',
  total_bathrooms: 'Bathrooms',
  established_year: 'Established',
  setting_headline: 'Setting',
  property_size: 'Property size',
  byo_facilitator_friendly: 'Own facilitators welcome',
  external_practitioners_welcome: 'External practitioners',
  wifi_available: 'WiFi',
  pets_allowed: 'Pets',
  children_allowed: 'Children',
  price_from: 'From price',
  price_currency: 'Currency',
};

export default function CoverageReport({ summary }: { summary: any }) {
  const { total, read, spend, fields } = summary;
  const pct = (n: number) => read ? Math.round((n / read) * 100) : 0;

  return (
    <>
      <div className="ph">
        <div>
          <h2>What the web does not say</h2>
          <div className="ph-sub">
            {read.toLocaleString('en-AU')} of {total.toLocaleString('en-AU')} venues read
          </div>
        </div>
        <div className="ph-act">
          <Link className="btn quiet" href="/venues/harvest">Back to harvest</Link>
        </div>
      </div>

      <div className="note">
        <strong>A field with nothing proposed is two different things.</strong></div>

      {spend && (
        <div className="stats">
          <div className="stat">
            <div className="v">${Number(spend.spent_usd ?? 0).toFixed(2)}</div>
            <div className="l">Spent</div>
          </div>
          <div className="stat">
            <div className="v">${Number(spend.avg_per_venue ?? 0).toFixed(4)}</div>
            <div className="l">Per venue</div>
          </div>
          <div className="stat">
            <div className="v">${Number(spend.projected_remaining_usd ?? 0).toFixed(2)}</div>
            <div className="l">To read the rest</div>
          </div>
          <div className="stat">
            <div className={`v ${spend.failed ? '' : 'zero'}`}>{spend.failed ?? 0}</div>
            <div className="l">Failed</div>
          </div>
        </div>
      )}

      <div className="sect">
        <h3>By field</h3>
        {!fields.length && (
          <div className="note" style={{ marginBottom: 0 }}>
            Nothing recorded yet. Read a batch first — gaps are captured from the next run onwards.
          </div>
        )}
        {!!fields.length && (
          <table>
            <thead>
              <tr>
                <th>Field</th><th>Site is silent</th>
                <th>Already held</th><th>Agreed with ours</th><th></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f: any) => {
                const silentPct = pct(f.silent);
                return (
                  <tr key={f.column}>
                    <td><span className="v-name" style={{ fontSize: 16 }}>
                      {LABELS[f.column] ?? f.column}</span></td>
                    <td>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{f.silent}</span>
                      <span className="v-slug"> · {silentPct}%</span>
                    </td>
                    <td className="v-slug">{f.held}</td>
                    <td className="v-slug">{f.same}</td>
                    <td className="v-slug" style={{ maxWidth: 260 }}>
                      {silentPct >= 80
                        ? 'Rarely published — ask venues directly'
                        : silentPct >= 50
                          ? 'Often missing from websites'
                          : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
