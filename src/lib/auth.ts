import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Me, Role } from '@/lib/types';

const rank: Record<Role, number> = { member: 0, moderator: 1, admin: 2, super_admin: 3 };

/** Sessão + cadastro de integrante (uma consulta por requisição). */
export const getMe = cache(async (): Promise<{ me: Me | null; userId: string | null; email: string | null }> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { me: null, userId: null, email: null };
  const { data: me } = await supabase.rpc('me');
  return { me: (me as Me | null) ?? null, userId: data.user.id, email: data.user.email ?? null };
});

export async function requireMember(): Promise<Me> {
  const { me, userId } = await getMe();
  if (!userId) redirect('/entrar');
  if (!me) redirect('/entrar?erro=sem-convite');
  if (me.status !== 'active') redirect('/entrar?erro=suspensa');
  return me;
}

export function hasRole(me: Me | null, min: Role) {
  return !!me && me.status === 'active' && rank[me.role] >= rank[min];
}

export async function requireStaff(min: Role = 'moderator'): Promise<Me> {
  const me = await requireMember();
  if (!hasRole(me, min)) redirect('/feed');
  return me;
}
