import { cap } from '@/lib/format';
import Link from 'next/link';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Flame, Trophy } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { SevenOverview } from '@/lib/types';
import { PageHeader, SectionTitle, Sheet } from '@/components/ui/page-header';
import { PillarGlyph } from '@/components/seven/pillar-glyph';

export const metadata = { title: 'Minha evolução' };
const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

export default async function Evolution({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  await requireMember();
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : null;
  const o = await rpc<SevenOverview>('seven_overview', { p_month: month });
  const [y, m] = o.month.split('-').map(Number) as [number, number];
  const shift = (d: number) => { const dt = new Date(Date.UTC(y, m - 1 + d, 1)); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`; };
  const label = cap(new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const maxWeek = Math.max(7, ...o.weeks.map((w) => w.done));
  const activeDays = o.calendar.filter((d) => d.done > 0).length;
  const isCurrent = o.month.slice(0, 7) === o.today.slice(0, 7);

  return (
    <>
      <PageHeader title="Minha evolução" subtitle="Só você vê estes números" back="/seven" />
      <Sheet className="px-4 pt-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { i: <Flame className="mx-auto h-5 w-5 text-grioh" />, n: o.streak, l: 'dias seguidos' },
            { i: <Trophy className="mx-auto h-5 w-5 text-olive-ink" />, n: o.best_streak, l: 'melhor sequência' },
            { i: <span className="mx-auto block h-5 text-[13px] font-bold text-burgundy">{label.split(' ')[0]?.slice(0, 3)}</span>, n: activeDays, l: 'dias ativos no mês' },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-paper px-2 py-4 ring-1 ring-line">{s.i}<p className="font-display mt-1 text-[26px]">{s.n}</p><p className="text-[11px] leading-tight text-muted">{s.l}</p></div>
          ))}
        </div>

        <div className="mt-6 rounded-[var(--radius-card)] bg-paper p-4 ring-1 ring-line">
          <div className="mb-3 flex items-center justify-between">
            <Link href={`/seven/evolucao?mes=${shift(-1)}`} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-burgundy/5"><ChevronLeft className="h-5 w-5" /></Link>
            <p className="font-display text-[17px] text-burgundy">{label}</p>
            {isCurrent ? <span className="w-9" /> : <Link href={`/seven/evolucao?mes=${shift(1)}`} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-burgundy/5"><ChevronRight className="h-5 w-5" /></Link>}
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted">
            {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
            {Array.from({ length: firstDow }).map((_, i) => <span key={`e${i}`} />)}
            {o.calendar.map((d) => {
              const future = d.day > o.today;
              return (
                <span key={d.day} title={`${d.done} de 7`} className={clsx('flex aspect-square items-center justify-center rounded-full text-[12px]',
                  future ? 'text-line' : d.done === 0 ? 'text-muted' : d.done < 4 ? 'bg-dusty-soft text-burgundy' : d.done < 7 ? 'bg-dusty text-burgundy' : 'bg-burgundy text-ivory',
                  d.day === o.today && 'ring-2 ring-burgundy ring-offset-1')}>
                  {Number(d.day.slice(8))}
                </span>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted">Mais escuro = mais pilares concluídos no dia</p>
        </div>

        <SectionTitle>Últimas 8 semanas</SectionTitle>
        <div className="flex h-36 items-end gap-2 rounded-[var(--radius-card)] bg-paper px-4 pt-4 pb-2 ring-1 ring-line" role="img" aria-label="Atividades concluídas por semana">
          {o.weeks.map((w) => (
            <div key={w.week_start} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[11px] tabular-nums text-muted">{w.done || ''}</span>
              <div className="w-full rounded-t-md bg-burgundy" style={{ height: `${Math.max(2, (w.done / maxWeek) * 80)}px`, opacity: w.done ? 1 : 0.15 }} />
              <span className="text-[10px] text-muted">{w.week_start.slice(8)}/{w.week_start.slice(5, 7)}</span>
            </div>
          ))}
        </div>

        <SectionTitle>Por pilar</SectionTitle>
        <ul className="divide-y divide-line rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
          <li className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-[11px] font-semibold text-muted"><span>Pilar</span><span className="w-12 text-right">7 dias</span><span className="w-12 text-right">Mês</span><span className="w-12 text-right">Total</span></li>
          {o.pillars.map((p) => (
            <li key={p.slug} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3">
              <Link href={`/seven/historico?pilar=${p.slug}`} className="flex items-center gap-2 text-[13px] font-bold tracking-wide"><PillarGlyph slug={p.slug} className="h-4 w-4 text-burgundy" />{p.name}</Link>
              <span className="w-12 text-right tabular-nums">{p.week}</span>
              <span className="w-12 text-right tabular-nums">{p.month}</span>
              <span className="w-12 text-right tabular-nums text-muted">{p.total}</span>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
