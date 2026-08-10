import Link from 'next/link';
import { brands } from '@/app/actions/brands';
import BrandList from '@/components/BrandList';

export const dynamic = 'force-dynamic';

export default async function BrandsPage() {
  const list = await brands();
  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> · Brands
      </div>
      <BrandList brands={list} />
    </div></div>
  );
}
