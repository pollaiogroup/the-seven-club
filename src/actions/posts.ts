'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/db';
import { ownsPath } from '@/lib/media';
import type { ActionResult, Comment, Post } from '@/lib/types';

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Sessão expirada');
  return { supabase, uid: data.user.id };
}

export type FeedQuery = { scope?: string; business?: string; project?: string; author?: string };

export async function loadFeed(q: FeedQuery, cursor?: { ts: string; id: string }): Promise<Post[]> {
  const { supabase } = await session();
  const { data, error } = await supabase.rpc('feed_page', {
    p_scope: q.scope || 'all',
    p_business: q.business || null,
    p_project: q.project || null,
    p_author: q.author || null,
    p_cursor_ts: cursor?.ts || null,
    p_cursor_id: cursor?.id || null,
    p_limit: 15,
  });
  if (error) throw new Error(error.message);
  return data as Post[];
}

const mediaSchema = z.array(z.object({ path: z.string(), width: z.number().int().positive(), height: z.number().int().positive() })).max(4);

export async function createPost(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const body = String(fd.get('body') || '').trim();
  const target = String(fd.get('target') || 'member');
  let media: z.infer<typeof mediaSchema> = [];
  try {
    media = mediaSchema.parse(JSON.parse(String(fd.get('media') || '[]')));
  } catch {
    return { error: 'Imagens inválidas.' };
  }
  if (!body && media.length === 0) return { error: 'Escreva algo ou adicione uma foto.' };
  if (body.length > 3000) return { error: 'O texto passou de 3.000 caracteres.' };
  if (media.some((m) => !ownsPath(uid, m.path))) return { error: 'Imagem inválida.' };

  const [kind, id] = target.split(':');
  const row: Record<string, unknown> = { author_id: uid, body, context: 'member' };
  if (kind === 'business' && id) Object.assign(row, { context: 'business', business_id: id });
  if (kind === 'project' && id) Object.assign(row, { context: 'project', project_id: id });

  const { data: post, error } = await supabase.from('posts').insert(row).select('id').single();
  if (error || !post) return { error: friendlyError(error) };
  if (media.length) {
    const { error: mErr } = await supabase.from('post_media').insert(media.map((m, i) => ({ post_id: post.id, path: m.path, width: m.width, height: m.height, position: i })));
    if (mErr) {
      await supabase.from('posts').delete().eq('id', post.id);
      return { error: 'Não foi possível anexar as imagens.' };
    }
  }
  revalidatePath('/feed');
  const back = String(fd.get('back') || '/feed');
  redirect(back.startsWith('/') ? back : '/feed');
}

export async function updatePost(id: string, body: string): Promise<ActionResult> {
  const { supabase } = await session();
  const text = body.trim();
  if (text.length > 3000) return { error: 'O texto passou de 3.000 caracteres.' };
  const { error, data } = await supabase.from('posts').update({ body: text }).eq('id', id).select('id');
  if (error || !data?.length) return { error: friendlyError(error, 'Não foi possível editar.') };
  return { ok: true };
}

export async function deletePost(id: string): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const { data: media } = await supabase.from('post_media').select('path').eq('post_id', id);
  const { error, data } = await supabase.from('posts').delete().eq('id', id).select('id');
  if (error || !data?.length) return { error: friendlyError(error, 'Não foi possível excluir.') };
  const own = (media || []).map((m: { path: string }) => m.path).filter((p: string) => ownsPath(uid, p));
  if (own.length) await supabase.storage.from('media').remove(own);
  revalidatePath('/feed');
  return { ok: true };
}

export async function moderatePost(id: string, hide: boolean): Promise<ActionResult> {
  const { supabase } = await session();
  const { error, data } = await supabase.from('posts').update({ hidden_at: hide ? new Date().toISOString() : null }).eq('id', id).select('id');
  if (error || !data?.length) return { error: friendlyError(error, 'Sem permissão para moderar.') };
  revalidatePath('/feed');
  return { ok: true };
}

export async function toggleLike(postId: string, like: boolean): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const { error } = like
    ? await supabase.from('likes').upsert({ post_id: postId, member_id: uid }, { onConflict: 'post_id,member_id', ignoreDuplicates: true })
    : await supabase.from('likes').delete().eq('post_id', postId).eq('member_id', uid);
  return error ? { error: friendlyError(error) } : { ok: true };
}

export async function toggleSave(postId: string, save: boolean): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const { error } = save
    ? await supabase.from('saved_posts').upsert({ post_id: postId, member_id: uid }, { onConflict: 'member_id,post_id', ignoreDuplicates: true })
    : await supabase.from('saved_posts').delete().eq('post_id', postId).eq('member_id', uid);
  return error ? { error: friendlyError(error) } : { ok: true };
}

export async function loadComments(postId: string): Promise<Comment[]> {
  const { supabase } = await session();
  const { data } = await supabase.rpc('post_comments', { p_post: postId });
  return (data as Comment[]) || [];
}

export async function addComment(postId: string, body: string): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const text = body.trim();
  if (!text) return { error: 'Escreva um comentário.' };
  if (text.length > 1000) return { error: 'Comentário muito longo.' };
  const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: uid, body: text });
  return error ? { error: friendlyError(error) } : { ok: true };
}

export async function deleteComment(id: string): Promise<ActionResult> {
  const { supabase } = await session();
  const { error, data } = await supabase.from('comments').delete().eq('id', id).select('id');
  return error || !data?.length ? { error: friendlyError(error, 'Não foi possível excluir.') } : { ok: true };
}

export async function moderateComment(id: string, hide: boolean): Promise<ActionResult> {
  const { supabase } = await session();
  const { error, data } = await supabase.from('comments').update({ hidden_at: hide ? new Date().toISOString() : null }).eq('id', id).select('id');
  return error || !data?.length ? { error: friendlyError(error, 'Sem permissão.') } : { ok: true };
}

const reportSchema = z.object({
  target_type: z.enum(['post', 'comment', 'member', 'business', 'project']),
  target_id: z.string().uuid(),
  reason: z.string().trim().min(3, 'Conte em poucas palavras o motivo.').max(500),
});

export async function report(input: { target_type: string; target_id: string; reason: string }): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { supabase, uid } = await session();
  const { error } = await supabase.from('reports').insert({ ...parsed.data, reporter_id: uid });
  return error ? { error: friendlyError(error) } : { ok: true, message: 'Denúncia enviada à moderação. Obrigada.' };
}

export async function setBlock(memberId: string, block: boolean): Promise<ActionResult> {
  const { supabase, uid } = await session();
  if (memberId === uid) return { error: 'Você não pode bloquear a si mesma.' };
  const { error } = block
    ? await supabase.from('blocks').upsert({ blocker_id: uid, blocked_id: memberId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true })
    : await supabase.from('blocks').delete().eq('blocker_id', uid).eq('blocked_id', memberId);
  revalidatePath('/feed');
  return error ? { error: friendlyError(error) } : { ok: true };
}
