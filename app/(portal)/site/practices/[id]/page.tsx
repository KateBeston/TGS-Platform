import { notFound } from 'next/navigation';
import PracticeEditor from '@/components/PracticeEditor';
import { getPractice, getCategory } from '@/app/actions/siteContent';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function PracticePage({ params }: Params) {
  const { id } = await params;
  const practice = await getPractice(Number(id));
  if (!practice) notFound();
  const category = practice.category_id ? await getCategory(practice.category_id) : null;
  return <PracticeEditor practice={practice} category={category} />;
}
