'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/db';
import { ownsPath } from '@/lib/media';
import { slugify } from '@/lib/format';
import type { ActionResult } from '@/lib/types';

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Sessão expirada');
  return { supabase, uid: data.user.id };
}

const schema = z.object({
  name: z.string().trim().min(2, 'Dê um nome ao projeto.').max(80),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(['ideia', 'empreendimento', 'social', 'criativo', 'colaboracao', 'em-desenvolvimento'], { error: 'Escolha uma categoria.' }),
  visibility: z.enum(['club', 'private']),
});

export async function saveProject(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  let cover: string | null = null;
  try {
    const p = (JSON.parse(String(fd.get('cover') || '[]')) as { path: string }[])[0]?.path;
    cover = p && (ownsPath(uid, p) || p === fd.get('current_cover')) ? p : null;
  } catch {}
  const row = { ...parsed.data, description: parsed.data.description || null, cover_path: cover };

  if (id) {
    const { data, error } = await supabase.from('projects').update(row).eq('id', id).select('slug');
    if (error || !data?.length) return { error: friendlyError(error, 'Sem permissão para editar.') };
    revalidatePath(`/projetos/${data[0].slug}`);
    redirect(`/projetos/${data[0].slug}`);
  }
  const base = slugify(row.name) || 'projeto';
  // Projetos privados de outras integrantes não são visíveis, então o endereço livre é
  // descoberto tentando gravar: em caso de endereço repetido (23505), tenta com um sufixo.
  let slug = base.length >= 3 ? base : `${base}-seven`;
  let error = null;
  for (let i = 0; i < 5; i++) {
    ({ error } = await supabase.from('projects').insert({ ...row, slug, owner_id: uid }));
    if (!error || error.code !== '23505') break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  if (error) return { error: friendlyError(error) };
  redirect(`/projetos/${slug}`);
}

export async function deleteProject(id: string) {
  const { supabase } = await session();
  const { error, data } = await supabase.from('projects').delete().eq('id', id).select('id');
  if (error || !data?.length) return { error: friendlyError(error, 'Somente a responsável exclui o projeto.') };
  redirect('/perfil?aba=projetos');
}

export async function addProjectMember(projectId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const handle = String(fd.get('handle') || '').trim().replace(/^@/, '').toLowerCase();
  const { data: p } = await supabase.from('profiles').select('id').eq('handle', handle).maybeSingle();
  if (!p) return { error: 'Não encontramos uma integrante com esse @.' };
  const { error } = await supabase.from('project_members').insert({ project_id: projectId, member_id: p.id, role: 'collaborator', added_by: uid });
  if (error) return { error: error.code === '23505' ? 'Ela já participa do projeto.' : friendlyError(error, 'Somente a responsável adiciona colaboradoras.') };
  revalidatePath('/projetos', 'layout');
  return { ok: true, message: 'Colaboradora adicionada. Ela recebeu uma notificação.' };
}

export async function removeProjectMember(projectId: string, memberId: string): Promise<ActionResult> {
  const { supabase } = await session();
  const { error, data } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('member_id', memberId).select('member_id');
  revalidatePath('/projetos', 'layout');
  return error || !data?.length ? { error: friendlyError(error, 'Sem permissão.') } : { ok: true };
}
