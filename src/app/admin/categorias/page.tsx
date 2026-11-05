import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { CategoryForm } from '@/components/admin/forms';

export const metadata = { title: 'Categorias' };

export default async function AdminCategories() {
  await requireStaff('admin');
  const supabase = await createClient();
  const { data } = await supabase.from('business_categories').select('id, name, slug, icon, sort').order('sort');
  return (
    <>
      <AdminTitle title="Categorias de empresas" />
      <Panel title="Nova categoria"><CategoryForm /></Panel>
      <Panel title="Categorias" className="mt-4">
        <ul className="space-y-3">{(data || []).map((c: { id: number; name: string; slug: string; icon: string; sort: number }) => <li key={c.id}><CategoryForm c={c} /></li>)}</ul>
      </Panel>
    </>
  );
}
