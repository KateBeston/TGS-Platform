import { notFound } from 'next/navigation';
import CategoryEditor from '@/components/CategoryEditor';
import { getCategory, practicesInCategory } from '@/app/actions/siteContent';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function CategoryPage({ params }: Params) {
  const { id } = await params;
  const category = await getCategory(Number(id));
  if (!category) notFound();
  const practices = await practicesInCategory(category.id);
  return <CategoryEditor category={category} practices={practices} />;
}
