import type { Metadata } from 'next';
import MarketplaceRouter from '@/components/MarketplaceRouter';
import { marketplaceMetadata } from '@/lib/marketplaceMeta';

export const dynamic = 'force-dynamic';
const MARKETPLACE = 'wellness-venues';
type Params = { params: Promise<{ path?: string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { path } = await params;
  return marketplaceMetadata(MARKETPLACE, path ?? []);
}

export default async function Page({ params }: Params) {
  const { path } = await params;
  return <MarketplaceRouter marketplace={MARKETPLACE} path={path ?? []} />;
}
