const TZ = 'America/Sao_Paulo';

/** Maiúscula só na primeira letra ("sex., 06 de nov." -> "Sex., 06 de nov."). */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: TZ });
}

export function postStamp(iso: string) {
  const d = new Date(iso);
  const today = new Date().toLocaleDateString('pt-BR', { timeZone: TZ });
  const day = d.toLocaleDateString('pt-BR', { timeZone: TZ });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  if (day === today) return `Hoje, ${time}`;
  const y = new Date(Date.now() - 86400000).toLocaleDateString('pt-BR', { timeZone: TZ });
  if (day === y) return `Ontem, ${time}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: TZ })}, ${time}`;
}

export function longDate(isoOrDate: string) {
  const d = isoOrDate.length === 10 ? new Date(`${isoOrDate}T12:00:00-03:00`) : new Date(isoOrDate);
  return cap(d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: TZ }));
}

export function shortDate(isoOrDate: string) {
  const d = isoOrDate.length === 10 ? new Date(`${isoOrDate}T12:00:00-03:00`) : new Date(isoOrDate);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: TZ });
}

export function eventWhen(starts: string, ends?: string | null) {
  const s = new Date(starts);
  const date = s.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: TZ });
  const t1 = s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const t2 = ends ? new Date(ends).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : null;
  return `${cap(date)} · ${t1}${t2 ? `–${t2}` : ''}`;
}

export function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', timeZone: TZ });
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

export function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/** datetime-local (horário de Brasília) -> ISO */
export function fromLocalInput(v: string) {
  if (!v) return null;
  return new Date(`${v}:00-03:00`).toISOString();
}
export function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "2026-11-01" -> "novembro" (data sem fuso, só ano-mês-dia). */
export function monthName(isoDate: string) {
  return MONTHS.at(Number(isoDate.slice(5, 7)) - 1) || '';
}
/** "2026-11-23" -> "23/11" */
export function dayMonth(isoDate: string) {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}
