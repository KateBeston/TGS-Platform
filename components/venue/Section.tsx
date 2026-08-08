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

/* The experience write-up.
 *
 * Its own headline, subtitle and image, all from the record. Renders
 * nothing until there is something to say. */
export function ExperienceBlock({
  v, tone = 'cream',
}: { v: Record<string, any>; tone?: 'white' | 'cream' }) {
  if (!v.experience_description && !v.experience_title) return null;
  return (
    <Section tone={tone}
      title={v.experience_title ?? undefined}
      subtitle={v.experience_subtitle ?? undefined}>
      {v.experience_image_url ? (
        <div className="feature-split">
          <div><img src={v.experience_image_url} alt="" /></div>
          <div><p className="feature-body">{v.experience_description}</p></div>
        </div>
      ) : (
        v.experience_description && (
          <div className="prose-narrow"><p>{v.experience_description}</p></div>
        )
      )}
    </Section>
  );
}

/* Accessibility.
 *
 * The step-free facts as pills, then the path notes and any access
 * policy in words. Only the affordances that are true are shown — a
 * crossed-out list reads as an apology. */
export function Accessibility({
  v, tone = 'white',
}: { v: Record<string, any>; tone?: 'white' | 'cream' }) {
  const flags = ([
    [v.step_free_entrance, 'Step-free entrance'],
    [v.step_free_to_dining, 'Step-free to dining'],
    [v.step_free_to_practice_space, 'Step-free to practice space'],
    [v.accessible_parking, 'Accessible parking'],
  ] as [any, string][]).filter(([on]) => on).map(([, label]) => label);

  const hasPolicy = v.access_policy_type || v.access_policy_details;
  if (!flags.length && !v.access_path_notes && !hasPolicy) return null;

  return (
    <Section tone={tone} title="Accessibility">
      {!!flags.length && (
        <div className="amenity-pill-row" style={{ justifyContent: 'center' }}>
          {flags.map((f) => <span key={f} className="amenity-pill">{f}</span>)}
        </div>
      )}
      {(v.access_path_notes || hasPolicy) && (
        <div className="prose-narrow"
          style={{ marginTop: flags.length ? 24 : 0, textAlign: 'center' }}>
          {v.access_path_notes && <p>{v.access_path_notes}</p>}
          {hasPolicy && (
            <p>
              {v.access_policy_type && <strong>{v.access_policy_type}. </strong>}
              {v.access_policy_details}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

/* Where to find the venue elsewhere — the site and the socials, when the
 * record carries them. */
export function VenueLinks({
  v, tone = 'cream',
}: { v: Record<string, any>; tone?: 'white' | 'cream' }) {
  const links = ([
    [v.website_url, 'Visit website'],
    [v.instagram_url, 'Instagram'],
    [v.facebook_url, 'Facebook'],
  ] as [any, string][]).filter(([url]) => url);
  if (!links.length) return null;

  return (
    <Section tone={tone} title="Find them online">
      <div className="amenity-pill-row" style={{ justifyContent: 'center' }}>
        {links.map(([url, label]) => (
          <a key={url} className="amenity-pill" href={url}
             target="_blank" rel="noopener">{label}</a>
        ))}
      </div>
    </Section>
  );
}
