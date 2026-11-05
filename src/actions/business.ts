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

const firstImage = (raw: FormDataEntryValue | null, uid: string, current?: string | null) => {
  try {
    const arr = JSON.parse(String(raw || '[]')) as { path: string }[];
    const p = arr[0]?.path;
    if (!p) return null;
    if (p === current) return current;
    return ownsPath(uid, p) ? p : null;
  } catch {
    return null;
  }
};

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da empresa.').max(80),
  tagline: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  category_id: z.coerce.number().int().positive('Escolha uma categoria.'),
  instagram: z.string().trim().max(60).optional(),
  website: z.string().trim().max(200).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(200).optional(),
  service_area: z.string().trim().max(200).optional(),
});

function clean(v: z.infer<typeof schema>) {
  const digits = (v.whatsapp || '').replace(/\D/g, '');
  const whatsapp = digits ? (digits.length <= 11 ? `55${digits}` : digits) : null;
  if (whatsapp && !/^[0-9]{10,15}$/.test(whatsapp)) throw new Error('WhatsApp inválido. Use DDD + número.');
  let website = v.website || null;
  if (website && !/^https?:\/\//.test(website)) website = `https://${website}`;
  if (website) {
    try { new URL(website); } catch { throw new Error('Site inválido.'); }
  }
  return {
    name: v.name,
    tagline: v.tagline || null,
    description: v.description || null,
    category_id: v.category_id,
    instagram: (v.instagram || '').replace(/^@|https?:\/\/(www\.)?instagram\.com\//g, '').replace(/\/$/, '') || null,
    website,
    whatsapp,
    city: v.city || null,
    address: v.address || null,
    service_area: v.service_area || null,
  };
}

export async function saveBusiness(id: string | null, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  let row;
  try {
    row = clean(parsed.data);
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (id) {
    const { data: cur } = await supabase.from('businesses').select('slug, logo_path, cover_path').eq('id', id).single();
    if (!cur) return { error: 'Empresa não encontrada.' };
    const { error, data } = await supabase.from('businesses').update({
      ...row,
      logo_path: firstImage(fd.get('logo'), uid, cur.logo_path),
      cover_path: firstImage(fd.get('cover'), uid, cur.cover_path),
    }).eq('id', id).select('slug');
    if (error || !data?.length) return { error: friendlyError(error, 'Sem permissão para editar esta empresa.') };
    revalidatePath(`/business/${cur.slug}`);
    redirect(`/business/${cur.slug}`);
  }

  const base = slugify(row.name) || 'empresa';
  // Empresas ocultas pela moderação não são visíveis, então o endereço livre é descoberto
  // tentando gravar: em caso de endereço repetido (23505), tenta com um sufixo.
  let slug = base.length >= 3 ? base : `${base}-club`;
  let error = null;
  for (let i = 0; i < 5; i++) {
    ({ error } = await supabase.from('businesses').insert({
      ...row, slug, owner_id: uid,
      logo_path: firstImage(fd.get('logo'), uid),
      cover_path: firstImage(fd.get('cover'), uid),
    }));
    if (!error || error.code !== '23505') break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  if (error) return { error: friendlyError(error) };
  revalidatePath('/business');
  redirect(`/business/${slug}?nova=1`);
}

export async function deleteBusiness(id: string) {
  const { supabase } = await session();
  const { error, data } = await supabase.from('businesses').delete().eq('id', id).select('id');
  if (error || !data?.length) return { error: friendlyError(error, 'Somente a responsável pode excluir a empresa.') };
  revalidatePath('/business');
  redirect('/perfil?aba=empresas');
}

const offeringSchema = z.object({
  kind: z.enum(['product', 'service']),
  name: z.string().trim().min(2, 'Dê um nome ao item.').max(80),
  description: z.string().trim().max(400).optional(),
  price_text: z.string().trim().max(40).optional(),
});

export async function addOffering(businessId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await session();
  const parsed = offeringSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { error } = await supabase.from('business_offerings').insert({
    business_id: businessId, kind: parsed.data.kind, name: parsed.data.name,
    description: parsed.data.description || null, price_text: parsed.data.price_text || null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath('/business', 'layout');
  return { ok: true, message: 'Item adicionado.' };
}

export async function deleteOffering(id: string): Promise<ActionResult> {
  const { supabase } = await session();
  const { error, data } = await supabase.from('business_offerings').delete().eq('id', id).select('id');
  revalidatePath('/business', 'layout');
  return error || !data?.length ? { error: friendlyError(error, 'Sem permissão.') } : { ok: true };
}

export async function addGallery(businessId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase, uid } = await session();
  let items: { path: string; width: number; height: number }[] = [];
  try { items = JSON.parse(String(fd.get('gallery') || '[]')); } catch {}
  items = items.filter((m) => ownsPath(uid, m.path)).slice(0, 12);
  if (!items.length) return { error: 'Escolha ao menos uma foto.' };
  const { data: last } = await supabase.from('business_media').select('position').eq('business_id', businessId).order('position', { ascending: false }).limit(1);
  const start = (last?.[0]?.position ?? -1) + 1;
  const { error } = await supabase.from('business_media').insert(items.map((m, i) => ({ business_id: businessId, path: m.path, width: m.width, height: m.height, position: start + i })));
  if (error) return { error: friendlyError(error) };
  revalidatePath('/business', 'layout');
  return { ok: true, message: 'Galeria atualizada.' };
}

export async function removeGallery(id: string): Promise<ActionResult> {
  const { supabase } = await session();
  const { error, data } = await supabase.from('business_media').delete().eq('id', id).select('id');
  revalidatePath('/business', 'layout');
  return error || !data?.length ? { error: friendlyError(error, 'Sem permissão.') } : { ok: true };
}

export async function addBusinessAdmin(businessId: string, _: ActionResult, fd: FormData): Promise<ActionResult> {
  const { supabase } = await session();
  const handle = String(fd.get('handle') || '').trim().replace(/^@/, '').toLowerCase();
  const { data: p } = await supabase.from('profiles').select('id').eq('handle', handle).maybeSingle();
  if (!p) return { error: 'Não encontramos uma integrante com esse @.' };
  const { error } = await supabase.from('business_admins').insert({ business_id: businessId, member_id: p.id, role: 'admin' });
  if (error) return { error: error.code === '23505' ? 'Ela já administra esta empresa.' : friendlyError(error, 'Somente a responsável adiciona administradoras.') };
  revalidatePath('/business', 'layout');
  return { ok: true, message: 'Administradora adicionada.' };
}

export async function removeBusinessAdmin(businessId: string, memberId: string): Promise<ActionResult> {
  const { supabase } = await session();
  const { error, data } = await supabase.from('business_admins').delete().eq('business_id', businessId).eq('member_id', memberId).select('member_id');
  revalidatePath('/business', 'layout');
  return error || !data?.length ? { error: friendlyError(error, 'Sem permissão.') } : { ok: true };
}
