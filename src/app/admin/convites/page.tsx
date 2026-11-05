import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/env';
import { ROLES } from '@/lib/labels';
import { shortDate } from '@/lib/format';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { InviteActions, InviteForm } from '@/components/admin/forms';
import { inviteMessage } from '@/lib/invite';

export const metadata = { title: 'Convites' };
type Inv = { id: string; email: string; token: string; role: string; plan: string; note: string | null; created_at: string; expires_at: string; revoked_at: string | null; accepted_at: string | null };

export default async function Invites() {
  const me = await requireStaff('admin');
  const supabase = await createClient();
  const { data } = await supabase.from('invitations').select('id, email, token, role, plan, note, created_at, expires_at, revoked_at, accepted_at').order('created_at', { ascending: false }).limit(200);
  const now = Date.now();
  const status = (i: Inv) => i.accepted_at ? ['Aceito', 'text-olive-ink'] : i.revoked_at ? ['Revogado', 'text-muted'] : new Date(i.expires_at).getTime() < now ? ['Expirado', 'text-muted'] : ['Pendente', 'text-burgundy'];
  return (
    <>
      <AdminTitle title="Convites" subtitle="O clube é fechado: cada integrante entra por um link de convite pessoal." />
      <Panel title="Novo convite"><InviteForm superAdmin={me.role === 'super_admin'} /></Panel>
      <Panel title="Convites enviados" className="mt-4">
        <ul className="divide-y divide-line">
          {((data || []) as Inv[]).map((i) => {
            const [label, cls] = status(i);
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{i.email}</p>
                  <p className="text-[12px] text-muted">{ROLES[i.role]} · {i.plan} · criado em {shortDate(i.created_at)}{i.note ? ` · ${i.note}` : ''}</p>
                </div>
                <span className={`text-[13px] font-semibold ${cls}`}>{label}</span>
                <InviteActions id={i.id} link={`${SITE_URL}/convite/${i.token}`} active={label === 'Pendente'} message={inviteMessage(`${SITE_URL}/convite/${i.token}`, `${SITE_URL}/instalar`, shortDate(i.expires_at))} />
              </li>
            );
          })}
          {!data?.length && <li className="py-4 text-[14px] text-muted">Nenhum convite ainda.</li>}
        </ul>
      </Panel>
    </>
  );
}
