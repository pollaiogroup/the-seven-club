'use server';
import { revalidatePath } from 'next/cache';
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

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

async function current(supabase: Awaited<ReturnType<typeof createClient>>, uid: string, pillarId: number) {
  const { data } = await supabase.from('check_ins').select('id, completed_at, photo_path').eq('member_id', uid).eq('pillar_id', pillarId).eq('day', today()).maybeSingle();
  return data as { id: string; completed_at: string | null; photo_path: string | null } | null;
}

async function isShared(supabase: Awaited<ReturnType<typeof createClient>>, checkInId: string) {
  const { data } = await supabase.from('posts').select('id').eq('check_in_id', checkInId).limit(1);
  return !!data?.length;
}

/** Registro do dia em um pilar. Concluir NÃO publica nada. */
export async function saveCheckIn(pillarId: number, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const done = fd.get('done') === 'on';
  const note = String(fd.get('note') || '').trim().slice(0, 1000) || null;
  let activityId = String(fd.get('activity_id') || '') || null;
  const newActivity = String(fd.get('new_activity') || '').trim();

  if (newActivity) {
    if (newActivity.length < 2 || newActivity.length > 80) return { error: 'A atividade precisa ter entre 2 e 80 caracteres.' };
    const { data, error } = await supabase.from('daily_activities').insert({ pillar_id: pillarId, member_id: uid, title: newActivity }).select('id').single();
    if (error) return { error: friendlyError(error) };
    activityId = data.id;
  }

  let photo: string | null = null;
  try {
    const p = (JSON.parse(String(fd.get('photo') || '[]')) as { path: string }[])[0]?.path;
    photo = p && ownsPath(uid, p) ? p : null;
  } catch {}

  const cur = await current(supabase, uid, pillarId);
  if (cur && cur.completed_at && !done && (await isShared(supabase, cur.id))) {
    return { error: 'Esta atividade já foi compartilhada no Feed. Exclua a publicação antes de desmarcar.' };
  }
  if (cur?.photo_path && cur.photo_path !== photo) await supabase.storage.from('private').remove([cur.photo_path]);

  const row = {
    member_id: uid, pillar_id: pillarId, day: today(), note, photo_path: photo, activity_id: activityId,
    completed_at: done ? cur?.completed_at || new Date().toISOString() : null,
  };
  const { error } = await supabase.from('check_ins').upsert(row, { onConflict: 'member_id,pillar_id,day' });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/seven', 'layout');
  return { ok: true, message: done ? 'Concluída. Fica só com você, a menos que decida compartilhar.' : 'Registro salvo.' };
}

/** Toque rápido na lista: marca ou desmarca o pilar de hoje. */
export async function quickToggle(pillarId: number, done: boolean): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const cur = await current(supabase, uid, pillarId);
  if (cur && !done && cur.completed_at && (await isShared(supabase, cur.id))) {
    return { error: 'Já compartilhada no Feed. Exclua a publicação antes de desmarcar.' };
  }
  const { error } = cur
    ? await supabase.from('check_ins').update({ completed_at: done ? cur.completed_at || new Date().toISOString() : null }).eq('id', cur.id)
    : await supabase.from('check_ins').insert({ member_id: uid, pillar_id: pillarId, day: today(), completed_at: done ? new Date().toISOString() : null });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/seven', 'layout');
  return { ok: true };
}

/** Publicação voluntária de uma atividade concluída. A nota privada nunca é copiada. */
export async function shareCheckIn(checkInId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const body = String(fd.get('body') || '').trim().slice(0, 3000);
  const withPhoto = fd.get('with_photo') === 'on';
  const { data: ci } = await supabase.from('check_ins').select('id, pillar_id, completed_at, photo_path').eq('id', checkInId).maybeSingle();
  if (!ci) return { error: 'Registro não encontrado.' };
  if (!ci.completed_at) return { error: 'Conclua a atividade antes de compartilhar.' };
  if (await isShared(supabase, ci.id)) return { error: 'Esta atividade já foi compartilhada.' };

  let media: { path: string } | null = null;
  if (withPhoto && ci.photo_path) {
    const { data: file, error: dErr } = await supabase.storage.from('private').download(ci.photo_path);
    if (dErr || !file) return { error: 'Não foi possível copiar a foto.' };
    const ext = ci.photo_path.split('.').pop() || 'webp';
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const { error: uErr } = await supabase.storage.from('media').upload(path, file, { contentType: file.type || 'image/webp' });
    if (uErr) return { error: 'Não foi possível copiar a foto.' };
    media = { path };
  }

  const { data: post, error } = await supabase.from('posts')
    .insert({ author_id: uid, source: 'seven', pillar_id: ci.pillar_id, check_in_id: ci.id, body })
    .select('id').single();
  if (error || !post) {
    if (media) await supabase.storage.from('media').remove([media.path]);
    return { error: friendlyError(error) };
  }
  if (media) await supabase.from('post_media').insert({ post_id: post.id, path: media.path, position: 0 });
  revalidatePath('/seven', 'layout');
  revalidatePath('/feed');
  return { ok: true, message: 'Compartilhado no Feed.' };
}

export async function removeActivity(id: string): Promise<ActionResult> {
  const { supabase } = await session();
  const { error } = await supabase.from('daily_activities').update({ active: false }).eq('id', id);
  revalidatePath('/seven', 'layout');
  return error ? { error: friendlyError(error) } : { ok: true };
}
