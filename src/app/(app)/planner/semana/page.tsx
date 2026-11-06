import Link from 'next/link';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, clubToday, dayNum, mondayOf, monthLabel, PLANNER_PILLARS, REST_PHRASE, WEEKDAYS } from '@/lib/planner';
import { eventsBetween, itemsBetween, pickDay, plannerPage } from '@/lib/planner-server';
import { SevenStar } from '@/components/ui/icons';
import { ViewSwitch } from '@/components/planner/view-switch';
import { ItemMini } from '@/components/planner/item-mini';
import { InkPage } from '@/components/planner/ink-page';

export const metadata = { title: 'Minha semana' };

const range = (a: string, b: string) => `${dayNum(a)} ${monthLabel(a).slice(0, 3)} a ${dayNum(b)} ${monthLabel(b).slice(0, 3)}`;

export default async function PlannerWeek({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const day = pickDay((await searchParams).dia);
  const mon = mondayOf(day), sun = addDays(mon, 6), today = clubToday();
  const [items, events, page] = await Promise.all([itemsBetween(mon, sun), eventsBetween(mon, sun), plannerPage(`semana:${mon}`)]);
  const count = (s: string) => items.filter((i) => i.status === s).length;
  const byPillar = PLANNER_PILLARS.map((p) => ({ p, n: items.filter((i) => i.status === 'done' && i.pillar_id === p.id).length }));
  const max = Math.max(1, ...byPillar.map((b) => b.n));
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));

  return (
    <div className="rounded-[24px] bg-paper p-4 shadow-card ring-1 ring-line sm:p-6 md:rounded-r-[6px] md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewSwitch view="semana" day={day} />
        <div className="flex items-center gap-1">
          <Link href={`/planner/semana?dia=${addDays(mon, -7)}`} aria-label="Semana anterior" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-burgundy/5"><ChevronLeft className="h-5 w-5" /></Link>
          <Link href={`/planner/semana?dia=${addDays(mon, 7)}`} aria-label="Próxima semana" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-burgundy/5"><ChevronRight className="h-5 w-5" /></Link>
        </div>
      </div>
      <p className="mt-5 flex items-center gap-1.5 text-[10px] font-bold tracking-[.26em] text-burgundy uppercase"><SevenStar className="h-2.5 w-2.5" />Minha semana</p>
      <h1 className="mt-1 text-[28px] leading-tight text-burgundy">{range(mon, sun)}</h1>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['Feitas', count('done'), 'text-burgundy'], ['Canceladas', count('cancelled'), 'text-taupe'], ['Adiadas', count('moved'), 'text-olive'], ['Em aberto', count('open'), 'text-espresso']].map(([l, n, c]) => (
          <div key={l as string} className="rounded-2xl bg-ivory px-4 py-3"><p className={clsx('font-display text-[28px] leading-none', c as string)}>{n}</p><p className="mt-1 text-[12px] text-muted">{l}</p></div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((d, i) => {
          const list = items.filter((it) => it.day === d);
          const ev = events.filter((e) => e.day === d);
          return (
            <Link key={d} href={`/planner?dia=${d}`} className={clsx('block rounded-2xl p-3.5 ring-1 transition hover:ring-dusty', d === today ? 'bg-ivory ring-burgundy/40' : 'ring-line')}>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[17px] text-burgundy">{WEEKDAYS[i]!.replace('-feira', '')} <span className="text-muted">{dayNum(d)}</span></span>
                {i === 4 && <span className="text-[9.5px] font-bold tracking-[.14em] text-olive">FECHAMENTO</span>}
              </div>
              {ev.map((e) => <p key={e.id} className="mt-1 truncate text-[12px] text-muted"><b className="text-burgundy">{e.time}</b> {e.title}</p>)}
              <ul className="mt-1.5">{list.slice(0, 8).map((it) => <ItemMini key={it.id} item={it} />)}</ul>
              {list.length > 8 && <p className="mt-1 text-[12px] text-muted">+ {list.length - 8} linhas</p>}
              {!list.length && <p className="mt-2 text-[12.5px] text-muted">Nada escrito neste dia.</p>}
            </Link>
          );
        })}
      </div>

      <section id="fechamento" className="mt-8 scroll-mt-6">
        <div className="flex flex-col gap-3 rounded-2xl bg-burgundy px-5 py-5 text-ivory">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[.26em] text-dusty uppercase"><SevenStar className="h-2.5 w-2.5" />Fechamento da semana</p>
          <p className="font-display text-[20px] leading-snug italic">{REST_PHRASE}</p>
        </div>
        <div className="mt-4">
          <p className="text-[12px] font-bold tracking-[.16em] text-muted uppercase">Pilares que você moveu nesta semana</p>
          <div className="mt-3 space-y-2">
            {byPillar.map(({ p, n }) => (
              <div key={p.id} className="flex items-center gap-3 text-[12px]">
                <span className="w-[92px] shrink-0 font-bold tracking-[.1em] text-espresso">{p.name}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ivory"><span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: p.color }} /></span>
                <span className="w-6 text-right tabular-nums text-muted">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-[12px] font-bold tracking-[.16em] text-muted uppercase">Minha vitória da semana · O que eu aprendi · Sou grata por</p>
        <div className="mt-2"><InkPage pageKey={`semana:${mon}`} initial={page} ratio={0.75} label="Fechamento da semana" placeholder="Escreva aqui, à mão ou digitando." /></div>
      </section>
    </div>
  );
}
