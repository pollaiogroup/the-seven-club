import Link from 'next/link';
import clsx from 'clsx';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { EventItem } from '@/lib/types';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { EventCard } from '@/components/events/event-card';

export const metadata = { title: 'Agenda' };
const TABS = [{ k: 'upcoming', l: 'Próximos' }, { k: 'mine', l: 'Minhas inscrições' }, { k: 'past', l: 'Anteriores' }];

export default async function Agenda({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba = 'upcoming' } = await searchParams;
  const scope = TABS.some((t) => t.k === aba) ? aba : 'upcoming';
  await requireMember();
  const events = await rpc<EventItem[]>('events_list', { p_scope: scope, p_limit: 50 });
  return (
    <>
      <PageHeader title="Agenda" subtitle="Encontros, workshops e experiências do clube" back="/feed" />
      <Sheet className="pt-5">
        <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4">
          {TABS.map((t) => <Link key={t.k} href={`/agenda?aba=${t.k}`} scroll={false} className={clsx('shrink-0 rounded-full px-4 py-2.5 text-[13px] font-semibold ring-1', scope === t.k ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper ring-line')}>{t.l}</Link>)}
        </nav>
        {events.length === 0 ? (
          <EmptyState title={scope === 'mine' ? 'Você ainda não se inscreveu' : scope === 'past' ? 'Nenhum evento anterior' : 'Nenhum evento marcado'}>
            {scope === 'upcoming' ? 'Quando a administração publicar novos encontros, eles aparecem aqui e você recebe um aviso.' : undefined}
          </EmptyState>
        ) : (
          <div className="space-y-3 px-4 pt-4">{events.map((e) => <EventCard key={e.id} e={e} />)}</div>
        )}
      </Sheet>
    </>
  );
}
