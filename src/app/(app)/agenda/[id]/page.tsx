import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarPlus, Clock, MapPin, Users, Video } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { EventItem } from '@/lib/types';
import { EVENT_KINDS } from '@/lib/labels';
import { eventWhen } from '@/lib/format';
import { mediaUrl } from '@/lib/media';
import { PageHeader, SectionTitle, Sheet } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Registration } from '@/components/events/registration';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  await requireMember();
  const e = await rpc<EventItem | null>('event_detail', { p_id: id });
  if (!e) notFound();
  const cover = mediaUrl(e.cover_path);
  const past = new Date(e.ends_at || e.starts_at).getTime() < Date.now();
  const active = e.my_status && e.my_status !== 'cancelled';
  return (
    <>
      <PageHeader title={EVENT_KINDS[e.kind] || 'Evento'} back="/agenda" />
      <Sheet>
        {cover && <img src={cover} alt="" className="aspect-[16/9] w-full rounded-t-[28px] object-cover" />}
        <div className="px-5 pt-6">
          {!e.published && <p className="mb-3 inline-block rounded-full bg-danger/10 px-3 py-1 text-[12px] font-semibold text-danger">Rascunho · só a administração vê</p>}
          <h2 className="text-[26px] leading-tight text-burgundy">{e.title}</h2>
          <ul className="mt-4 space-y-2 text-[14px]">
            <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted" /><span>{eventWhen(e.starts_at, e.ends_at)}</span></li>
            <li className="flex items-center gap-2">{e.location ? <MapPin className="h-4 w-4 text-muted" /> : <Video className="h-4 w-4 text-muted" />}
              {e.location ? <a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`}>{e.location}</a> : 'Online'}</li>
            <li className="flex items-center gap-2"><Users className="h-4 w-4 text-muted" />{e.taken} {e.taken === 1 ? 'inscrita' : 'inscritas'}{e.capacity ? ` · ${Math.max(0, e.capacity - e.taken)} vagas restantes` : ''}</li>
          </ul>
          {e.has_online_url && (
            e.online_url ? <a href={e.online_url} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-full bg-olive/15 py-3 text-[14px] font-semibold text-olive-ink"><Video className="h-4 w-4" />Entrar na sala online</a>
              : <p className="mt-4 text-[13px] text-muted">O link da sala aparece aqui depois da inscrição.</p>
          )}
          {e.description && <p className="mt-5 text-[15px] leading-relaxed whitespace-pre-line">{e.description}</p>}
          <div className="mt-6"><Registration e={e} past={past} /></div>
          {active && !past && <a href={`/agenda/${e.id}/ics`} download className="mt-3 flex items-center justify-center gap-2 text-[14px] font-semibold text-burgundy"><CalendarPlus className="h-4 w-4" />Adicionar ao calendário</a>}
        </div>
        {e.attendees && e.attendees.length > 0 && (
          <>
            <SectionTitle>Quem vai</SectionTitle>
            <ul className="grid grid-cols-4 gap-3 px-5 sm:grid-cols-6">
              {e.attendees.map((m) => (
                <li key={m.id}><Link href={`/integrantes/${m.handle}`} className="flex flex-col items-center text-center"><Avatar name={m.full_name} path={m.avatar_path} size={52} /><span className="mt-1 w-full truncate text-[12px]">{m.full_name.split(' ')[0]}</span></Link></li>
              ))}
            </ul>
          </>
        )}
      </Sheet>
    </>
  );
}
