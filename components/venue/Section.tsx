export function Section({
  tone = 'white', label, title, subtitle, children,
}: {
  tone?: 'white' | 'cream';
  label?: string; title?: string; subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`section section--${tone}`}>
      <div className="wrap">
        {(label || title || subtitle) && (
          <div className="section-header">
            {label && <div className="section-label">{label}</div>}
            {title && <h2 className="section-title">{title}</h2>}
            {subtitle && <p className="section-subtitle">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/* Each tab opens on its own image.
 *
 * From the template, and it does real work — it says which part of the
 * venue you are looking at before you read a word. */
export function TabHero({
  image, label, title, subtitle,
}: { image: string | null; label: string; title: string; subtitle?: string }) {
  if (!image) return null;
  return (
    <div className="tab-hero" style={{ backgroundImage: `url(${image})` }}>
      <div className="tab-hero-content">
        <div className="tab-hero-label">{label}</div>
        <h2 className="tab-hero-title">{title}</h2>
        {subtitle && <p className="tab-hero-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}

/* At a glance.
 *
 * Only what is actually recorded. A stat block with an em dash in it is
 * worse than one with three entries — it advertises the gap. */
export function Glance({ stats }: { stats: [string, any][] }) {
  const real = stats.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!real.length) return null;
  return (
    <div className="stats-grid">
      {real.map(([label, value]) => (
        <div key={label} className="stat-item">
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  );
}
