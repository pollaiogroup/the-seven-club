'use client';
import { Form } from '@/components/ui/form';
import { useActionState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { addBusinessAdmin, addGallery, addOffering, deleteOffering, removeBusinessAdmin, removeGallery, saveBusiness } from '@/actions/business';
import type { BusinessPage } from '@/lib/types';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { ImagePicker } from '@/components/image-picker';
import { Avatar } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toaster';
import { mediaUrl } from '@/lib/media';

type Cat = { id: number; name: string };

export function BusinessForm({ userId, categories, business }: { userId: string; categories: Cat[]; business?: BusinessPage }) {
  const [state, action] = useActionState(saveBusiness.bind(null, business?.id ?? null), null);
  const img = (p?: string | null) => (p ? [{ path: p, width: 1, height: 1 }] : []);
  return (
    <Form action={action} className="space-y-5">
      <div className="grid grid-cols-[auto_1fr] gap-4">
        <div><span className="mb-1.5 block text-[13px] font-semibold">Logo</span><ImagePicker userId={userId} name="logo" max={1} square label="Logo" initial={img(business?.logo_path)} /></div>
        <div><span className="mb-1.5 block text-[13px] font-semibold">Capa</span><ImagePicker userId={userId} name="cover" max={1} label="Capa" initial={img(business?.cover_path)} /></div>
      </div>
      <Field label="Nome da empresa"><Input name="name" required maxLength={80} defaultValue={business?.name} /></Field>
      <Field label="Frase de apresentação" hint="Aparece embaixo do nome. Ex.: Estúdio criativo"><Input name="tagline" maxLength={120} defaultValue={business?.tagline || ''} /></Field>
      <Field label="Categoria">
        <Select name="category_id" required defaultValue={business?.category_id || ''}>
          <option value="" disabled>Escolha</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Sobre"><Textarea name="description" maxLength={2000} defaultValue={business?.description || ''} placeholder="O que a empresa faz, para quem e o que a torna especial." /></Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="WhatsApp" hint="DDD + número"><Input name="whatsapp" inputMode="tel" autoComplete="tel" defaultValue={business?.whatsapp?.replace(/^55/, '') || ''} placeholder="11 99999-9999" /></Field>
        <Field label="Instagram"><Input name="instagram" autoCapitalize="none" defaultValue={business?.instagram ? `@${business.instagram}` : ''} placeholder="@empresa" /></Field>
        <Field label="Site"><Input name="website" inputMode="url" autoCapitalize="none" defaultValue={business?.website || ''} placeholder="www.empresa.com.br" /></Field>
        <Field label="Cidade"><Input name="city" defaultValue={business?.city || ''} /></Field>
      </div>
      <Field label="Endereço" hint="Opcional. Aparece com link para o mapa."><Input name="address" autoComplete="street-address" defaultValue={business?.address || ''} /></Field>
      <Field label="Área de atendimento" hint="Ex.: São Paulo e região, todo o Brasil, online"><Input name="service_area" defaultValue={business?.service_area || ''} /></Field>
      <FormMessage state={state} />
      <SubmitButton full size="lg">{business ? 'Salvar alterações' : 'Cadastrar empresa'}</SubmitButton>
    </Form>
  );
}

export function OfferingsManager({ business }: { business: BusinessPage }) {
  const [state, action] = useActionState(addOffering.bind(null, business.id), null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line rounded-2xl bg-paper ring-1 ring-line">
        {business.offerings.length === 0 && <li className="px-4 py-4 text-[14px] text-muted">Nenhum produto ou serviço ainda.</li>}
        {business.offerings.map((o) => (
          <li key={o.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">{o.name} <span className="text-[12px] font-normal text-muted">· {o.kind === 'product' ? 'Produto' : 'Serviço'}</span></p>
              {(o.price_text || o.description) && <p className="truncate text-[13px] text-muted">{[o.price_text, o.description].filter(Boolean).join(' · ')}</p>}
            </div>
            <button disabled={pending} aria-label={`Remover ${o.name}`} onClick={() => start(async () => { const r = await deleteOffering(o.id); if (r?.error) toast(r.error, 'error'); })} className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-danger"><Trash2 className="h-5 w-5" /></button>
          </li>
        ))}
      </ul>
      <Form action={action} className="space-y-3 rounded-2xl bg-paper p-4 ring-1 ring-line">
        <p className="text-[14px] font-semibold">Adicionar item</p>
        <div className="flex gap-2">
          {(['product', 'service'] as const).map((k) => (
            <label key={k} className="flex-1">
              <input type="radio" name="kind" value={k} defaultChecked={k === 'service'} className="peer sr-only" />
              <span className="block rounded-full py-2 text-center text-[13px] ring-1 ring-line peer-checked:bg-burgundy peer-checked:text-ivory peer-checked:ring-burgundy">{k === 'product' ? 'Produto' : 'Serviço'}</span>
            </label>
          ))}
        </div>
        <Input name="name" placeholder="Nome" required maxLength={80} />
        <Input name="price_text" placeholder="Preço (opcional). Ex.: a partir de R$ 150" maxLength={40} />
        <Textarea name="description" placeholder="Descrição curta (opcional)" maxLength={400} className="min-h-20" />
        <FormMessage state={state} />
        <SubmitButton size="sm" variant="secondary">Adicionar</SubmitButton>
      </Form>
    </div>
  );
}

export function GalleryManager({ business, userId }: { business: BusinessPage; userId: string }) {
  const [state, action] = useActionState(addGallery.bind(null, business.id), null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      {business.media.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {business.media.map((m) => (
            <div key={m.id} className="relative aspect-square overflow-hidden rounded-xl bg-dusty-soft">
              <img src={mediaUrl(m.path)!} alt="" className="h-full w-full object-cover" loading="lazy" />
              <button disabled={pending} aria-label="Remover foto" onClick={() => start(async () => { const r = await removeGallery(m.id); if (r?.error) toast(r.error, 'error'); })}
                className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-espresso/70 text-white"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      <Form action={action} key={business.media.length} className="space-y-3">
        <ImagePicker userId={userId} name="gallery" max={8} />
        <FormMessage state={state} />
        <SubmitButton size="sm" variant="secondary">Adicionar à galeria</SubmitButton>
      </Form>
    </div>
  );
}

export function AdminsManager({ business }: { business: BusinessPage }) {
  const [state, action] = useActionState(addBusinessAdmin.bind(null, business.id), null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {business.admins.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            <Avatar name={a.full_name} path={a.avatar_path} size={36} />
            <span className="flex-1 text-[14px]">{a.full_name} <span className="text-muted">· {a.role === 'owner' ? 'Responsável' : 'Administradora'}</span></span>
            {a.role !== 'owner' && business.is_owner && (
              <button disabled={pending} onClick={() => start(async () => { const r = await removeBusinessAdmin(business.id, a.id); if (r?.error) toast(r.error, 'error'); })} className="text-[13px] text-danger">Remover</button>
            )}
          </li>
        ))}
      </ul>
      {business.is_owner && (
        <Form action={action} className="flex gap-2">
          <Input name="handle" placeholder="@ da integrante" autoCapitalize="none" required />
          <SubmitButton size="md" variant="secondary">Adicionar</SubmitButton>
        </Form>
      )}
      <FormMessage state={state} />
    </div>
  );
}
