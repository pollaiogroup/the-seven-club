'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { friendlyError } from '@/lib/db';
import { ownsPath } from '@/lib/media';
import type { ActionResult } from '@/lib/types';

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Sessão expirada');
  return { supabase, uid: data.user.id };
}

const schema = z.object({
  full_name: z.string().trim().min(2, 'Informe seu nome.').max(80),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(600).optional(),
  city: z.string().trim().max(80).optional(),
  interests: z.string().trim().max(300).optional(),
  instagram: z.string().trim().max(60).optional(),
  website: z.string().trim().max(200).optional(),
});

export async function updateProfile(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  let avatar: string | null = null;
  try {
    const p = (JSON.parse(String(fd.get('avatar') || '[]')) as { path: string }[])[0]?.path;
    avatar = p && (ownsPath(uid, p) || p === fd.get('current_avatar')) ? p : null;
  } catch {}
  let website = v.website || null;
  if (website && !/^https?:\/\//.test(website)) website = `https://${website}`;
  const interests = (v.interests || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12).map((s) => s.slice(0, 30));
  const { data, error } = await supabase.from('profiles').update({
    full_name: v.full_name, headline: v.headline || null, bio: v.bio || null, city: v.city || null, interests,
    instagram: (v.instagram || '').replace(/^@/, '') || null, website, avatar_path: avatar,
  }).eq('id', uid).select('handle');
  if (error || !data?.length) return { error: friendlyError(error) };
  revalidatePath('/', 'layout');
  redirect('/perfil');
}

export async function updatePreferences(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const bool = (k: string) => fd.get(k) === 'on';
  const time = (k: string, d: string) => (/^\d{2}:\d{2}$/.test(String(fd.get(k))) ? String(fd.get(k)) : d);
  const { error } = await supabase.from('user_preferences').upsert({
    member_id: uid,
    notify_likes: bool('notify_likes'),
    notify_comments: bool('notify_comments'),
    notify_mentions: bool('notify_mentions'),
    notify_projects: bool('notify_projects'),
    notify_events: bool('notify_events'),
    notify_book_club: bool('notify_book_club'),
    notify_affirmation: bool('notify_affirmation'),
    affirmation_time: time('affirmation_time', '08:00'),
    notify_seven_reminder: bool('notify_seven_reminder'),
    seven_reminder_time: time('seven_reminder_time', '20:00'),
  }, { onConflict: 'member_id' });
  return error ? { error: friendlyError(error) } : { ok: true, message: 'Preferências salvas.' };
}

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string): Promise<ActionResult> {
  const { supabase, uid } = await session();
  if (!sub?.endpoint?.startsWith('https://')) return { error: 'Inscrição inválida.' };
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  const { error } = await supabase.from('push_subscriptions').insert({ member_id: uid, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, user_agent: userAgent.slice(0, 200) });
  if (error) return { error: friendlyError(error) };
  await supabase.from('user_preferences').update({ push_enabled: true }).eq('member_id', uid);
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const { supabase, uid } = await session();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  const { data } = await supabase.from('push_subscriptions').select('id').eq('member_id', uid).limit(1);
  if (!data?.length) await supabase.from('user_preferences').update({ push_enabled: false }).eq('member_id', uid);
  return { ok: true };
}

export async function deleteAccount(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  if (String(fd.get('confirm') || '').trim().toUpperCase() !== 'EXCLUIR') return { error: 'Digite EXCLUIR para confirmar.' };
  const { data: me } = await supabase.from('members').select('role').eq('id', uid).single();
  if (me?.role === 'super_admin') return { error: 'A super admin precisa transferir o papel antes de excluir a conta.' };
  const { data: files } = await supabase.from('post_media').select('path');
  const own = (files || []).map((f: { path: string }) => f.path).filter((p: string) => ownsPath(uid, p));
  if (own.length) await supabase.storage.from('media').remove(own);
  await supabase.auth.signOut();
  const { error } = await adminClient().auth.admin.deleteUser(uid);
  if (error) return { error: 'Não foi possível excluir agora. Fale com a administração.' };
  redirect('/entrar');
}
