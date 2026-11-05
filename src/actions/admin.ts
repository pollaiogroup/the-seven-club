'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';
import { friendlyError } from '@/lib/db';
import { fromLocalInput } from '@/lib/format';
import { ownsPath } from '@/lib/media';
import type { ActionResult, Role } from '@/lib/types';

async function staff(min: Role = 'admin') {
  const me = await requireStaff(min);
  return { me, supabase: await createClient() };
}
const done = (path: string, message = 'Salvo.') => { revalidatePath(path); return { ok: true, message }; };

// ---------------------------------------------------------------- convites
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  role: z.enum(['member', 'moderator', 'admin', 'super_admin']),
  plan: z.string().trim().min(2).max(40),
  note: z.string().trim().max(200).optional(),
  days: z.coerce.number().int().min(1).max(90),
});

export async function createInvite(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { me, supabase } = await staff();
  const p = inviteSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]!.message };
  if ((p.data.role === 'admin' || p.data.role === 'super_admin') && me.role !== 'super_admin') return { error: 'Somente a super admin convida administradoras.' };
  const { data: exists } = await supabase.from('invitations').select('id').eq('email', p.data.email).is('accepted_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString()).limit(1);
  if (exists?.length) return { error: 'Já existe um convite ativo para esse e-mail.' };
  const { error } = await supabase.from('invitations').insert({
    email: p.data.email, role: p.data.role, plan: p.data.plan, note: p.data.note || null, created_by: me.id,
    expires_at: new Date(Date.now() + p.data.days * 86400000).toISOString(),
  });
  if (error) return { error: friendlyError(error) };
  return done('/admin/convites', 'Convite criado. Copie o link e envie para a convidada.');
}

export async function revokeInvite(id: string): Promise<ActionResult> {
  const { supabase } = await staff();
  const { error } = await supabase.from('invitations').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  return error ? { error: friendlyError(error) } : done('/admin/convites', 'Convite revogado.');
}

// ---------------------------------------------------------------- integrantes e assinaturas
export async function updateMember(memberId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await staff();
  const role = String(fd.get('role'));
  const status = String(fd.get('status'));
  const { error, data } = await supabase.from('members').update({ role, status }).eq('id', memberId).select('id');
  if (error || !data?.length) return { error: friendlyError(error, 'Sem permissão para esta alteração.') };
  const ms = { plan: String(fd.get('plan') || 'fundadora'), status: String(fd.get('membership_status') || 'active'), ends_at: String(fd.get('ends_at') || '') || null };
  const msId = String(fd.get('membership_id') || '');
  const { error: e2 } = msId
    ? await supabase.from('memberships').update(ms).eq('id', msId)
    : await supabase.from('memberships').insert({ ...ms, member_id: memberId });
  if (e2) return { error: friendlyError(e2) };
  return done('/admin/integrantes', 'Integrante atualizada.');
}

// ---------------------------------------------------------------- moderação
export async function moderateTarget(type: string, id: string, hide: boolean): Promise<ActionResult> {
  const { supabase } = await staff('moderator');
  const stamp = hide ? new Date().toISOString() : null;
  let res;
  if (type === 'post' || type === 'comment' || type === 'project') {
    // Função no banco: modera mesmo conteúdo que a equipe não pode ler (ex.: post denunciado em projeto privado)
    const { data, error } = await supabase.rpc('moderate_content', { p_type: type, p_id: id, p_hide: hide });
    res = { error, data: data ? [{ id }] : [] };
  } else if (type === 'business') {
    await staff('admin');
    res = await supabase.from('businesses').update({ hidden_at: stamp }).eq('id', id).select('id');
  } else if (type === 'member') {
    await staff('admin');
    res = await supabase.from('members').update({ status: hide ? 'suspended' : 'active' }).eq('id', id).select('id');
  } else return { error: 'Tipo inválido.' };
  if (res.error || !res.data?.length) return { error: friendlyError(res.error, 'Sem permissão.') };
  revalidatePath('/admin', 'layout');
  return { ok: true, message: hide ? 'Conteúdo ocultado.' : 'Conteúdo reexibido.' };
}

export async function resolveReport(id: string, status: 'actioned' | 'dismissed', note: string): Promise<ActionResult> {
  const { supabase } = await staff('moderator');
  const { error } = await supabase.from('reports').update({ status, resolution_note: note.slice(0, 500) || null }).eq('id', id);
  return error ? { error: friendlyError(error) } : done('/admin/moderacao', 'Denúncia resolvida.');
}

// ---------------------------------------------------------------- afirmações
const THEMES = ['autoconfianca', 'amor-proprio', 'prosperidade', 'lideranca', 'disciplina', 'realizacao', 'gratidao', 'coragem', 'abundancia', 'criatividade', 'proposito', 'independencia'] as const;

export async function saveAffirmation(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { me, supabase } = await staff();
  const p = z.object({
    text: z.string().trim().min(10, 'Mínimo de 10 caracteres.').max(220, 'Máximo de 220 caracteres.'),
    theme: z.enum(THEMES),
    status: z.enum(['draft', 'published', 'archived']),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]!.message };
  const { error } = id
    ? await supabase.from('affirmations').update(p.data).eq('id', id)
    : await supabase.from('affirmations').insert({ ...p.data, created_by: me.id });
  if (error) return { error: error.code === '23505' ? 'Essa afirmação já existe.' : friendlyError(error) };
  return done('/admin/afirmacoes', id ? 'Afirmação atualizada.' : 'Afirmação adicionada.');
}

export async function importAffirmations(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { me, supabase } = await staff();
  const theme = String(fd.get('theme'));
  const status = fd.get('publish') === 'on' ? 'published' : 'draft';
  if (!THEMES.includes(theme as (typeof THEMES)[number])) return { error: 'Escolha o tema.' };
  const lines = String(fd.get('lines') || '').split('\n').map((l) => l.trim().replace(/^["“]|["”]$/g, '')).filter((l) => l.length >= 10 && l.length <= 220);
  if (!lines.length) return { error: 'Cole uma afirmação por linha (10 a 220 caracteres).' };
  const { data: existing } = await supabase.from('affirmations').select('text').in('text', lines);
  const known = new Set((existing || []).map((e: { text: string }) => e.text));
  const fresh = [...new Set(lines)].filter((l) => !known.has(l));
  if (fresh.length) {
    const { error } = await supabase.from('affirmations').insert(fresh.map((text) => ({ text, theme, status, created_by: me.id })));
    if (error) return { error: friendlyError(error) };
  }
  return done('/admin/afirmacoes', `${fresh.length} adicionadas${lines.length - fresh.length ? `, ${lines.length - fresh.length} repetidas ignoradas` : ''}.`);
}

export async function scheduleAffirmation(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await staff();
  const { error } = await supabase.rpc('schedule_affirmation', { p_day: String(fd.get('day')), p_affirmation: String(fd.get('affirmation_id')) });
  return error ? { error: friendlyError(error) } : done('/admin/afirmacoes', 'Afirmação agendada para o dia escolhido.');
}

// ---------------------------------------------------------------- eventos
const eventSchema = z.object({
  title: z.string().trim().min(3, 'Informe o título.').max(120),
  kind: z.enum(['presencial', 'online', 'workshop', 'palestra', 'experiencia', 'atividade']),
  starts_at: z.string().min(10, 'Informe o início.'),
  ends_at: z.string().optional(),
  location: z.string().trim().max(200).optional(),
  online_url: z.string().trim().max(300).optional(),
  capacity: z.string().optional(),
  description: z.string().trim().max(4000).optional(),
});

export async function saveEvent(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { me, supabase } = await staff();
  const p = eventSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]!.message };
  const v = p.data;
  if (v.online_url && !/^https:\/\//.test(v.online_url)) return { error: 'O link online precisa começar com https://' };
  let cover: string | null = null;
  try {
    const c = (JSON.parse(String(fd.get('cover') || '[]')) as { path: string }[])[0]?.path;
    cover = c && (ownsPath(me.id, c) || c === fd.get('current_cover')) ? c : null;
  } catch {}
  const row = {
    title: v.title, kind: v.kind, starts_at: fromLocalInput(v.starts_at), ends_at: v.ends_at ? fromLocalInput(v.ends_at) : null,
    location: v.location || null, online_url: v.online_url || null, capacity: v.capacity ? Number(v.capacity) : null,
    description: v.description || null, cover_path: cover, show_attendees: fd.get('show_attendees') === 'on', published: fd.get('published') === 'on',
  };
  const { data, error } = id
    ? await supabase.from('events').update(row).eq('id', id).select('id')
    : await supabase.from('events').insert({ ...row, created_by: me.id }).select('id');
  if (error || !data?.length) return { error: friendlyError(error) };
  if (row.published && fd.get('notify') === 'on') {
    await supabase.rpc('admin_broadcast', { p_title: 'Novo na agenda', p_body: row.title, p_link: `/agenda/${data[0].id}` });
  }
  return done('/admin/eventos', id ? 'Evento atualizado.' : 'Evento criado.');
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const { supabase } = await staff();
  const { error } = await supabase.from('events').delete().eq('id', id);
  return error ? { error: friendlyError(error) } : done('/admin/eventos', 'Evento excluído.');
}

// ---------------------------------------------------------------- empresas, projetos, categorias
export async function setFeatured(id: string, featured: boolean): Promise<ActionResult> {
  const { supabase } = await staff();
  const { error } = await supabase.from('businesses').update({ featured }).eq('id', id);
  return error ? { error: friendlyError(error) } : done('/admin/empresas', featured ? 'Empresa em destaque.' : 'Destaque removido.');
}

export async function saveCategory(id: number | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await staff();
  const p = z.object({
    name: z.string().trim().min(2).max(40),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, 'Endereço: letras minúsculas, números e hífen.'),
    icon: z.string().trim().max(30),
    sort: z.coerce.number().int().min(0).max(999),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0]!.message };
  const { error } = id ? await supabase.from('business_categories').update(p.data).eq('id', id) : await supabase.from('business_categories').insert(p.data);
  return error ? { error: friendlyError(error) } : done('/admin/categorias', 'Categoria salva.');
}

export async function deleteCategory(id: number): Promise<ActionResult> {
  const { supabase } = await staff();
  const { error } = await supabase.from('business_categories').delete().eq('id', id);
  return error ? { error: error.code === '23503' ? 'Há empresas nesta categoria. Mova-as antes de excluir.' : friendlyError(error) } : done('/admin/categorias', 'Categoria excluída.');
}

// ---------------------------------------------------------------- conteúdo institucional e avisos
export async function saveSetting(key: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { me, supabase } = await staff();
  const allowed = ['grioh_url', 'community_rules', 'privacy_policy', 'terms'];
  if (!allowed.includes(key)) return { error: 'Configuração inválida.' };
  let value: string | null = String(fd.get('value') || '').trim();
  if (key === 'grioh_url') {
    if (value && !/^https:\/\/[^\s]+$/.test(value)) return { error: 'O link precisa começar com https://' };
    value = value || null;
  }
  const { error } = await supabase.from('app_settings').upsert({ key, value, public_read: key !== 'grioh_url', updated_by: me.id, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error ? { error: friendlyError(error) } : done('/admin/conteudo', 'Conteúdo salvo.');
}

export async function broadcast(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await staff();
  const title = String(fd.get('title') || '').trim().slice(0, 80);
  const body = String(fd.get('body') || '').trim().slice(0, 240);
  const link = String(fd.get('link') || '').trim();
  if (title.length < 3 || body.length < 3) return { error: 'Preencha título e mensagem.' };
  if (link && !link.startsWith('/')) return { error: 'O link deve ser uma página do app, começando com /' };
  const { data, error } = await supabase.rpc('admin_broadcast', { p_title: title, p_body: body, p_link: link || null });
  return error ? { error: friendlyError(error) } : done('/admin/notificacoes', `Aviso enviado para ${data} integrantes.`);
}
