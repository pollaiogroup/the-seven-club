import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { monthName } from '@/lib/format';
import type { LibraryEntry, MemberCard } from '@/lib/types';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { BookCover } from '@/components/books/book-cover';
import { Stars } from '@/components/books/stars';
import { LibraryForm } from '@/components/books/library-form';

export const metadata = { title: 'Livro lido' };

export default async function LibraryEntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const { editar } = await searchParams;
  const me = await requireMember();
  const supabase = await createClient();
  const { data } = await supabase.from('library_entries')
    .select('id, member_id, rating, review, finished_on, created_at, book:books(id, title, author, cover_path)').eq('id', id).maybeSingle();
  if (!data) notFound();
  const entry = data as unknown as LibraryEntry & { member_id: string };
  const mine = entry.member_id === me.id;
  const { data: owner } = await supabase.from('profiles').select('id, handle, full_name, avatar_path, headline').eq('id', entry.member_id).single();
  const o = owner as MemberCard;
  const shelf = mine ? '/perfil?aba=biblioteca' : `/integrantes/${o.handle}?aba=biblioteca`;

  if (mine && editar) {
    return (
      <>
        <PageHeader title="Editar livro lido" back={`/biblioteca/${id}`} />
        <Sheet><div className="px-5 pt-6"><LibraryForm userId={me.id} clubBooks={[]} entry={entry} /></div></Sheet>
      </>
    );
  }
  return (
    <>
      <PageHeader title={mine ? 'Minha biblioteca' : `Biblioteca de ${o.full_name.split(' ')[0]}`} back={shelf} />
      <Sheet>
        <article className="px-5 pt-6">
          <div className="flex justify-center"><BookCover book={entry.book} className="w-44" priority /></div>
          <h2 className="mt-5 text-center text-[26px] leading-tight text-espresso [text-wrap:balance]">{entry.book.title}</h2>
          {entry.book.author && <p className="mt-1 text-center text-[15px] text-muted">{entry.book.author}</p>}
          <div className="mt-4 flex justify-center"><Stars value={entry.rating} size={22} /></div>
          <div className="mt-6 rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line">
            <Link href={mine ? '/perfil' : `/integrantes/${o.handle}`} className="flex items-center gap-3">
              <Avatar name={o.full_name} path={o.avatar_path} size={40} />
              <span className="leading-tight"><span className="block font-semibold">{o.full_name}</span>
                <span className="text-[12px] text-muted">{entry.finished_on ? `Terminou em ${monthName(entry.finished_on)} de ${entry.finished_on.slice(0, 4)}` : 'Livro lido'}</span></span>
            </Link>
            <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-line">{entry.review || (mine ? 'Você ainda não escreveu um comentário sobre este livro.' : 'Sem comentário.')}</p>
          </div>
          {mine && <div className="mt-4"><Link href={`/biblioteca/${id}?editar=1`} className="block text-center text-[14px] font-semibold text-burgundy">Editar avaliação e comentário</Link></div>}
        </article>
      </Sheet>
    </>
  );
}
