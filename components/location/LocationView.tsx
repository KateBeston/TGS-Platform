import Link from 'next/link';
import { venueCards } from '@/lib/venues';
import { marketplaceOf } from '@/lib/venue';
import VenueGrid from '@/components/VenueGrid';
import { locationChildren, type Resolved } from '@/lib/locations';

function trailOf(marketplace: string, loc: Resolved) {
  const label = marketplaceOf(marketplace) === 'Retreat' ? 'Retreat venues' : 'Wellness venues';
  const items: { name: string; href: string }[] = [{ name: label, href: `/${marketplace}` }];
  const chain = [loc.continent, loc.country, loc.state, loc.city].filter(Boolean) as any[];
  const acc: string[] = [];
  for (const c of chain) { acc.push(c.slug); items.push({ name: c.name, href: `/${marketplace}/${acc.join('/')}` }); }
  return items;
}

export default async function LocationView({ marketplace, loc }: { marketplace: string; loc: Resolved }) {
  const kind = marketplaceOf(marketplace);
  const label = kind === 'Retreat' ? 'Retreat venues' : 'Wellness venues';
  const [cardsResult, children] = await Promise.all([
    venueCards({ marketplace: kind ?? undefined, ...loc.filter }),
    locationChildren(loc),
  ]);
  const cards = cardsResult.cards;
  const row = loc.row;
  const trail = trailOf(marketplace, loc);

  return (
    <div className="loc-page">
      {row.hero_image_url && (
        <div className="loc-hero-img" style={{ backgroundImage: `url(${row.hero_image_url})` }} aria-hidden="true" />
      )}
      <header className="loc-hero">
        <nav className="loc-crumbs" aria-label="Breadcrumb">
          {trail.map((c, i) => (
            <span key={c.href}>
              {i > 0 && <span className="loc-crumb-sep">/</span>}
              {i < trail.length - 1 ? <Link href={c.href}>{c.name}</Link> : <span>{c.name}</span>}
            </span>
          ))}
        </nav>
        <p className="loc-eyebrow">{label} &middot; {loc.level}</p>
        <h1>{row.h1 ?? row.name}</h1>
        {row.intro && <p className="loc-intro">{row.intro}</p>}
      </header>

      {children.items.length > 0 && (
        <section className="loc-children">
          <h2>{children.label}</h2>
          <div className="loc-child-grid">
            {children.items.map((c: { name: string; slug: string; count: number; href: string }) => (
              <Link key={c.slug} href={`/${marketplace}${c.href}`} className="loc-child">
                <span className="loc-child-name">{c.name}</span>
                <span className="loc-child-n">{c.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="loc-venues">
        <h2>{label} in {row.name}</h2>
        {cards.length ? <VenueGrid cards={cards} />
          : <p className="loc-empty">No {label.toLowerCase()} listed here yet.</p>}
      </section>
    </div>
  );
}
