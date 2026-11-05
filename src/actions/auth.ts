'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { adminClient } from '@/lib/supabase/admin';
import { SITE_URL } from '@/lib/env';
import type { ActionResult } from '@/lib/types';

const safeNext = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/feed');

export async function signIn(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  if (!email || !password) return { error: 'Informe e-mail e senha.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'E-mail ou senha incorretos.' };
  redirect(safeNext(fd.get('next')));
}

const inviteSchema = z.object({
  full_name: z.string().trim().min(2, 'Informe seu nome completo.').max(80),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,30}$/, 'Use de 3 a 30 letras minúsculas, números, ponto ou sublinhado.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72),
  terms: z.literal('on', { error: 'É preciso aceitar as regras e a política de privacidade.' }),
});

export async function acceptInvite(token: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { full_name, handle, password } = parsed.data;
  const supabase = await createClient();

  const { data: inv } = await supabase.rpc('invitation_lookup', { p_token: token });
  if (!inv?.valid) return { error: 'Este convite não é mais válido. Peça um novo à administração do clube.' };
  const { data: free } = await supabase.rpc('handle_available', { p_handle: handle });
  if (!free) return { error: 'Esse @ já está em uso. Escolha outro.' };

  const admin = adminClient();
  let createdId: string | null = null;
  const created = await admin.auth.admin.createUser({ email: inv.email, password, email_confirm: true, user_metadata: { full_name } });
  if (created.error) {
    if (!/already|exists/i.test(created.error.message)) return { error: 'Não foi possível criar sua conta agora. Tente de novo.' };
  } else {
    createdId = created.data.user.id;
  }

  const { error: signErr } = await supabase.auth.signInWithPassword({ email: inv.email, password });
  if (signErr) return { error: 'Já existe uma conta com este e-mail. Use a mesma senha dela para aceitar o convite.' };

  const { error } = await supabase.rpc('accept_invitation', { p_token: token, p_full_name: full_name, p_handle: handle });
  if (error) {
    await supabase.auth.signOut();
    if (createdId) await admin.auth.admin.deleteUser(createdId);
    return { error: error.message || 'Não foi possível aceitar o convite.' };
  }
  redirect('/feed?bemvinda=1');
}

export async function requestReset(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get('email') || '').trim().toLowerCase();
  if (!email) return { error: 'Informe seu e-mail.' };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/confirm?next=/redefinir-senha` });
  return { message: 'Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha.' };
}

export async function updatePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const password = String(fd.get('password') || '');
  if (password.length < 8) return { error: 'A senha precisa ter pelo menos 8 caracteres.' };
  if (password !== String(fd.get('confirm') || '')) return { error: 'As senhas não conferem.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: 'Não foi possível alterar a senha. Peça um novo link.' };
  redirect('/feed');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/entrar');
}
