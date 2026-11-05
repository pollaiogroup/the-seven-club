import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { monthName } from '@/lib/format';
import type { BookClubHome } from '@/lib/types';
import { BookCover } from '@/components/books/book-cover';

/** Card do Clube do Livro no Feed: o livro do mês e o que pede ação agora (voto, cupom, entrar). */
export function BookClubTeaser({ h }: { h: BookClubHome }) {
  const cur = h.current;
  if (!cur && !h.poll && !h.coupons.length) return null;
  const pollOpen = h.poll?.status === 'open';
  const status = pollOpen && !h.poll!.my_vote ? `Votação aberta: escolha o livro de ${monthName(h.poll!.target_month)}`
    : h.coupons.length ? `${h.coupons.length === 1 ? 'Cupom de desconto disponível' : `${h.coupons.length} cupons de desconto`}`
    : cur?.joined ? 'Você vai ler este livro'
    : cur ? 'Toque para entrar no clube deste mês' : 'Veja a votação';
  return (
    <Link href="/clube-do-livro" className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-paper p-3 ring-1 ring-line hover:ring-dusty">
      {cur && <BookCover book={cur.book} className="w-11 shrink-0 rounded-[4px]" />}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[12px] font-semibold text-burgundy">Clube do Livro · Livro de {monthName(h.today)}</span>
        <span className="mt-0.5 block truncate text-[15px] font-semibold">{cur ? cur.book.title : 'Ainda não anunciado'}</span>
        <span className={`mt-0.5 block truncate text-[12px] ${pollOpen && !h.poll!.my_vote ? 'font-semibold text-olive-ink' : 'text-muted'}`}>{status}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-taupe" />
    </Link>
  );
}
