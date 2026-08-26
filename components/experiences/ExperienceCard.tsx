/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { type ExperienceCard as EC, experienceImage, experiencePlace, experienceHref } from '@/lib/bookingExperiences';

function money(v: number | null, ccy: string | null, from: boolean | null) {
  if (v == null) return null;
  const s = new Intl.NumberFormat('en-AU', { style: 'currency', currency: ccy || 'AUD', maximumFractionDigits: 0 }).format(v);
  return from ? `from ${s}` : s;
}
function duration(mins: number | null) {
  if (!mins) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h} hr`;
}

export default function ExperienceCard({ e }: { e: EC }) {
  const img = experienceImage(e);
  const price = money(e.base_price, e.currency, e.price_is_from);
  const dur = duration(e.duration_minutes);
  return (
    <Link href={experienceHref(e)} className="xp-card">
      <div className="xp-card-img">
        {img ? <img src={img} alt={e.name} loading="lazy" /> : <div className="xp-card-noimg" />}
        {e.category && <span className="xp-card-cat">{e.category}</span>}
      </div>
      <div className="xp-card-body">
        <h3 className="xp-card-name">{e.name}</h3>
        <div className="xp-card-venue">{e.venue_name}</div>
        <div className="xp-card-place">{experiencePlace(e)}</div>
        <div className="xp-card-foot">
          {dur && <span className="xp-card-dur">{dur}</span>}
          {price && <span className="xp-card-price">{price}</span>}
        </div>
      </div>
    </Link>
  );
}
