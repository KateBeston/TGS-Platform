import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  brand, brandFacilities, brandOverview, brandServices, candidatesFor, listingGrid,
  tidyFor,
} from '@/app/actions/brands';
import BrandCandidates from '@/components/BrandCandidates';
import BrandTidy from '@/components/BrandTidy';
import BrandListings from '@/components/BrandListings';
import BrandRollup from '@/components/BrandRollup';
import BrandRecord from '@/components/BrandRecord';

export const dynamic = 'force-dynamic';

export default async function BrandPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await brand(Number(id));
  if (!b) notFound();

  const [overview, services, facilities, grid, candidates] = await Promise.all([
    brandOverview(Number(id)),
    brandServices(Number(id)),
    brandFacilities(Number(id)),
    listingGrid(Number(id)),
    candidatesFor(Number(id)),
  ]);

  const tidy = await tidyFor(b.name);

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/venues">Venues</Link> ·{' '}
        <Link href="/venues/brands">Brands</Link> · {b.name}
      </div>
      <BrandRecord brand={b} />

      {b.brand_kind !== 'Operator brand' && (
        <>
          <BrandTidy brandId={b.id} rows={tidy} />
          <BrandCandidates brandId={b.id} candidates={candidates} />
          <BrandListings rows={grid} />
          <BrandRollup brandId={b.id} overview={overview}
                       services={services} facilities={facilities} />
        </>
      )}
    </div></div>
  );
}
