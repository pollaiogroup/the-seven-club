import Link from 'next/link';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, clubToday, monthEnd, monthGrid, monthLabel, monthStart, WD_SHORT } from '@/lib/planner';
import { eventsBetween, itemsBetween, pickDay } from '@/lib/planner-server';
import { SevenStar } from '@/components/ui/icons';
import { ViewSwitch } from '@/components/planner/view-switch';

export const metadata = { title: 'Meu mês' };

export default async function PlannerMonth({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const day = pickDay((await searchParams).dia);
  const today = clubToday();
  const cells = monthGrid(day);
  const [items, events] = await Promise.all([itemsBetween(cells[0]!.day, cells.at(-1)!.day), eventsBetween(monthStart(day), monthEnd(day))]);
  const last = Number(monthEnd(day).slice(8, 10));

  return (
    <div className="rounded-[24px] bg-paper p-4 shadow-card ring-1 ring-line sm:p-6 md:rounded-r-[6px] md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewSwitch view="mes" day={day} />
        <div className="flex items-center gap-1">
          <Link href={`/planner/mes?dia=${addMonths(day, -1)}`} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-burgundy/5"><ChevronLeft className="h-5 w-5" /></Link>
          <Link href={`/planner/mes?dia=${addMonths(day, 1)}`} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-burgundy/5"><ChevronRight className="h-5 w-5" /></Link>
        </div>
      </div>
      <p className="mt-5 flex items-center gap-1.5 text-[10px] font-bold tracking-[.26em] text-burgundy uppercase"><SevenStar className="h-2.5 w-2.5" />Meu mês</p>
      <h1 className="mt-1 text-[30px] leading-tight text-burgundy capitalize">{monthLabel(day)} <span className="text-[18px] text-dusty">{day.slice(0, 4)}</span></h1>

      <div className="mt-5 grid grid-cols-7 overflow-hidden rounded-2xl ring-1 ring-line">
        {WD_SHORT.map((w, i) => <div key={i} className="border-b border-line bg-ivory py-2 text-center text-[10px] font-bold tracking-[.12em] text-muted">{['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'][i]}</div>)}
        {cells.map(({ day: d, inMonth }, i) => {
          const list = items.filter((it) => it.day === d);
          const done = list.filter((it) => it.status === 'done').length;
          const open = list.filter((it) => it.status === 'open').length;
          const ev = events.filter((e) => e.day === d);
          const n = Number(d.slice(8, 10));
          const band = inMonth && n >= last - 13 && n <= last - 7 ? 'bg-[#F3EAE6]' : inMonth && n >= last - 6 ? 'bg-[#EFEEE6]' : '';
          return (
            <Link key={d} href={`/planner?dia=${d}`} className={clsx('relative min-h-[84px] border-line p-1.5 transition hover:bg-ivory sm:min-h-[104px] sm:p-2', i % 7 !== 6 && 'border-r', i < cells.length - 7 && 'border-b', !inMonth && 'bg-[#FBF8F2] text-line', band)}>
              <span className={clsx('inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] tabular-nums', d === today && 'bg-burgundy font-bold text-ivory')}>{n}</span>
              {inMonth && (
                <div className="mt-1 space-y-1">
                  {ev.slice(0, 2).map((e) => <p key={e.id} className="truncate rounded-md bg-burgundy px-1.5 py-0.5 text-[10px] font-semibold text-ivory">{e.title}</p>)}
                  {list.length > 0 && <p className="text-[11px] text-muted"><b className="text-burgundy">{done}</b>/{list.length} feitas{open ? ` · ${open} em aberto` : ''}</p>}
                </div>
              )}
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5"><i className="h-3 w-4 rounded-sm bg-[#F3EAE6] ring-1 ring-line" />Votação do próximo livro</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-4 rounded-sm bg-[#EFEEE6] ring-1 ring-line" />Cupons do Clube do Livro</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-4 rounded-sm bg-burgundy" />Encontro do clube</span>
      </div>
    </div>
  );
}
