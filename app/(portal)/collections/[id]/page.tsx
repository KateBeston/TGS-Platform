import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CollectionEditor from '@/components/CollectionEditor';

export const dynamic = 'force-dynamic';

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collectionId = Number(id);
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from('collections').select('*').eq('id', collectionId).single();
  if (!collection) notFound();

  const { data: members } = await supabase
    .from('collection_venues')
    .select('venue_id, display_order, venues(id,venue_name,slug,countries(name))')
    .eq('collection_id', collectionId)
    .order('display_order', { nullsFirst: false });

  return (
    <div className="content"><div className="wrap">
      <div className="tb-crumb" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/collections">Collections</Link> · {collection.name}
      </div>
      <CollectionEditor collection={collection} members={members ?? []} />
    </div></div>
  );
}
