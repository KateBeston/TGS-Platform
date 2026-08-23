import Link from 'next/link';
import { retreatStyles } from '@/lib/retreatStyles';

export default async function RetreatStyleIndex() {
  const styles = await retreatStyles();
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <div className="tb-crumb"><Link href="/retreat-venues">Retreat venues</Link></div>
          <h1 style={{ marginTop: 'var(--s4)' }}>Retreat venues by style</h1>
          <p className="page-sub">Find the setting for the retreat you want to lead — from yoga and meditation to nature-based sanctuaries and beyond.</p>
        </div>
      </section>
      <div className="wrap">
        <div className="style-map">
          {styles.map((s) => (
            <Link key={s.id} href={`/retreat-venues/style/${s.slug}`} className="style-card">
              <span className="style-card-name">{s.name}</span>
              {s.description && <span className="style-card-desc">{s.description}</span>}
              <span className="style-card-go">Explore &rarr;</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
