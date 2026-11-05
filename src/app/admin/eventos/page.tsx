import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { eventWhen } from '@/lib/format';
import { EVENT_KINDS } from '@/lib/labels';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { EventForm } from '@/components/admin/forms';

export const metadata = { title: 'Eventos' };

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const me = await requireStaff('admin');
  const supabase = await createClient();
  const { data: events } = await supabase.from('events').select('*').order('starts_at', { ascending: false }).limit(100);
  const { data: regs } = await supabase.from('event_registrations').select('event_id, status').neq('status', 'cancelled');
  const count = (id: string) => (regs || []).filter((r: { event_id: string }) => r.event_id === id).length;
  const editing = (events || []).find((e: { id: string }) => e.id === editar);
  return (
    <>
      <AdminTitle title="Eventos" subtitle="Agenda e experiências do clube" />
      <Panel title={editing ? 'Editar evento' : 'Novo evento'}><EventForm key={editing?.id || 'new'} e={editing} userId={me.id} /></Panel>
      <Panel title="Eventos" className="mt-4">
        <ul className="divide-y divide-line">
          {(events || []).map((e: { id: string; title: string; kind: string; starts_at: string; ends_at: string | null; published: boolean; capacity: number | null }) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.title} {!e.published && <span className="ml-1 rounded-full bg-line px-2 py-0.5 text-[11px]">rascunho</span>}</p>
                <p className="text-[12px] text-muted">{EVENT_KINDS[e.kind]} · {eventWhen(e.starts_at, e.ends_at)} · {count(e.id)}{e.capacity ? `/${e.capacity}` : ''} inscritas</p>
              </div>
              <a href={`/admin/eventos?editar=${e.id}`} className="text-[13px] font-semibold text-burgundy">Editar</a>
              <a href={`/agenda/${e.id}`} className="text-[13px] text-muted">Ver</a>
            </li>
          ))}
          {!events?.length && <li className="py-4 text-[14px] text-muted">Nenhum evento criado.</li>}
        </ul>
      </Panel>
    </>
  );
}
