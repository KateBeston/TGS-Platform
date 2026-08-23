import type { Metadata } from 'next';
import MarketplaceRouter from '@/components/MarketplaceRouter';
import RetreatStyleCategory from '@/components/RetreatStyleCategory';
import RetreatStyleIndex from '@/components/RetreatStyleIndex';
import { marketplaceMetadata } from '@/lib/marketplaceMeta';
import { styleBySlug } from '@/lib/retreatStyles';

export const dynamic = 'force-dynamic';
const MARKETPLACE = 'retreat-venues';
type Params = { params: Promise<{ path?: string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { path } = await params;
  const p = path ?? [];
  if (p[0] === 'style' && p[1]) {
    const s = await styleBySlug(p[1]);
    if (s) return {
      title: s.meta_title || `Retreat venues for ${s.name}`,
      description: s.meta_description || s.description || undefined,
    };
  }
  if (p[0] === 'style') return { title: 'Retreat venues by style — The Global Sanctum' };
  return marketplaceMetadata(MARKETPLACE, p);
}

export default async function Page({ params }: Params) {
  const { path } = await params;
  const p = path ?? [];
  if (p[0] === 'style') {
    return p.length === 1 ? <RetreatStyleIndex /> : <RetreatStyleCategory slug={p[1]} />;
  }
  return <MarketplaceRouter marketplace={MARKETPLACE} path={p} />;
}
