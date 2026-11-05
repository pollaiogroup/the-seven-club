import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { cap, dayMonth, eventWhen, monthName } from '@/lib/format';
import type { Book } from '@/lib/types';
import { AdminTitle, Panel } from '@/components/admin/ui';
import { BookCover } from '@/components/books/book-cover';
import { ClubBookForm, CouponForm, DeleteCouponButton, MonthForm, PollAdminActions, PollForm } from '@/components/admin/book-forms';

export const metadata = { title: 'Clube do Livro' };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthLabel = (m: string) => `${cap(monthName(m))} de ${m.slice(0, 4)}`;

type MonthRow = { id: string; month: string; book_id: string; note: string | null; meeting_event_id: string | null; announced_at: string | null; book: Book };
type PollRow = { id: string; target_month: string; opens_on: string; closes_on: string; winner_book_id: string | null; closed_at: string | null; options: { position: number; book: Book }[] };
type CouponRow = { id: string; store: string; code: string; starts_on: string; valid_until: string | null; notified_at: string | null; book: Book };

export default async function AdminBookClub() {
  const me = await requireStaff('admin');
  const supabase = await createClient();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [y, m] = today.split('-').map(Number);
  const thisMonth = `${y}-${String(m).padStart(2, '0')}`;
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  // penúltima semana: termina 7 dias antes do último dia do mês; cupons na última semana
  const last = new Date(Date.UTC(y, m, 0));
  const closes = new Date(last); closes.setUTCDate(last.getUTCDate() - 7);
  const opens = new Date(closes); opens.setUTCDate(closes.getUTCDate() - 6);
  const couponStart = new Date(closes); couponStart.setUTCDate(closes.getUTCDate() + 1);

  const [{ data: books }, { data: months }, { data: polls }, { data: coupons }, { data: events }, { data: biz }] = await Promise.all([
    supabase.from('books').select('id, title, author, cover_path').eq('club', true).order('created_at', { ascending: false }).limit(200),
    supabase.from('book_months').select('id, month, book_id, note, meeting_event_id, announced_at, book:books(id, title, author, cover_path)').order('month', { ascending: false }).limit(18),
    supabase.from('book_polls').select('id, target_month, opens_on, closes_on, winner_book_id, closed_at, options:book_poll_options(position, book:books(id, title, author, cover_path))').order('target_month', { ascending: false }).limit(6),
    supabase.from('book_coupons').select('id, store, code, starts_on, valid_until, notified_at, book:books(id, title, author, cover_path)').order('created_at', { ascending: false }).limit(20),
    supabase.from('events').select('id, title, starts_at').gte('starts_at', new Date().toISOString()).order('starts_at').limit(40),
    supabase.from('businesses').select('id, name').is('hidden_at', null).order('name').limit(300),
  ]);
  const catalog = (books || []) as Book[];
  const monthRows = (months || []) as unknown as MonthRow[];
  const pollRows = (polls || []) as unknown as PollRow[];
  const results = new Map<string, { book_id: string; votes: number }[]>();
  await Promise.all(pollRows.map(async (p) => {
    const { data } = await supabase.rpc('book_poll_results', { p_poll: p.id });
    results.set(p.id, (data || []) as { book_id: string; votes: number }[]);
  }));
  const eventOpts = ((events || []) as { id: string; title: string; starts_at: string }[]).map((e) => ({ id: e.id, label: `${e.title} · ${eventWhen(e.starts_at)}` }));
  const hasNext = monthRows.some((r) => r.month.startsWith(nextMonth));
  const hasCurrent = monthRows.some((r) => r.month.startsWith(thisMonth));
  const nextWinner = monthRows.find((r) => r.month.startsWith(nextMonth))?.book_id || '';
  const day = Number(today.slice(8, 10));

  return (
    <>
      <AdminTitle title="Clube do Livro" subtitle="Livro do mês (aviso no dia 1, às 9h), votação na penúltima semana e cupons na última. Quem marca “Vou ler” recebe os avisos do encontro." />

      {!hasNext && day >= 25 && (
        <p className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] font-semibold text-danger">
          O livro de {monthName(`${nextMonth}-01`)} ainda não foi definido. Sem ele, o aviso do dia 1 não sai.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Livro do mês">
          <MonthForm books={catalog} events={eventOpts} defaultMonth={hasCurrent ? nextMonth : thisMonth} />
          <ul className="mt-5 divide-y divide-line">
            {monthRows.map((r) => (
              <li key={r.id} className="py-3">
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <BookCover book={r.book} className="w-10 shrink-0" />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block font-semibold">{monthLabel(r.month)}</span>
                      <span className="block truncate text-[13px] text-muted">{r.book.title}{r.meeting_event_id ? ' · encontro marcado' : ' · sem encontro'}{r.announced_at ? ' · aviso enviado' : ''}</span>
                    </span>
                    <span className="text-[13px] font-semibold text-burgundy">Editar</span>
                  </summary>
                  <div className="mt-4"><MonthForm books={catalog} events={eventOpts} defaultMonth={r.month.slice(0, 7)} current={r} /></div>
                </details>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Votação do próximo livro">
          <PollForm books={catalog} defaults={{ target: nextMonth, opens: iso(opens), closes: iso(closes) }} />
          <ul className="mt-5 space-y-4">
            {pollRows.map((p) => {
              const res = new Map((results.get(p.id) || []).map((r) => [r.book_id, r.votes]));
              const status = today < p.opens_on ? 'Agendada' : today <= p.closes_on ? 'Aberta' : p.winner_book_id ? 'Encerrada' : p.closed_at ? 'Encerrada sem vencedor' : 'Fechando';
              const opts = [...p.options].sort((a, b) => a.position - b.position).map((o) => o.book);
              return (
                <li key={p.id} className="rounded-2xl bg-ivory p-4 ring-1 ring-line">
                  <p className="font-semibold">{monthLabel(p.target_month)} <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-[12px] font-semibold text-muted ring-1 ring-line">{status}</span></p>
                  <p className="text-[13px] text-muted">De {dayMonth(p.opens_on)} a {dayMonth(p.closes_on)}</p>
                  <ul className="mt-3 space-y-2">
                    {opts.map((b) => (
                      <li key={b.id} className="flex items-center gap-3 text-[14px]">
                        <BookCover book={b} className="w-8 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{b.title}{p.winner_book_id === b.id && <span className="ml-2 font-semibold text-burgundy">· escolhido</span>}</span>
                        <span className="tabular-nums text-muted">{res.get(b.id) ?? 0} {(res.get(b.id) ?? 0) === 1 ? 'voto' : 'votos'}</span>
                      </li>
                    ))}
                  </ul>
                  <PollAdminActions pollId={p.id} options={opts} canResolve={!p.winner_book_id && today > p.closes_on} />
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Cupons de desconto">
          <CouponForm books={catalog} businesses={((biz || []) as { id: string; name: string }[]).map((b) => ({ id: b.id, label: b.name }))} defaults={{ book: nextWinner, starts: iso(couponStart) }} />
          <ul className="mt-5 divide-y divide-line">
            {((coupons || []) as unknown as CouponRow[]).map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <BookCover book={c.book} className="w-8 shrink-0" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block font-semibold">{c.store} · <span className="font-mono">{c.code}</span></span>
                  <span className="block truncate text-[13px] text-muted">{c.book.title} · a partir de {dayMonth(c.starts_on)}{c.valid_until ? ` até ${dayMonth(c.valid_until)}` : ''}{c.notified_at ? ' · aviso enviado' : ''}</span>
                </span>
                <DeleteCouponButton id={c.id} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Catálogo de livros do clube">
          <ClubBookForm userId={me.id} />
          <ul className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-6">
            {catalog.map((b) => (
              <li key={b.id}><BookCover book={b} /><p className="mt-1 line-clamp-2 text-[12px] leading-tight">{b.title}</p></li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
