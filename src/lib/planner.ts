// THE SEVEN CLUB PLANNER: tipos e datas compartilhados entre servidor e cliente.

export const PLANNER_PILLARS = [
  { id: 1, slug: 'body', name: 'BODY', code: 'BO', color: '#C9AFA8', on: '#450B18', desc: 'Saúde, movimento, beleza, nutrição e autocuidado.' },
  { id: 2, slug: 'mind', name: 'MIND', code: 'MI', color: '#85866A', on: '#FFFDF8', desc: 'Conhecimento, criatividade e repertório.' },
  { id: 3, slug: 'leadership', name: 'LEADERSHIP', code: 'LE', color: '#9A8B78', on: '#FFFDF8', desc: 'Liderança, comunicação, confiança e influência.' },
  { id: 4, slug: 'business', name: 'BUSINESS', code: 'BU', color: '#25251F', on: '#F4EBDD', desc: 'Negócios, carreira, projetos e realização.' },
  { id: 5, slug: 'wealth', name: 'WEALTH', code: 'WE', color: '#5B1626', on: '#F4EBDD', desc: 'Finanças, investimentos e prosperidade.' },
  { id: 6, slug: 'connection', name: 'CONNECTION', code: 'CO', color: '#CDAFA6', on: '#450B18', desc: 'Relacionamentos, amizades e networking.' },
  { id: 7, slug: 'lifestyle', name: 'LIFESTYLE', code: 'LI', color: '#A7A68C', on: '#25251F', desc: 'Cultura, viagens, experiências e qualidade de vida.' },
] as const;
export type PlannerPillar = (typeof PLANNER_PILLARS)[number];
export const pillarById = (id: number | null | undefined) => PLANNER_PILLARS.find((p) => p.id === id);

/** As divisórias do fichário, na ordem e nas cores do papel. */
export const PLANNER_TABS = [
  { href: '/planner', label: 'MEU MÊS', bg: '#450B18', fg: '#F4EBDD', match: ['/planner', '/planner/semana', '/planner/mes'] },
  ...PLANNER_PILLARS.map((p) => ({ href: `/planner/${p.slug}`, label: p.name, bg: p.slug === 'connection' ? '#E3CFC6' : p.color, fg: p.on, match: [`/planner/${p.slug}`] })),
  { href: '/planner/estante', label: 'ESTANTE', bg: '#7A1E30', fg: '#F4EBDD', match: ['/planner/estante'] },
];

/** Traço da caneta: cor, espessura e pontos [x, y, pressão, x, y, pressão…] em unidades da altura da linha. */
export type Stroke = { c: string; w: number; p: number[] };
export type PlannerStatus = 'open' | 'done' | 'cancelled' | 'moved';
export type PlannerItem = {
  id: string; day: string; position: number; text: string; ink: Stroke[] | null;
  pillar_id: number | null; status: PlannerStatus; moved_to: string | null; moved_from: string | null;
};
export const ITEM_COLUMNS = 'id, day, position, text, ink, pillar_id, status, moved_to, moved_from';

export const REST_PHRASE = 'Descansar também faz parte do plano. Recarregue no fim de semana para começar a próxima com o dobro de energia.';

// ---------------------------------------------------------------- datas (sempre no fuso do clube)
export const WEEKDAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
export const WD_SHORT = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const clubToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y!, m! - 1, d!)); };
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export const isISODate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parse(v).getTime());
export const addDays = (iso: string, n: number) => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
/** 0 = segunda … 6 = domingo */
export const weekday = (iso: string) => (parse(iso).getUTCDay() + 6) % 7;
export const mondayOf = (iso: string) => addDays(iso, -weekday(iso));
export const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
export const monthEnd = (iso: string) => { const d = parse(monthStart(iso)); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return fmt(d); };
export const addMonths = (iso: string, n: number) => { const d = parse(monthStart(iso)); d.setUTCMonth(d.getUTCMonth() + n); return fmt(d); };
export const dayNum = (iso: string) => Number(iso.slice(8, 10));
export const monthLabel = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1]!;
export const longDay = (iso: string) => `${WEEKDAYS[weekday(iso)]}, ${dayNum(iso)} de ${monthLabel(iso)}`;
export const shortDay = (iso: string) => `${dayNum(iso)}/${iso.slice(5, 7)}`;
/** Semana do mês (1ª, 2ª…), contando a semana do dia 1 como a primeira. */
export const weekOfMonth = (iso: string) => Math.floor((dayNum(iso) - 1 + weekday(monthStart(iso))) / 7) + 1;
/** Grade do calendário (segunda a domingo), com os dias de fora do mês. */
export function monthGrid(iso: string) {
  const first = monthStart(iso), last = monthEnd(iso);
  const start = mondayOf(first); const cells: { day: string; inMonth: boolean }[] = [];
  for (let d = start; d <= last || weekday(d) !== 0; d = addDays(d, 1)) cells.push({ day: d, inMonth: d >= first && d <= last });
  return cells;
}
/** Dia (AAAA-MM-DD) de um horário, no fuso do clube. */
export const clubDayOf = (ts: string) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
export const clubTimeOf = (ts: string) => new Date(ts).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).replace(':00', 'h').replace(':', 'h');
