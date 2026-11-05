import Link from 'next/link';
import { BookPlus, CalendarDays, ExternalLink, Store } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import { cap, dayMonth, eventWhen, monthName } from '@/lib/format';
import type { BookClubHome } from '@/lib/types';
import { PageHeader, Sheet, SectionTitle } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { LinkButton } from '@/components/ui/button';
import { BookCover } from '@/components/books/book-cover';
import { CopyCode, PollVote, ReadButton } from '@/components/books/book-actions';

export const metadata = { title: 'Clube do Livro' };

export default async function BookClubPage() {
  await requireMember();
  const h = await rpc<BookClubHome>('book_club_home');
  const cur = h.current;
  const thisMonth = monthName(h.today);

  return (
    <>
      <PageHeader title="Clube do Livro" subtitle={`Livro de ${thisMonth}`} back="/feed" />
      <Sheet>
        {cur ? (
          <section className="px-5 pt-6">
            <div className="flex gap-5">
              <BookCover book={cur.book} className="w-32 shrink-0 sm:w-40" priority />
              <div className="min-w-0 flex-1 pt-1">
                <h2 className="text-[26px] leading-tight text-espresso [text-wrap:balance]">{cur.book.title}</h2>
                {cur.book.author && <p className="mt-1 text-[15px] text-muted">{cur.book.author}</p>}
                <p className="mt-3 text-[13px] text-muted">
                  {cur.readers === 0 ? 'Seja a primeira a entrar no clube deste mês.' : `${cur.readers} ${cur.readers === 1 ? 'integrante vai ler' : 'integrantes vão ler'}`}
                </p>
              </div>
            </div>
            {cur.note && <p className="mt-5 text-[15px] leading-relaxed whitespace-pre-line text-espresso/90">{cur.note}</p>}
            <div className="mt-5"><ReadButton monthId={cur.id} joined={cur.joined} /></div>

            {cur.meeting ? (
              <Link href={`/agenda/${cur.meeting.id}`} className="mt-4 flex items-center gap-3 rounded-2xl bg-olive/12 px-4 py-3 ring-1 ring-olive/25">
                <CalendarDays className="h-5 w-5 shrink-0 text-olive-ink" />
                <span className="min-w-0 flex-1 text-[13px] leading-tight">
                  <span className="block font-semibold text-olive-ink">Encontro sobre o livro</span>
                  <span className="block truncate">{eventWhen(cur.meeting.starts_at)}{cur.meeting.location ? ` · ${cur.meeting.location}` : ''}</span>
                </span>
              </Link>
            ) : (
              <p className="mt-4 rounded-2xl bg-paper px-4 py-3 text-[13px] text-muted ring-1 ring-line">
                A data do encontro ainda vai ser marcada. Quem vai ler recebe o aviso assim que ela sair.
              </p>
            )}
            <p className="mt-4 text-[13px] text-muted">
              Leu hoje? Marque no <Link href="/seven/mind" className="font-semibold text-burgundy">SEVEN, em MIND</Link>, a atividade “Livro do clube”. Publicar continua opcional.
            </p>
          </section>
        ) : (
          <EmptyState title={`O livro de ${thisMonth} ainda não saiu`}>Assim que a curadoria anunciar, todas as integrantes recebem a notificação.</EmptyState>
        )}

        {h.poll && (
          <section aria-labelledby="votacao">
            <SectionTitle><span id="votacao">{h.poll.status === 'open' ? `Vote no livro de ${monthName(h.poll.target_month)}` : `Votação do livro de ${monthName(h.poll.target_month)}`}</span></SectionTitle>
            <div className="px-5">
              {h.poll.status === 'open' ? (
                <>
                  <p className="mb-3 text-[13px] text-muted">Aberta até {dayMonth(h.poll.closes_on)}. Você pode trocar o voto até lá. O placar aparece quando a votação fechar.</p>
                  <PollVote pollId={h.poll.id} options={h.poll.options} myVote={h.poll.my_vote} />
                </>
              ) : (
                <PollResults poll={h.poll} />
              )}
            </div>
          </section>
        )}

        {h.coupons.length > 0 && (
          <section aria-labelledby="cupons">
            <SectionTitle><span id="cupons">Cupons de desconto</span></SectionTitle>
            <ul className="space-y-3 px-5">
              {h.coupons.map((c) => (
                <li key={c.id} className="flex gap-4 rounded-[var(--radius-card)] bg-paper p-4 ring-1 ring-line">
                  <BookCover book={c.book} className="w-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-muted">{c.book.title}</p>
                    <p className="text-[16px] font-semibold">{c.store}</p>
                    {c.details && <p className="mt-0.5 text-[13px]">{c.details}</p>}
                    <div className="mt-3"><CopyCode code={c.code} /></div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                      {c.valid_until && <span className="text-muted">Válido até {dayMonth(c.valid_until)}</span>}
                      {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-burgundy">Comprar <ExternalLink className="h-3.5 w-3.5" /></a>}
                      {c.business && <Link href={`/business/${c.business.slug}`} className="inline-flex items-center gap-1 font-semibold text-burgundy"><Store className="h-3.5 w-3.5" />{c.business.name}</Link>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {h.past.length > 0 && (
          <section aria-labelledby="estante-clube">
            <SectionTitle><span id="estante-clube">Já lemos no clube</span></SectionTitle>
            <ul className="grid grid-cols-3 gap-x-3 gap-y-5 px-5 sm:grid-cols-4">
              {h.past.map((p) => (
                <li key={p.month}>
                  <BookCover book={p.book} />
                  <p className="mt-2 line-clamp-2 text-[13px] leading-tight font-semibold">{p.book.title}</p>
                  <p className="text-[12px] text-muted">{cap(monthName(p.month))} {p.month.slice(0, 4)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="px-5 pt-8 pb-4">
          <LinkButton href="/biblioteca/registrar" variant="secondary" full><BookPlus className="h-4 w-4" />Registrar livro lido na biblioteca</LinkButton>
          <p className="mt-2 text-center text-[12px] text-muted">Vale qualquer livro, inclusive os que você leu antes do clube.</p>
        </div>
      </Sheet>
    </>
  );
}

function PollResults({ poll }: { poll: NonNullable<BookClubHome['poll']> }) {
  const votes = new Map((poll.results || []).map((r) => [r.book_id, r.votes]));
  const total = [...votes.values()].reduce((a, b) => a + b, 0);
  return (
    <>
      <p className="mb-3 text-[13px] text-muted">
        {poll.winner_book_id ? `Votação encerrada em ${dayMonth(poll.closes_on)}.` : 'Votação encerrada. A curadoria vai anunciar o livro do mês.'}
        {total > 0 && ` ${total} ${total === 1 ? 'voto' : 'votos'}.`}
      </p>
      <ul className="space-y-3">
        {poll.options.map((b) => {
          const n = votes.get(b.id) || 0;
          const win = poll.winner_book_id === b.id;
          return (
            <li key={b.id} className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${win ? 'bg-burgundy/5 ring-burgundy' : 'bg-paper ring-line'}`}>
              <BookCover book={b} className="w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{b.title}{win && <span className="ml-2 rounded-full bg-burgundy px-2 py-0.5 text-[11px] text-ivory">Escolhido</span>}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-dusty-soft"><div className="h-full rounded-full bg-burgundy" style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></div>
              </div>
              <span className="w-14 text-right text-[13px] tabular-nums text-muted">{n} {n === 1 ? 'voto' : 'votos'}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
