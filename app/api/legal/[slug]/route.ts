import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderLegal, renderPlain } from '@/lib/legalRender';

export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════
   PUBLIC LEGAL DOCUMENT

   GET /api/legal/{slug}?format=json|html|md|txt

   What the platform site reads. The wording lives in the database, so a
   change to a policy is an edit here rather than a redeploy of the site —
   which is the whole reason legal text is not in Sanity or in markup.

   Only published documents with a current version are served. An
   unpublished draft returning 404 is correct: it is not in force.

   CORS is open because this is public text by definition. There is
   nothing here a person cannot already read on the website.
   ═══════════════════════════════════════════════════════════════════════ */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const format = req.nextUrl.searchParams.get('format') ?? 'json';
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('legal_documents')
    .select('id,name,slug,summary,document_type,category,meta_title,meta_description,is_published')
    .eq('slug', slug).maybeSingle();

  if (!doc || !doc.is_published) {
    return NextResponse.json(
      { error: 'Not found or not published.' }, { status: 404, headers: cors });
  }

  const { data: version } = await supabase
    .from('legal_document_versions')
    .select('id,version_label,body,effective_from,change_summary')
    .eq('legal_document_id', doc.id).eq('is_current', true).maybeSingle();

  if (!version?.body) {
    return NextResponse.json(
      { error: 'No current wording.' }, { status: 404, headers: cors });
  }

  const filename = `${doc.slug}-${version.effective_from ?? 'current'}`;

  if (format === 'html') {
    return new NextResponse(renderLegal(version.body), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...cors },
    });
  }

  if (format === 'md') {
    return new NextResponse(version.body, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.md"`,
        ...cors,
      },
    });
  }

  if (format === 'txt') {
    return new NextResponse(renderPlain(version.body), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.txt"`,
        ...cors,
      },
    });
  }

  return NextResponse.json({
    slug: doc.slug,
    name: doc.name,
    summary: doc.summary,
    category: doc.category,
    audience: doc.document_type,
    meta: { title: doc.meta_title, description: doc.meta_description },
    version: {
      id: version.id,
      label: version.version_label,
      effective_from: version.effective_from,
      change_summary: version.change_summary,
    },
    // Both, so the site can render the markup or reformat from the source.
    body_markdown: version.body,
    body_html: renderLegal(version.body),
  }, { headers: cors });
}
