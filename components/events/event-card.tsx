import Link from 'next/link';
import { MapPin, Video } from 'lucide-react';
import type { EventItem } from '@/lib/types';
import { EVENT_KINDS } from '@/lib/labels';
import { mediaUrl } from '@/lib/media';

const TZ = 'America/Sao_Paulo';

export function EventCard({ e }: { e: EventItem }) {
  const d = new Date(e.starts_at);
  const day = d.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: TZ });
  const month = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: TZ }).replace('.', '');
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const cover = mediaUrl(e.cover_path);
  const status = e.my_status && e.my_status !== 'cancelled' ? (e.my_status === 'confirmed' ? 'Presença confirmada' : 'Inscrita') : null;
  return (
    <Link href={`/agenda/${e.id}`} className="flex gap-4 rounded-[var(--radius-card)] bg-paper p-3 ring-1 ring-line transition hover:ring-dusty">
      <div className="relative flex h-20 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl bg-burgundy text-ivory">
        {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" loading="lazy" />}
        <span className="font-display relative text-[26px] leading-none">{day}</span>
        <span className="relative text-[11px] tracking-wider uppercase">{month}</span>
      </div>
      <div className="min-w-0 flex-1 py-0.5 leading-tight">
        <p className="text-[11px] font-semibold tracking-wide text-olive-ink uppercase">{EVENT_KINDS[e.kind]}</p>
        <p className="mt-1 line-clamp-2 text-[15px] font-semibold">{e.title}</p>
        <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-muted">
          {e.location ? <MapPin className="h-3.5 w-3.5 shrink-0" /> : <Video className="h-3.5 w-3.5 shrink-0" />}
          {time} · {e.location || 'Online'}
        </p>
        {status && <p className="mt-1.5 text-[12px] font-semibold text-burgundy">{status}</p>}
      </div>
    </Link>
  );
}
