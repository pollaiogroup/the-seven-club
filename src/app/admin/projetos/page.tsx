import Link from 'next/link';
import { Lock } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { rpc } from '@/lib/db';
import { PROJECT_CATEGORIES } from '@/lib/labels';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { HideToggle } from '@/components/admin/forms';

export const metadata = { title: 'Projetos' };
type P = { id: string; slug: string; name: string; category: string; visibility: string; owner_name: string | null; hidden_at: string | null; members: number };

export default async function AdminProjects() {
  await requireStaff('admin');
  const list = await rpc<P[]>('admin_projects');
  return (
    <>
      <AdminTitle title="Projetos" subtitle="Projetos privados aparecem aqui só pelo nome. O conteúdo fica com as participantes; a moderação só o vê quando há denúncia." />
      <Panel>
        <ul className="divide-y divide-line">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                {p.visibility === 'private'
                  ? <p className="flex items-center gap-1.5 font-medium"><Lock className="h-3.5 w-3.5 text-muted" />{p.name}</p>
                  : <Link href={`/projetos/${p.slug}`} className="font-medium">{p.name}</Link>}
                <p className="text-[12px] text-muted">
                  {PROJECT_CATEGORIES[p.category]} · {p.visibility === 'private' ? 'privado' : 'clube'} · {p.owner_name || 'responsável removida'} · {p.members} {p.members === 1 ? 'participante' : 'participantes'}{p.hidden_at ? ' · oculto' : ''}
                </p>
              </div>
              <HideToggle type="project" id={p.id} hidden={!!p.hidden_at} />
            </li>
          ))}
          {!list.length && <li className="py-4 text-[14px] text-muted">Nenhum projeto.</li>}
        </ul>
      </Panel>
    </>
  );
}
