'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowRight, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { browserClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/toaster';
import { SevenStar } from '@/components/ui/icons';
import {
  addDays, dayNum, longDay, PLANNER_PILLARS, REST_PHRASE, weekday, weekOfMonth,
  type PlannerItem, type PlannerPillar, type Stroke,
} from '@/lib/planner';
import { InkCanvas } from './ink-canvas';
import { LINE_UNITS } from './ink';
import { MiniCalendar, type DayMark } from './mini-calendar';
import { usePlanner } from './planner-context';
import { ViewSwitch } from './view-switch';

const ROWS = 18;
const isEmpty = (i: PlannerItem) => !i.text.trim() && !(i.ink?.length) && !i.pillar_id;

export function PillarDot({ p, on, size = 22, onClick }: { p: PlannerPillar; on: boolean; size?: number; onClick?: () => void }) {
  const style = { width: size, height: size, borderColor: p.color, color: on ? p.on : p.color, background: on ? p.color : 'transparent' };
  const cls = clsx('inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] text-[7.5px] font-bold tracking-normal transition', !on && 'opacity-60', onClick && 'hover:opacity-100');
  return onClick
    ? <button type="button" aria-label={p.name} aria-pressed={on} onClick={onClick} className={cls} style={style}>{p.code}</button>
    : <span aria-label={p.name} className={cls} style={style}>{p.code}</span>;
}

function PillarPicker({ value, onPick }: { value: number | null; onPick: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const cur = PLANNER_PILLARS.find((p) => p.id === value);
  return (
    <>
      <div className="hidden gap-1 sm:flex" role="group" aria-label="Pilar">
        {PLANNER_PILLARS.map((p) => <PillarDot key={p.id} p={p} on={p.id === value} onClick={() => onPick(p.id)} />)}
      </div>
      <div className="relative sm:hidden">
        <button type="button" aria-label={cur ? `Pilar: ${cur.name}` : 'Escolher pilar'} aria-expanded={open} onClick={() => setOpen((o) => !o)}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-dashed border-dusty text-[8px] font-bold"
          style={cur ? { background: cur.color, color: cur.on, borderStyle: 'solid', borderColor: cur.color } : undefined}>{cur?.code ?? '+'}</button>
        {open && (
          <div className="absolute right-0 bottom-9 z-20 flex gap-1 rounded-full bg-paper p-1.5 shadow-card ring-1 ring-line">
            {PLANNER_PILLARS.map((p) => <PillarDot key={p.id} p={p} on={p.id === value} size={26} onClick={() => { onPick(p.id); setOpen(false); }} />)}
          </div>
        )}
      </div>
    </>
  );
}

function StatusButtons({ item, onDone, onCancel, onJump }: { item: PlannerItem | null; onDone: () => void; onCancel: () => void; onJump: () => void }) {
  const st = item?.status;
  const has = !!item && !isEmpty(item);
  const b = (on: boolean, tone: string) => clsx('flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border-[1.4px] transition disabled:opacity-30', on ? tone : 'border-line text-[#BFB2A2] hover:border-dusty hover:text-burgundy');
  return (
    <div className="flex shrink-0 gap-1 pb-[6px]">
      <button type="button" aria-label="Feito" title="Feito" aria-pressed={st === 'done'} disabled={!has || st === 'moved'} onClick={onDone} className={b(st === 'done', 'border-burgundy bg-burgundy text-ivory')}><Check className="h-3.5 w-3.5" strokeWidth={3} /></button>
      <button type="button" aria-label="Cancelar" title="Cancelar" aria-pressed={st === 'cancelled'} disabled={!has || st === 'moved'} onClick={onCancel} className={b(st === 'cancelled', 'border-[#E5DBD0] bg-[#E5DBD0] text-muted')}><X className="h-3.5 w-3.5" strokeWidth={3} /></button>
      <button type="button" aria-label={st === 'moved' ? 'Trazer de volta para hoje' : 'Pular para amanhã'} title={st === 'moved' ? 'Trazer de volta' : 'Pular para amanhã'} aria-pressed={st === 'moved'} disabled={!has || st === 'done' || st === 'cancelled'} onClick={onJump} className={b(st === 'moved', 'border-olive bg-olive text-paper')}><ArrowRight className="h-3.5 w-3.5" strokeWidth={3} /></button>
    </div>
  );
}

function Line({ slot, item, onText, onInk, onDone, onCancel, onJump, onPillar }: {
  slot: number; item: PlannerItem | null;
  onText: (v: string) => void; onInk: (next: Stroke[], prev: Stroke[]) => void;
  onDone: () => void; onCancel: () => void; onJump: () => void; onPillar: (id: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const st = item?.status ?? 'open';
  const faded = st === 'done' || st === 'cancelled' || st === 'moved';
  return (
    <div className="flex h-[48px] items-end gap-2.5 border-b border-line sm:gap-3" data-slot={slot}>
      <StatusButtons item={item} onDone={onDone} onCancel={onCancel} onJump={onJump} />
      <div className="relative h-full min-w-0 flex-1">
        <input
          ref={input}
          value={item?.text ?? ''}
          onChange={(e) => onText(e.target.value)}
          maxLength={300}
          aria-label={`Linha ${slot + 1}`}
          className={clsx('absolute inset-x-0 bottom-[3px] w-full bg-transparent pr-2 font-display text-[19px] italic outline-none placeholder:text-line',
            st === 'done' && 'text-[#9C93A6] line-through decoration-burgundy decoration-[1.5px]', st === 'cancelled' && 'text-[#B9AFA4] line-through', st === 'moved' && 'text-olive', st === 'open' && 'text-[#2D2A3E]')}
        />
        <InkCanvas
          className={clsx('absolute inset-0', faded && 'opacity-45')}
          strokes={item?.ink ?? []} onChange={onInk} basis="height" units={LINE_UNITS} penWidth={2.3}
          onTypeTap={() => input.current?.focus()} label={`Escrita à mão da linha ${slot + 1}`}
        />
        {faded && !!item?.ink?.length && (st === 'done' || st === 'cancelled') && (
          // risca só a largura da escrita (as unidades da tinta valem 48/40 px numa linha de 48 px)
          <span aria-hidden className={clsx('pointer-events-none absolute left-0 top-[60%] h-[1.5px] max-w-full', st === 'done' ? 'bg-burgundy/60' : 'bg-muted/40')}
            style={{ width: Math.max(...item.ink.flatMap((k) => k.p.filter((_, i) => i % 3 === 0))) * (48 / LINE_UNITS) + 4 }} />
        )}
      </div>
      {st === 'moved' && <span className="shrink-0 pb-[10px] text-[9.5px] font-bold tracking-[.12em] text-olive">AMANHÃ</span>}
      {st === 'open' && item?.moved_from && <span className="hidden shrink-0 pb-[10px] text-[9.5px] font-bold tracking-[.12em] text-taupe sm:inline">ADIADA</span>}
      <div className="shrink-0 pb-[8px]"><PillarPicker value={item?.pillar_id ?? null} onPick={onPillar} /></div>
    </div>
  );
}

export function DayView({ day, today, initial, affirmation, events, marks }: {
  day: string; today: string; initial: PlannerItem[]; affirmation: string | null;
  events: { id: string; title: string; time: string }[]; marks: Record<string, DayMark>;
}) {
  const { pushUndo } = usePlanner();
  const [items, setItems] = useState<PlannerItem[]>(initial);
  const latest = useRef(items); latest.current = items;
  const saved = useRef(new Set(initial.map((i) => i.id)));
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const saveNow = useCallback(async (id: string) => {
    const t = timers.current.get(id); if (t) { clearTimeout(t); timers.current.delete(id); }
    const it = latest.current.find((i) => i.id === id); if (!it) return;
    const sb = browserClient();
    if (isEmpty(it) && it.status === 'open' && !it.moved_from) {
      if (saved.current.has(id)) { await sb.from('planner_items').delete().eq('id', id); saved.current.delete(id); }
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    const { error } = await sb.from('planner_items').upsert({ id: it.id, day: it.day, position: it.position, text: it.text, ink: it.ink?.length ? it.ink : null, pillar_id: it.pillar_id, status: it.status });
    if (error) { toast('Não foi possível salvar. Confira a conexão.', 'error'); return; }
    saved.current.add(id);
  }, []);
  const schedule = useCallback((id: string, ms: number) => {
    const t = timers.current.get(id); if (t) clearTimeout(t);
    if (ms <= 0) { void saveNow(id); return; }
    timers.current.set(id, setTimeout(() => void saveNow(id), ms));
  }, [saveNow]);

  // salva o que estiver pendente ao sair da página ou do app
  useEffect(() => {
    const flush = () => { for (const id of [...timers.current.keys()]) void saveNow(id); };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush); flush(); };
  }, [saveNow]);

  const byPos = new Map(items.map((i) => [i.position, i]));
  const slots = Math.max(ROWS, (items.length ? Math.max(...items.map((i) => i.position)) : 0) + 3);

  /** Altera a linha do espaço `slot`, criando o registro se ela ainda estava em branco. */
  const edit = (slot: number, patch: Partial<PlannerItem>, ms: number) => {
    let id = latest.current.find((i) => i.position === slot)?.id;
    if (!id) {
      id = crypto.randomUUID();
      const fresh: PlannerItem = { id, day, position: slot, text: '', ink: null, pillar_id: null, status: 'open', moved_to: null, moved_from: null, ...patch };
      setItems((prev) => [...prev, fresh]); latest.current = [...latest.current, fresh];
    } else {
      const target = id;
      setItems((prev) => prev.map((i) => (i.id === target ? { ...i, ...patch } : i)));
      latest.current = latest.current.map((i) => (i.id === target ? { ...i, ...patch } : i));
    }
    schedule(id, ms);
    return id;
  };

  const jump = async (slot: number) => {
    const it = byPos.get(slot); if (!it) return;
    await saveNow(it.id);
    const { data, error } = await browserClient().rpc('planner_jump', { p_item: it.id });
    if (error) { toast('Não foi possível mover a linha.', 'error'); return; }
    const moved = (data as string | null) ?? null;
    setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, status: moved ? 'moved' : 'open', moved_to: moved } : i)));
    toast(moved ? 'Linha passou para amanhã' : 'Linha de volta para hoje');
  };

  const wd = weekday(day);
  const done = new Set(items.filter((i) => i.status === 'done' && i.pillar_id).map((i) => i.pillar_id));

  return (
    <div className="rounded-[24px] bg-paper p-4 shadow-card ring-1 ring-line sm:p-6 md:rounded-r-[6px] md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewSwitch view="dia" day={day} />
        <div className="flex items-center gap-1 text-[13px]">
          <Link href={`/planner?dia=${addDays(day, -1)}`} aria-label="Dia anterior" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-burgundy/5"><ChevronLeft className="h-5 w-5" /></Link>
          {day !== today && <Link href="/planner" className="rounded-full px-3 py-1.5 font-semibold text-burgundy ring-1 ring-line hover:ring-dusty">Hoje</Link>}
          <Link href={`/planner?dia=${addDays(day, 1)}`} aria-label="Próximo dia" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-burgundy/5"><ChevronRight className="h-5 w-5" /></Link>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[.26em] text-burgundy uppercase"><SevenStar className="h-2.5 w-2.5" />{weekOfMonth(day)}ª semana · Meu mês</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="font-display text-[64px] leading-[.8] text-burgundy">{dayNum(day)}</span>
            <h1 className="pb-1 text-[22px] leading-tight text-burgundy sm:text-[24px]">{longDay(day)}</h1>
          </div>
          {affirmation
            ? <p className="mt-4 rounded-xl bg-ivory px-4 py-3 font-display text-[16px] leading-snug text-burgundy italic">“{affirmation}”</p>
            : <p className="mt-4 rounded-xl bg-ivory px-4 py-3 text-[13px] text-muted">A afirmação deste dia aparece na manhã do dia.</p>}
        </div>
        <MiniCalendar day={day} today={today} marks={marks} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {events.length ? events.map((e) => (
            <Link key={e.id} href={`/agenda/${e.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-ivory px-3 py-1.5 text-[12.5px] hover:ring-1 hover:ring-dusty">
              <SevenStar className="h-2.5 w-2.5 text-burgundy" /><b className="text-burgundy">{e.time}</b>{e.title}
            </Link>
          )) : <span className="text-[12.5px] text-muted">Nenhum encontro do clube neste dia.</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-[.16em] text-muted uppercase">Pilares de hoje</span>
          <span className="flex gap-1">{PLANNER_PILLARS.map((p) => <PillarDot key={p.id} p={p} on={done.has(p.id)} size={20} />)}</span>
        </div>
      </div>

      <div className="mt-4 hidden flex-wrap justify-end gap-x-3 gap-y-1 sm:flex">
        {PLANNER_PILLARS.map((p) => <span key={p.id} className="flex items-center gap-1 text-[9.5px] font-bold tracking-[.1em] text-muted"><PillarDot p={p} on={false} size={16} />{p.name}</span>)}
      </div>

      <div className="mt-1">
        {Array.from({ length: slots }, (_, slot) => {
          const it = byPos.get(slot) ?? null;
          return (
            <Line key={`slot-${slot}`} slot={slot} item={it}
              onText={(v) => edit(slot, { text: v }, 700)}
              onInk={(next, prev) => { const id = edit(slot, { ink: next }, 900); pushUndo(() => { setItems((p) => p.map((i) => (i.id === id ? { ...i, ink: prev } : i))); latest.current = latest.current.map((i) => (i.id === id ? { ...i, ink: prev } : i)); schedule(id, 300); }); }}
              onDone={() => it && edit(slot, { status: it.status === 'done' ? 'open' : 'done' }, 0)}
              onCancel={() => it && edit(slot, { status: it.status === 'cancelled' ? 'open' : 'cancelled' }, 0)}
              onJump={() => void jump(slot)}
              onPillar={(id) => edit(slot, { pillar_id: it?.pillar_id === id ? null : id }, 0)}
            />
          );
        })}
      </div>

      {wd === 4 && (
        <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-burgundy px-5 py-4 text-ivory sm:flex-row sm:items-center">
          <SevenStar className="h-6 w-6 shrink-0 text-dusty" />
          <p className="flex-1 font-display text-[16px] leading-snug italic">Fechamento da semana: {REST_PHRASE.charAt(0).toLowerCase() + REST_PHRASE.slice(1)}</p>
          <Link href={`/planner/semana?dia=${day}#fechamento`} className="shrink-0 rounded-full bg-ivory px-4 py-2.5 text-[13px] font-bold text-burgundy">Abrir fechamento</Link>
        </div>
      )}
    </div>
  );
}
