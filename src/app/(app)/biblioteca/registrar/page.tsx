import { requireMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Book } from '@/lib/types';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { LibraryForm } from '@/components/books/library-form';

export const metadata = { title: 'Registrar livro lido' };

export default async function RegisterBook() {
  const me = await requireMember();
  const supabase = await createClient();
  // livros que o clube já leu (do mês atual para trás), sem os que ela já registrou
  const [{ data: months }, { data: mine }] = await Promise.all([
    supabase.from('book_months').select('month, book:books(id, title, author, cover_path)').order('month', { ascending: false }).limit(36),
    supabase.from('library_entries').select('book_id').eq('member_id', me.id),
  ]);
  const have = new Set((mine || []).map((r) => r.book_id as string));
  const clubBooks = ((months || []) as unknown as { book: Book }[]).map((m) => m.book).filter((b) => b && !have.has(b.id));
  return (
    <>
      <PageHeader title="Registrar livro lido" subtitle="Ele entra na estante do seu perfil" back="/perfil?aba=biblioteca" />
      <Sheet><div className="px-5 pt-6"><LibraryForm userId={me.id} clubBooks={clubBooks} /></div></Sheet>
    </>
  );
}
