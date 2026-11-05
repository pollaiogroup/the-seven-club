import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { rpc } from '@/lib/db';
import { shortDate } from '@/lib/format';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { MemberEditor } from '@/components/admin/forms';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/field';

export const metadata = { title: 'Integrantes' };
type M = { id: string; role: string; status: string; created_at: string; email: string; handle: string; full_name: string; avatar_path: string | null; membership: { id: string; plan: string; status: string; starts_at: string; ends_at: string | null } | null };

export default async function Members({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const me = await requireStaff('admin');
  const list = await rpc<M[]>('admin_members', { p_q: q || null, p_limit: 200 });
  return (
    <>
      <AdminTitle title="Integrantes e assinaturas" subtitle="Papel, acesso e assinatura de cada integrante. Mudanças ficam registradas na auditoria." />
      <form className="mb-4 max-w-md"><Input name="q" defaultValue={q} type="search" placeholder="Buscar por nome, @ ou e-mail" /></form>
      <Panel>
        <ul className="divide-y divide-line">
          {list.map((m) => (
            <li key={m.id} className="py-4">
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={m.full_name} path={m.avatar_path} size={40} />
                <div className="min-w-0 flex-1 leading-tight">
                  <Link href={`/integrantes/${m.handle}`} className="font-semibold">{m.full_name}</Link>
                  <p className="truncate text-[12px] text-muted">@{m.handle} · {m.email} · desde {shortDate(m.created_at)}</p>
                </div>
                {m.status === 'suspended' && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[12px] font-semibold text-danger">Suspensa</span>}
              </div>
              <MemberEditor m={m} superAdmin={me.role === 'super_admin'} isMe={m.id === me.id} />
            </li>
          ))}
          {!list.length && <li className="py-4 text-[14px] text-muted">Nenhuma integrante encontrada.</li>}
        </ul>
      </Panel>
    </>
  );
}
