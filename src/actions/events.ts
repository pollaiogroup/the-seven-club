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

export async function setRegistration(eventId: string, status: 'registered' | 'confirmed' | 'cancelled'): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const { error } = await supabase.from('event_registrations').upsert({ event_id: eventId, member_id: uid, status }, { onConflict: 'event_id,member_id' });
  revalidatePath('/agenda', 'layout');
  if (error) return { error: friendlyError(error) };
  return { ok: true, message: status === 'cancelled' ? 'Inscrição cancelada.' : status === 'confirmed' ? 'Presença confirmada.' : 'Inscrição feita.' };
}
