'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/db';
import { ownsPath } from '@/lib/media';
import type { ActionResult } from '@/lib/types';

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Sessão expirada');
  return { supabase, uid: data.user.id };
}

const pickedImage = async (raw: FormDataEntryValue | null, uid: string) => {
  try {
    const p = (JSON.parse(String(raw || '[]')) as { path: string }[])[0]?.path;
    return p && ownsPath(uid, p) ? p : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------- clube do mês
export async function setBookReader(monthId: string, join: boolean): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const { error } = join
    ? await supabase.from('book_readers').upsert({ month_id: monthId, member_id: uid }, { onConflict: 'month_id,member_id', ignoreDuplicates: true })
    : await supabase.from('book_readers').delete().eq('month_id', monthId).eq('member_id', uid);
  revalidatePath('/clube-do-livro');
  revalidatePath('/feed');
  if (error) return { error: friendlyError(error) };
  return { ok: true, message: join ? 'Você está no clube deste mês. Vamos avisar sobre o encontro.' : 'Você saiu do clube deste mês.' };
}

export async function voteBook(pollId: string, bookId: string): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const { error } = await supabase.from('book_votes').upsert({ poll_id: pollId, member_id: uid, book_id: bookId }, { onConflict: 'poll_id,member_id' });
  revalidatePath('/clube-do-livro');
  if (error) return { error: friendlyError(error, 'A votação não está aberta.') };
  return { ok: true, message: 'Voto registrado. O resultado sai quando a votação fechar.' };
}

// ---------------------------------------------------------------- biblioteca
const entrySchema = z.object({
  book_id: z.string().uuid().optional().or(z.literal('')),
  title: z.string().trim().max(160).optional(),
  author: z.string().trim().max(120).optional(),
  rating: z.coerce.number().int().min(1, 'Escolha de 1 a 7 estrelas.').max(7),
  review: z.string().trim().max(2000).optional(),
  finished_on: z.string().regex(/^\d{4}-\d{2}$/).optional().or(z.literal('')),
});

export async function saveLibraryEntry(entryId: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const p = entrySchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]!.message };
  const { book_id, title, author, rating, review, finished_on } = p.data;
  const finished = finished_on ? `${finished_on}-01` : null;

  if (entryId) {
    const { error } = await supabase.from('library_entries')
      .update({ rating, review: review || null, finished_on: finished, updated_at: new Date().toISOString() }).eq('id', entryId).eq('member_id', uid);
    if (error) return { error: friendlyError(error) };
    revalidatePath('/perfil');
    redirect(`/biblioteca/${entryId}`);
  }

  let bookId = book_id || null;
  if (!bookId) {
    if (!title) return { error: 'Escolha um livro do clube ou escreva o título.' };
    const { data, error } = await supabase.from('books')
      .insert({ title, author: author || null, cover_path: await pickedImage(fd.get('cover'), uid), created_by: uid })
      .select('id').single();
    if (error) return { error: friendlyError(error) };
    bookId = data.id;
  }
  const { data, error } = await supabase.from('library_entries')
    .insert({ member_id: uid, book_id: bookId, rating, review: review || null, finished_on: finished }).select('id').single();
  if (error) return { error: error.code === '23505' ? 'Este livro já está na sua biblioteca.' : friendlyError(error) };
  revalidatePath('/perfil');
  redirect(`/perfil?aba=biblioteca&registrado=${data.id}`);
}

export async function deleteLibraryEntry(entryId: string): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const { error } = await supabase.from('library_entries').delete().eq('id', entryId).eq('member_id', uid);
  if (error) return { error: friendlyError(error) };
  revalidatePath('/perfil');
  redirect('/perfil?aba=biblioteca');
}
