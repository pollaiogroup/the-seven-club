'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';
import { friendlyError } from '@/lib/db';
import { ownsPath } from '@/lib/media';
import type { ActionResult } from '@/lib/types';

const PATH = '/admin/clube-do-livro';
async function admin() {
  const me = await requireStaff('admin');
  return { me, supabase: await createClient() };
}
const done = (message: string): ActionResult => {
  revalidatePath(PATH);
  revalidatePath('/clube-do-livro');
  revalidatePath('/feed');
  return { ok: true, message };
};
const month = z.string().regex(/^\d{4}-\d{2}$/, 'Escolha o mês.');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');

// ---------------------------------------------------------------- catálogo da curadoria
const bookSchema = z.object({ title: z.string().trim().min(1, 'Escreva o título.').max(160), author: z.string().trim().max(120).optional() });

export async function saveClubBook(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { me, supabase } = await admin();
  const p = bookSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]!.message };
  let cover: string | null = null;
  try {
    const c = (JSON.parse(String(fd.get('cover') || '[]')) as { path: string }[])[0]?.path;
    cover = c && (ownsPath(me.id, c) || c === fd.get('current_cover')) ? c : null;
  } catch {}
  const row = { title: p.data.title, author: p.data.author || null, cover_path: cover, club: true };
  const { error } = id
    ? await supabase.from('books').update(row).eq('id', id)
    : await supabase.from('books').insert({ ...row, created_by: me.id });
  return error ? { error: friendlyError(error) } : done(id ? 'Livro atualizado.' : 'Livro adicionado ao catálogo do clube.');
}

// ---------------------------------------------------------------- livro do mês
const monthSchema = z.object({
  month, book_id: z.string().uuid('Escolha o livro.'),
  note: z.string().trim().max(1000).optional(),
  meeting_event_id: z.string().uuid().optional().or(z.literal('')),
});

export async function saveBookMonth(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { me, supabase } = await admin();
  const p = monthSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]!.message };
  const v = p.data;
  const { error } = await supabase.from('book_months').upsert(
    { month: `${v.month}-01`, book_id: v.book_id, note: v.note || null, meeting_event_id: v.meeting_event_id || null, created_by: me.id },
    { onConflict: 'month' });
  return error ? { error: friendlyError(error) } : done('Livro do mês salvo.');
}

export async function deleteBookMonth(id: string): Promise<ActionResult> {
  const { supabase } = await admin();
  const { error } = await supabase.from('book_months').delete().eq('id', id);
  return error ? { error: friendlyError(error) } : done('Mês removido.');
}

// ---------------------------------------------------------------- votação
const pollSchema = z.object({
  target_month: month, opens_on: day, closes_on: day,
  option1: z.string().uuid('Escolha os 3 livros.'), option2: z.string().uuid('Escolha os 3 livros.'), option3: z.string().uuid('Escolha os 3 livros.'),
});

export async function createPoll(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { me, supabase } = await admin();
  const p = pollSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]!.message };
  const v = p.data;
  const options = [v.option1, v.option2, v.option3];
  if (new Set(options).size !== 3) return { error: 'Escolha 3 livros diferentes.' };
  if (v.closes_on < v.opens_on) return { error: 'A votação precisa fechar depois de abrir.' };
  const { data, error } = await supabase.from('book_polls')
    .insert({ target_month: `${v.target_month}-01`, opens_on: v.opens_on, closes_on: v.closes_on, created_by: me.id }).select('id').single();
  if (error) return { error: error.code === '23505' ? 'Já existe uma votação para esse mês.' : friendlyError(error) };
  const { error: e2 } = await supabase.from('book_poll_options').insert(options.map((book_id, i) => ({ poll_id: data.id, book_id, position: i + 1 })));
  if (e2) {
    await supabase.from('book_polls').delete().eq('id', data.id);
    return { error: friendlyError(e2) };
  }
  return done('Votação criada. Ela abre sozinha na data escolhida.');
}

export async function deletePoll(id: string): Promise<ActionResult> {
  const { supabase } = await admin();
  const { error } = await supabase.from('book_polls').delete().eq('id', id);
  return error ? { error: friendlyError(error) } : done('Votação removida.');
}

/** Empate ou votação sem votos: a administração escolhe o livro do mês seguinte. */
export async function resolvePoll(pollId: string, bookId: string): Promise<ActionResult> {
  const { me, supabase } = await admin();
  const { data: poll, error } = await supabase.from('book_polls').update({ winner_book_id: bookId, closed_at: new Date().toISOString() }).eq('id', pollId).select('target_month').single();
  if (error) return { error: friendlyError(error) };
  const { error: e2 } = await supabase.from('book_months').upsert({ month: poll.target_month, book_id: bookId, created_by: me.id }, { onConflict: 'month' });
  return e2 ? { error: friendlyError(e2) } : done('Livro do mês definido.');
}

// ---------------------------------------------------------------- cupons
const couponSchema = z.object({
  book_id: z.string().uuid('Escolha o livro.'),
  store: z.string().trim().min(2, 'Informe a loja.').max(80),
  code: z.string().trim().min(2, 'Informe o código.').max(40),
  url: z.string().trim().url('Link inválido.').optional().or(z.literal('')),
  business_id: z.string().uuid().optional().or(z.literal('')),
  details: z.string().trim().max(300).optional(),
  starts_on: day, valid_until: day.optional().or(z.literal('')),
});

export async function saveCoupon(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { me, supabase } = await admin();
  const p = couponSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]!.message };
  const v = p.data;
  const { error } = await supabase.from('book_coupons').insert({
    book_id: v.book_id, store: v.store, code: v.code.toUpperCase(), url: v.url || null, business_id: v.business_id || null,
    details: v.details || null, starts_on: v.starts_on, valid_until: v.valid_until || null, created_by: me.id,
  });
  return error ? { error: friendlyError(error) } : done('Cupom criado. As integrantes são avisadas no dia de início.');
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  const { supabase } = await admin();
  const { error } = await supabase.from('book_coupons').delete().eq('id', id);
  return error ? { error: friendlyError(error) } : done('Cupom removido.');
}
