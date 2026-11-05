import { requireStaff } from '@/lib/auth';
import { rpc } from '@/lib/db';
import { AdminTitle, Panel, Stat } from '@/components/admin/ui';
import { buttonClass } from '@/components/ui/button';

export const metadata = { title: 'Indicadores' };

type Stats = {
  members_active: number; members_suspended: number; members_new_30d: number; invites_pending: number; active_7d: number;
  businesses: number; projects: number; posts_7d: number; comments_7d: number; check_ins_7d: number; seven_shares_7d: number;
  reports_open: number; events_upcoming: number; registrations_upcoming: number; affirmations_published: number; affirmations_left_in_cycle: number;
  weeks: { week_start: string; posts: number; members: number; check_ins: number }[];
  pillars_30d: { name: string; count: number }[];
};

function Bars({ data, field, label }: { data: Stats['weeks']; field: 'posts' | 'members' | 'check_ins'; label: string }) {
  const max = Math.max(1, ...data.map((d) => d[field]));
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold">{label}</p>
      <div className="flex h-28 items-end gap-1.5" role="img" aria-label={label}>
        {data.map((d) => (
          <div key={d.week_start} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular-nums text-muted">{d[field] || ''}</span>
            <div className="w-full rounded-t bg-burgundy" style={{ height: `${Math.max(2, (d[field] / max) * 72)}px`, opacity: d[field] ? 1 : 0.15 }} />
            <span className="text-[9px] text-muted">{d.week_start.slice(8)}/{d.week_start.slice(5, 7)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function AdminHome() {
  await requireStaff('moderator');
  const s = await rpc<Stats>('admin_stats');
  const pmax = Math.max(1, ...s.pillars_30d.map((p) => p.count));
  return (
    <>
      <AdminTitle title="Indicadores" subtitle="Uso do clube. Dados do SEVEN aparecem só em totais, nunca por integrante."
        action={<a href="/api/admin/relatorio" download className={buttonClass('secondary', 'sm')}>Baixar relatório (CSV)</a>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Integrantes ativas" value={s.members_active} hint={`${s.members_new_30d} ${s.members_new_30d === 1 ? 'nova' : 'novas'} em 30 dias`} />
        <Stat label="Ativas nos últimos 7 dias" value={s.active_7d} hint={s.members_active ? `${Math.round((s.active_7d / s.members_active) * 100)}% da base` : undefined} />
        <Stat label="Convites pendentes" value={s.invites_pending} />
        <Stat label="Denúncias abertas" value={s.reports_open} />
        <Stat label="Publicações (7 dias)" value={s.posts_7d} hint={`${s.comments_7d} ${s.comments_7d === 1 ? 'comentário' : 'comentários'}`} />
        <Stat label="Check-ins SEVEN (7 dias)" value={s.check_ins_7d} hint={`${s.seven_shares_7d} ${s.seven_shares_7d === 1 ? 'compartilhado' : 'compartilhados'}`} />
        <Stat label="Empresas · Projetos" value={`${s.businesses} · ${s.projects}`} />
        <Stat label="Eventos futuros" value={s.events_upcoming} hint={`${s.registrations_upcoming} ${s.registrations_upcoming === 1 ? 'inscrição' : 'inscrições'}`} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Últimas 8 semanas">
          <div className="space-y-5">
            <Bars data={s.weeks} field="posts" label="Publicações" />
            <Bars data={s.weeks} field="check_ins" label="Check-ins concluídos" />
            <Bars data={s.weeks} field="members" label="Novas integrantes" />
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Pilares mais praticados (30 dias)">
            <ul className="space-y-2">
              {s.pillars_30d.map((p) => (
                <li key={p.name} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 text-[13px]">
                  <span className="font-bold tracking-wide">{p.name}</span>
                  <span className="h-2.5 rounded-full bg-line"><span className="block h-full rounded-full bg-burgundy" style={{ width: `${(p.count / pmax) * 100}%` }} /></span>
                  <span className="text-right tabular-nums">{p.count}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Biblioteca de afirmações">
            <p className="text-[14px]"><strong>{s.affirmations_published}</strong> publicadas · <strong>{s.affirmations_left_in_cycle}</strong> ainda não usadas neste ciclo.</p>
            {s.affirmations_left_in_cycle < 30 && <p className="mt-2 text-[13px] text-danger">Restam poucas inéditas. Adicione novas para evitar repetição em breve.</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
