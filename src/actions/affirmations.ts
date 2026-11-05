'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/db';
import type { ActionResult } from '@/lib/types';

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Sessão expirada');
  return { supabase, uid: data.user.id };
}

export async function toggleFavorite(affirmationId: string, fav: boolean): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const { error } = fav
    ? await supabase.from('affirmation_favorites').upsert({ member_id: uid, affirmation_id: affirmationId }, { onConflict: 'member_id,affirmation_id', ignoreDuplicates: true })
    : await supabase.from('affirmation_favorites').delete().eq('member_id', uid).eq('affirmation_id', affirmationId);
  revalidatePath('/afirmacoes');
  return error ? { error: friendlyError(error) } : { ok: true };
}

export async function shareAffirmation(affirmationId: string, body: string): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const { error } = await supabase.from('posts').insert({ author_id: uid, source: 'affirmation', affirmation_id: affirmationId, body: body.trim().slice(0, 3000) });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/feed');
  revalidatePath('/afirmacoes');
  return { ok: true, message: 'Compartilhada no Feed.' };
}
