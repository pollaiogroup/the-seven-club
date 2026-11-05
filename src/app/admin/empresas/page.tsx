import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { FeatureToggle, HideToggle } from '@/components/admin/forms';
import { Avatar } from '@/components/ui/avatar';

export const metadata = { title: 'Empresas' };
type B = { id: string; slug: string; name: string; logo_path: string | null; owner_id: string; featured: boolean; hidden_at: string | null };

export default async function AdminBusinesses() {
  await requireStaff('admin');
  const supabase = await createClient();
  const { data } = await supabase.from('businesses').select('id, slug, name, logo_path, owner_id, featured, hidden_at').order('name').limit(500);
  const list = (data || []) as B[];
  const { data: owners } = list.length ? await supabase.from('profiles').select('id, full_name').in('id', [...new Set(list.map((b) => b.owner_id))]) : { data: [] };
  const name = new Map(((owners || []) as { id: string; full_name: string }[]).map((o) => [o.id, o.full_name]));
  return (
    <>
      <AdminTitle title="Empresas" subtitle="Destaque as empresas que aparecem em “Destaques do Clube” ou oculte cadastros fora das regras." />
      <Panel>
        <ul className="divide-y divide-line">
          {list.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={b.name} path={b.logo_path} size={40} className="rounded-xl" />
              <div className="min-w-0 flex-1"><Link href={`/business/${b.slug}`} className="font-medium">{b.name}</Link><p className="text-[12px] text-muted">Por {name.get(b.owner_id)}{b.hidden_at ? ' · oculta' : ''}</p></div>
              <FeatureToggle id={b.id} featured={b.featured} />
              <HideToggle type="business" id={b.id} hidden={!!b.hidden_at} />
            </li>
          ))}
          {!list.length && <li className="py-4 text-[14px] text-muted">Nenhuma empresa cadastrada.</li>}
        </ul>
      </Panel>
    </>
  );
}
