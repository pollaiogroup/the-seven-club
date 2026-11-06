import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { rpc } from '@/lib/db';
import { clubDayOf, clubTimeOf, clubToday, isISODate, ITEM_COLUMNS, monthEnd, monthStart, type PlannerItem } from '@/lib/planner';
import type { DayMark } from '@/components/planner/mini-calendar';

export const pickDay = (v: string | string[] | undefined) => (isISODate(v) ? v : clubToday());
const startTs = (d: string) => `${d}T00:00:00-03:00`;
const endTs = (d: string) => `${d}T23:59:59-03:00`;

export async function itemsBetween(from: string, to: string, extra?: { pillar?: number }) {
  const supabase = await createClient();
  let q = supabase.from('planner_items').select(ITEM_COLUMNS).gte('day', from).lte('day', to).order('day').order('position');
  if (extra?.pillar) q = q.eq('pillar_id', extra.pillar);
  const { data, error } = await q;
  if (error) throw new Error(`planner_items: ${error.message}`);
  return (data || []) as PlannerItem[];
}

export async function eventsBetween(from: string, to: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('events').select('id, title, starts_at').eq('published', true)
    .gte('starts_at', startTs(from)).lte('starts_at', endTs(to)).order('starts_at').limit(200);
  return ((data || []) as { id: string; title: string; starts_at: string }[]).map((e) => ({ id: e.id, title: e.title, day: clubDayOf(e.starts_at), time: clubTimeOf(e.starts_at) }));
}

/** Marcas do calendário do canto: linhas em aberto, concluídas e encontros do clube. */
export async function monthMarks(day: string) {
  const from = monthStart(day), to = monthEnd(day);
  const supabase = await createClient();
  const [{ data: rows }, events] = await Promise.all([
    supabase.from('planner_items').select('day, status').gte('day', from).lte('day', to).limit(3000),
    eventsBetween(from, to),
  ]);
  const marks: Record<string, DayMark> = {};
  const m = (d: string) => (marks[d] ??= { open: 0, done: 0, event: false });
  for (const r of (rows || []) as { day: string; status: string }[]) { if (r.status === 'open') m(r.day).open++; if (r.status === 'done') m(r.day).done++; }
  for (const e of events) m(e.day).event = true;
  return { marks, events };
}

/** Afirmação do dia: a de hoje (gerada na hora, se preciso) ou a de um dia que já passou. Dias futuros ficam sem. */
export async function affirmationFor(day: string) {
  const today = clubToday();
  if (day > today) return null;
  if (day === today) { const a = await rpc<{ text: string } | null>('affirmation_today'); return a?.text ?? null; }
  const supabase = await createClient();
  const { data } = await supabase.from('affirmation_schedule').select('affirmation:affirmations(text)').eq('day', day).maybeSingle();
  return (data as { affirmation: { text: string } | null } | null)?.affirmation?.text ?? null;
}

export async function plannerPage(key: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('planner_pages').select('text, ink').eq('key', key).maybeSingle();
  return (data || { text: '', ink: null }) as { text: string; ink: PlannerItem['ink'] };
}
