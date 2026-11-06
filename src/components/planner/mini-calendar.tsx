import Link from 'next/link';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, monthGrid, monthLabel, WD_SHORT } from '@/lib/planner';

export type DayMark = { open: number; done: number; event: boolean };

/** Calendário do canto: dia atual, dias com linhas em aberto, encontros do clube e as semanas de votação e de cupons. */
export function MiniCalendar({ day, today, marks, base = '/planner' }: { day: string; today: string; marks: Record<string, DayMark>; base?: string }) {
  const cells = monthGrid(day);
  const ym = day.slice(0, 7);
  const last = Number(cells.filter((c) => c.inMonth).at(-1)!.day.slice(8, 10));
  const band = (d: string) => { const n = Number(d.slice(8, 10)); return n >= last - 13 && n <= last - 7 ? 'vote' : n >= last - 6 ? 'cup' : ''; };
  return (
    <div className="w-full rounded-2xl bg-ivory p-3 sm:w-[248px]">
      <div className="flex items-center justify-between">
        <Link href={`${base}?dia=${addMonths(day, -1)}`} aria-label="Mês anterior" className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-burgundy/5"><ChevronLeft className="h-4 w-4" /></Link>
        <Link href={`/planner/mes?dia=${day}`} className="font-display text-[15px] text-burgundy capitalize">{monthLabel(day)} <span className="text-[11px] font-sans font-semibold tracking-[.12em] text-muted">{ym.slice(0, 4)}</span></Link>
        <Link href={`${base}?dia=${addMonths(day, 1)}`} aria-label="Próximo mês" className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-burgundy/5"><ChevronRight className="h-4 w-4" /></Link>
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-0.5 text-center text-[11px]">
        {WD_SHORT.map((w, i) => <span key={i} className="pb-0.5 text-[9px] font-bold text-muted">{w}</span>)}
        {cells.map(({ day: d, inMonth }) => {
          const m = marks[d];
          return (
            <Link key={d} href={`${base}?dia=${d}`} aria-label={d} aria-current={d === day ? 'date' : undefined}
              className={clsx('relative flex h-[26px] items-center justify-center rounded-lg tabular-nums transition',
                d === day ? 'bg-burgundy font-bold text-ivory' : !inMonth ? 'text-line' : clsx(band(d) === 'vote' && 'bg-dusty-soft', band(d) === 'cup' && 'bg-[#E3E2D6]', 'hover:ring-1 hover:ring-dusty', d === today && 'font-bold text-burgundy ring-1 ring-burgundy'))}>
              {Number(d.slice(8, 10))}
              {inMonth && (m?.open || m?.event) && (
                <span className="absolute bottom-[2px] flex gap-[2px]">
                  {!!m?.open && <i className={clsx('h-[3px] w-[3px] rounded-full', d === day ? 'bg-dusty' : 'bg-burgundy')} />}
                  {m?.event && <i className={clsx('h-[3px] w-[3px] rounded-full', d === day ? 'bg-ivory' : 'bg-olive')} />}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-muted">
        <span className="flex items-center gap-1"><i className="h-[5px] w-[5px] rounded-full bg-burgundy" />Em aberto</span>
        <span className="flex items-center gap-1"><i className="h-[5px] w-[5px] rounded-full bg-olive" />Clube</span>
        <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm bg-dusty-soft" />Votação</span>
        <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm bg-[#E3E2D6]" />Cupons</span>
      </div>
    </div>
  );
}
