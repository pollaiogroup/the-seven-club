import { notFound } from 'next/navigation';
import { addDays, clubToday, longDay, PLANNER_PILLARS } from '@/lib/planner';
import { itemsBetween, plannerPage } from '@/lib/planner-server';
import { SevenStar } from '@/components/ui/icons';
import { ItemMini } from '@/components/planner/item-mini';
import { InkPage } from '@/components/planner/ink-page';

export async function generateMetadata({ params }: { params: Promise<{ pilar: string }> }) {
  const { pilar } = await params;
  return { title: PLANNER_PILLARS.find((x) => x.slug === pilar)?.name ?? 'Planner' };
}

/** Divisória de um pilar: as linhas marcadas com ele nos últimos 60 dias e uma página de notas. */
export default async function PlannerPillar({ params }: { params: Promise<{ pilar: string }> }) {
  const { pilar } = await params;
  const p = PLANNER_PILLARS.find((x) => x.slug === pilar);
  if (!p) notFound();
  const today = clubToday();
  const [items, page] = await Promise.all([itemsBetween(addDays(today, -60), addDays(today, 30), { pillar: p.id }), plannerPage(`notas:${p.slug}`)]);
  const days = [...new Set(items.map((i) => i.day))].sort().reverse();
  const done = items.filter((i) => i.status === 'done').length;

  return (
    <div className="rounded-[24px] bg-paper p-4 shadow-card ring-1 ring-line sm:p-6 md:rounded-r-[6px] md:p-7">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ background: p.color, color: p.on }}><SevenStar className="h-6 w-6" /></span>
        <div>
          <p className="text-[10px] font-bold tracking-[.26em] text-burgundy uppercase">Pilar</p>
          <h1 className="text-[32px] leading-none tracking-[.04em] text-burgundy">{p.name}</h1>
        </div>
      </div>
      <p className="mt-3 font-display text-[17px] text-burgundy italic">{p.desc}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section>
          <h2 className="text-[12px] font-bold tracking-[.16em] text-muted uppercase">Linhas deste pilar <span className="text-burgundy">· {done} {done === 1 ? 'feita' : 'feitas'}</span></h2>
          {!days.length && <p className="mt-3 rounded-2xl bg-ivory px-4 py-4 text-[14px] text-muted">Quando você marcar {p.name} em uma linha do dia, ela aparece aqui.</p>}
          <div className="mt-3 space-y-4">
            {days.slice(0, 30).map((d) => (
              <div key={d}>
                <p className="text-[12px] font-semibold text-burgundy">{longDay(d)}</p>
                <ul className="mt-1">{items.filter((i) => i.day === d).map((i) => <ItemMini key={i.id} item={i} />)}</ul>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-[12px] font-bold tracking-[.16em] text-muted uppercase">Notas de {p.name}</h2>
          <div className="mt-3"><InkPage pageKey={`notas:${p.slug}`} initial={page} ratio={1.35} label={`Notas de ${p.name}`} placeholder="Ideias, metas, aprendizados…" /></div>
        </section>
      </div>
    </div>
  );
}
