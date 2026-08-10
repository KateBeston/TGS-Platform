import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ContactFilters from '@/components/ContactFilters';
import NewContact from '@/components/NewContact';

export const dynamic = 'force-dynamic';

const SIZES = [25, 50, 100, 250];

const SORTS: Record<string, { label: string; column: string; asc: boolean }> = {
  surname_asc:  { label: 'Surname · A to Z',  column: 'surname',    asc: true },
  first_asc:    { label: 'First name · A to Z', column: 'first_name', asc: true },
  org_asc:      { label: 'Organisation · A to Z', column: 'organisation', asc: true },
  created_desc: { label: 'Recently added',    column: 'created_at', asc: false },
  updated_desc: { label: 'Recently updated',  column: 'updated_at', asc: false },
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; role?: string; tag?: string; status?: string;
    sort?: string; page?: string; size?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const role = sp.role ?? '';
  const tag = sp.tag ?? '';
  const status = sp.status ?? '';
  const sortKey = sp.sort && SORTS[sp.sort] ? sp.sort : 'surname_asc';
  const sort = SORTS[sortKey];
  const size = SIZES.includes(Number(sp.size)) ? Number(sp.size) : 50;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * size;

  const supabase = await createClient();

  let query = supabase.from('contacts').select('*', { count: 'exact' });

  // Role and tag are many-to-many. An inner join narrows the set without a
  // second round trip; the full role list for display comes separately.
  if (role) {
    const { data: ids } = await supabase
      .from('contact_roles')
      .select('contact_id, contact_role_types!inner(role_key)')
      .eq('contact_role_types.role_key', role);
    query = query.in('id', (ids ?? []).map((r: any) => r.contact_id));
  }
  if (tag) {
    const { data: ids } = await supabase
      .from('contact_tag_assignments').select('contact_id').eq('tag_id', Number(tag));
    query = query.in('id', (ids ?? []).map((r: any) => r.contact_id));
  }
  if (status) query = query.eq('status', status);
  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,surname.ilike.%${q}%,organisation.ilike.%${q}%,email.ilike.%${q}%`
    );
  }

  const [{ data, error, count }, { data: roleTypes }, { data: tags }] = await Promise.all([
    query.order(sort.column, { ascending: sort.asc, nullsFirst: false }).range(from, from + size - 1),
    supabase.from('contact_role_types').select('id,role_key,label,division')
      .eq('is_active', true).order('display_order'),
    supabase.from('contact_tags').select('id,name,tag_group')
      .eq('is_active', true).order('tag_group').order('name'),
  ]);

  // Roles for the rows on screen only — never for the whole table.
  const ids = (data ?? []).map((c: any) => c.id);
  const { data: rowRoles } = ids.length
    ? await supabase.from('contact_roles')
        .select('contact_id, contact_role_types(label)').in('contact_id', ids)
    : { data: [] as any[] };

  const rolesByContact = new Map<number, string[]>();
  (rowRoles ?? []).forEach((r: any) => {
    const list = rolesByContact.get(r.contact_id) ?? [];
    if (r.contact_role_types?.label) list.push(r.contact_role_types.label);
    rolesByContact.set(r.contact_id, list);
  });

  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const filtered = !!(q || role || tag || status);
  const activeRole = (roleTypes ?? []).find((r: any) => r.role_key === role);

  return (
    <div className="content">
      <div className="ph">
        <div>
          <h2>{activeRole ? activeRole.label + 's' : 'Contacts'}</h2>
          <div className="ph-sub">
            {total.toLocaleString('en-AU')} record{total === 1 ? '' : 's'}
            {filtered && !activeRole && ' matching filters'}
            {total > size && ` · page ${page} of ${pages}`}
          </div>
        </div>
      </div>

      <div className="note">
        <strong>One record per person or organisation.</strong> Roles say what someone is to
        the business — a venue owner who also hosts retreats is one contact holding two roles,
        not two records with two email addresses that drift apart.
      </div>

      <div style={{ marginBottom: 'var(--s5)', paddingBottom: 'var(--s5)',
                    borderBottom: '1px solid var(--border)' }}>
        <NewContact />
      </div>

      <ContactFilters
        q={q} role={role} tag={tag} status={status} sortKey={sortKey} size={size}
        sorts={Object.entries(SORTS).map(([k, v]) => ({ key: k, label: v.label }))}
        roles={roleTypes ?? []} tags={tags ?? []}
      />

      {error && <div className="note bad"><strong>Query failed.</strong> {error.message}</div>}

      {!!data?.length && (
        <table>
          <thead>
            <tr><th>Name</th><th>Organisation</th><th>Roles</th><th>Email</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.map((c: any) => {
              const name = [c.first_name, c.surname].filter(Boolean).join(' ');
              const roles = rolesByContact.get(c.id) ?? [];
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/contacts/${c.id}`} style={{ textDecoration: 'none' }}>
                      <div className="v-name">{name || c.organisation || 'Unnamed'}</div>
                    </Link>
                  </td>
                  <td>{name ? (c.organisation ?? '—') : <span className="pill">Organisation</span>}</td>
                  <td>
                    {roles.length
                      ? roles.map((r) => <span key={r} className="pill" style={{ marginRight: 4 }}>{r}</span>)
                      : <span className="pill empty">No role</span>}
                  </td>
                  <td className="v-slug">{c.email ?? '—'}</td>
                  <td>{c.status === 'Active'
                    ? <span className="pill">Active</span>
                    : <span className="pill empty">{c.status}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!data?.length && !error && (
        <div className="note" style={{ marginTop: 'var(--s5)' }}>
          {filtered ? 'No contacts match these filters.' : 'No contacts yet.'}
        </div>
      )}
    </div>
  );
}
