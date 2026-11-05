'use client';
import { Form } from '@/components/ui/form';
import { useActionState, useState, useTransition } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  broadcast, createInvite, deleteCategory, deleteEvent, importAffirmations, moderateTarget, resolveReport, revokeInvite,
  saveAffirmation, saveCategory, saveEvent, saveSetting, scheduleAffirmation, setFeatured, updateMember,
} from '@/actions/admin';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Button, buttonClass } from '@/components/ui/button';
import { ImagePicker } from '@/components/image-picker';
import { toast } from '@/components/ui/toaster';
import { EVENT_KINDS, MEMBERSHIP_STATUS, ROLES, THEMES } from '@/lib/labels';
import { toLocalInput } from '@/lib/format';
import type { ActionResult } from '@/lib/types';

const run = (start: (cb: () => Promise<void>) => void, fn: () => Promise<ActionResult>) =>
  start(async () => { const r = await fn(); toast(r?.error || r?.message || 'Feito', r?.error ? 'error' : 'ok'); });

export function InviteForm({ superAdmin }: { superAdmin: boolean }) {
  const [state, action] = useActionState(createInvite, null);
  return (
    <Form action={action} className="grid gap-3 md:grid-cols-2">
      <Field label="E-mail da convidada"><Input name="email" type="email" required inputMode="email" autoCapitalize="none" /></Field>
      <Field label="Papel">
        <Select name="role" defaultValue="member">
          {Object.entries(ROLES).filter(([k]) => superAdmin || (k !== 'admin' && k !== 'super_admin')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Plano"><Input name="plan" defaultValue="fundadora" required /></Field>
      <Field label="Validade do link (dias)"><Input name="days" type="number" min={1} max={90} defaultValue={14} /></Field>
      <Field label="Observação interna" className="md:col-span-2"><Input name="note" maxLength={200} placeholder="Ex.: indicada pela Larissa" /></Field>
      <div className="space-y-3 md:col-span-2"><FormMessage state={state} /><SubmitButton>Criar convite</SubmitButton></div>
    </Form>
  );
}

export function InviteActions({ id, link, active, message }: { id: string; link: string; active: boolean; message: string }) {
  const [copied, setCopied] = useState<'' | 'link' | 'msg'>('');
  const [pending, start] = useTransition();
  if (!active) return null;
  const copy = async (text: string, what: 'link' | 'msg') => { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1800); };
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => copy(link, 'link')}>
        {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === 'link' ? 'Copiado' : 'Copiar link'}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => copy(message, 'msg')}>
        {copied === 'msg' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === 'msg' ? 'Copiada' : 'Copiar mensagem'}
      </Button>
      <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>WhatsApp</a>
      <Button size="sm" variant="ghost" disabled={pending} className="text-danger" onClick={() => { if (confirm('Revogar este convite?')) run(start, () => revokeInvite(id)); }}>Revogar</Button>
    </div>
  );
}

type MemberRow = { id: string; role: string; status: string; membership: { id: string; plan: string; status: string; ends_at: string | null } | null };

export function MemberEditor({ m, superAdmin, isMe }: { m: MemberRow; superAdmin: boolean; isMe: boolean }) {
  const [state, action] = useActionState(updateMember.bind(null, m.id), null);
  const lockRole = isMe || (!superAdmin && (m.role === 'admin' || m.role === 'super_admin'));
  return (
    <Form action={action} className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <input type="hidden" name="membership_id" value={m.membership?.id || ''} />
      {lockRole && <><input type="hidden" name="role" value={m.role} /><input type="hidden" name="status" value={m.status} /></>}
      <Select name="role" defaultValue={m.role} disabled={lockRole} aria-label="Papel" className="!h-10 text-[14px]">
        {Object.entries(ROLES).filter(([k]) => superAdmin || (k !== 'admin' && k !== 'super_admin') || k === m.role).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
      <Select name="status" defaultValue={m.status} disabled={lockRole} aria-label="Acesso" className="!h-10 text-[14px]">
        <option value="active">Acesso ativo</option><option value="suspended">Suspensa</option>
      </Select>
      <Input name="plan" defaultValue={m.membership?.plan || 'fundadora'} aria-label="Plano" className="!h-10 text-[14px]" />
      <Select name="membership_status" defaultValue={m.membership?.status || 'active'} aria-label="Assinatura" className="!h-10 text-[14px]">
        {Object.entries(MEMBERSHIP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Select>
      <div className="col-span-2 flex min-w-0 items-center gap-2">
        <Input name="ends_at" type="date" defaultValue={m.membership?.ends_at || ''} aria-label="Fim da assinatura" className="!h-10 min-w-0 text-[14px]" />
        <SubmitButton size="sm" pendingText="…">Salvar</SubmitButton>
      </div>
      {(state?.error || state?.message) && <div className="col-span-2 md:col-span-6"><FormMessage state={state} /></div>}
    </Form>
  );
}

export function ModerationActions({ report }: { report: { id: string; target_type: string; target_id: string; status: string; preview: { hidden: boolean } | null } }) {
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const label = report.target_type === 'member' ? (report.preview?.hidden ? 'Reativar integrante' : 'Suspender integrante') : report.preview?.hidden ? 'Reexibir' : 'Ocultar conteúdo';
  return (
    <div className="mt-3 space-y-2">
      {report.preview && (
        <Button size="sm" variant={report.preview.hidden ? 'secondary' : 'danger'} disabled={pending}
          onClick={() => { if (confirm(`${label}?`)) run(start, () => moderateTarget(report.target_type, report.target_id, !report.preview!.hidden)); }}>{label}</Button>
      )}
      {report.status === 'open' && (
        <div className="flex flex-wrap gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota da resolução (opcional)" className="!h-10 min-w-48 flex-1 text-[14px]" />
          <Button size="sm" disabled={pending} onClick={() => run(start, () => resolveReport(report.id, 'actioned', note))}>Resolver</Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(start, () => resolveReport(report.id, 'dismissed', note))}>Descartar</Button>
        </div>
      )}
    </div>
  );
}

export function AffirmationForm({ a }: { a?: { id: string; text: string; theme: string; status: string } }) {
  const [state, action] = useActionState(saveAffirmation.bind(null, a?.id ?? null), null);
  return (
    <Form action={action} className="space-y-3">
      <Textarea name="text" required minLength={10} maxLength={220} defaultValue={a?.text} placeholder="Eu..." className="min-h-20" />
      <div className="flex flex-wrap gap-2">
        <Select name="theme" defaultValue={a?.theme || ''} required className="!h-10 flex-1 text-[14px]" aria-label="Tema">
          <option value="" disabled>Tema</option>
          {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select name="status" defaultValue={a?.status || 'published'} className="!h-10 flex-1 text-[14px]" aria-label="Status">
          <option value="published">Publicada</option><option value="draft">Rascunho</option><option value="archived">Arquivada</option>
        </Select>
        <SubmitButton size="sm">{a ? 'Salvar' : 'Adicionar'}</SubmitButton>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}

export function AffirmationImport() {
  const [state, action] = useActionState(importAffirmations, null);
  return (
    <Form action={action} className="space-y-3">
      <Textarea name="lines" placeholder={'Uma afirmação por linha\nEu confio no meu caminho.\nEu sou capaz de...'} className="min-h-32" />
      <div className="flex flex-wrap items-center gap-3">
        <Select name="theme" required defaultValue="" className="!h-10 flex-1 text-[14px]" aria-label="Tema">
          <option value="" disabled>Tema de todas as linhas</option>
          {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="publish" defaultChecked className="h-4 w-4 accent-[#450B18]" />Publicar já</label>
        <SubmitButton size="sm" variant="secondary">Importar</SubmitButton>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}

export function ScheduleForm({ options, minDay }: { options: { id: string; text: string }[]; minDay: string }) {
  const [state, action] = useActionState(scheduleAffirmation, null);
  return (
    <Form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input type="date" name="day" min={minDay} required className="!h-10 w-44 text-[14px]" aria-label="Dia" />
        <Select name="affirmation_id" required defaultValue="" className="!h-10 min-w-0 flex-1 text-[14px]" aria-label="Afirmação">
          <option value="" disabled>Escolha a afirmação</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.text}</option>)}
        </Select>
        <SubmitButton size="sm">Agendar</SubmitButton>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}

type Ev = { id: string; title: string; kind: string; starts_at: string; ends_at: string | null; location: string | null; online_url: string | null; capacity: number | null; description: string | null; cover_path: string | null; show_attendees: boolean; published: boolean };

export function EventForm({ e, userId }: { e?: Ev; userId: string }) {
  const [state, action] = useActionState(saveEvent.bind(null, e?.id ?? null), null);
  const [pending, start] = useTransition();
  return (
    <Form action={action} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="current_cover" value={e?.cover_path || ''} />
      <Field label="Título" className="md:col-span-2"><Input name="title" required defaultValue={e?.title} maxLength={120} /></Field>
      <Field label="Tipo"><Select name="kind" defaultValue={e?.kind || 'presencial'}>{Object.entries(EVENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      <Field label="Vagas" hint="Deixe vazio para ilimitado"><Input name="capacity" type="number" min={1} defaultValue={e?.capacity ?? ''} /></Field>
      <Field label="Início (Brasília)"><Input name="starts_at" type="datetime-local" required defaultValue={toLocalInput(e?.starts_at ?? null)} /></Field>
      <Field label="Fim (Brasília)"><Input name="ends_at" type="datetime-local" defaultValue={toLocalInput(e?.ends_at ?? null)} /></Field>
      <Field label="Local" hint="Endereço, se presencial"><Input name="location" defaultValue={e?.location || ''} /></Field>
      <Field label="Link online" hint="Só inscritas veem"><Input name="online_url" type="url" defaultValue={e?.online_url || ''} placeholder="https://" /></Field>
      <Field label="Descrição" className="md:col-span-2"><Textarea name="description" defaultValue={e?.description || ''} maxLength={4000} /></Field>
      <div className="md:col-span-2"><span className="mb-1.5 block text-[13px] font-semibold">Capa</span><ImagePicker userId={userId} name="cover" max={1} label="Capa" initial={e?.cover_path ? [{ path: e.cover_path, width: 1, height: 1 }] : []} /></div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] md:col-span-2">
        <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={e?.published} className="h-4 w-4 accent-[#450B18]" />Publicado</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="show_attendees" defaultChecked={e?.show_attendees ?? true} className="h-4 w-4 accent-[#450B18]" />Mostrar quem vai</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="notify" className="h-4 w-4 accent-[#450B18]" />Avisar todas as integrantes</label>
      </div>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <FormMessage state={state} />
        <SubmitButton>{e ? 'Salvar evento' : 'Criar evento'}</SubmitButton>
        {e && <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm('Excluir o evento e as inscrições?')) run(start, () => deleteEvent(e.id)); }}>Excluir</Button>}
      </div>
    </Form>
  );
}

export function FeatureToggle({ id, featured }: { id: string; featured: boolean }) {
  const [pending, start] = useTransition();
  return <Button size="sm" variant={featured ? 'primary' : 'secondary'} disabled={pending} onClick={() => run(start, () => setFeatured(id, !featured))}>{featured ? 'Em destaque' : 'Destacar'}</Button>;
}

export function HideToggle({ type, id, hidden }: { type: string; id: string; hidden: boolean }) {
  const [pending, start] = useTransition();
  return <Button size="sm" variant="ghost" className={hidden ? '' : 'text-danger'} disabled={pending} onClick={() => run(start, () => moderateTarget(type, id, !hidden))}>{hidden ? 'Reexibir' : 'Ocultar'}</Button>;
}

export function CategoryForm({ c }: { c?: { id: number; name: string; slug: string; icon: string; sort: number } }) {
  const [state, action] = useActionState(saveCategory.bind(null, c?.id ?? null), null);
  const [pending, start] = useTransition();
  return (
    <Form action={action} className="flex flex-wrap items-center gap-2">
      <Input name="name" defaultValue={c?.name} placeholder="Nome" required className="!h-10 w-40 text-[14px]" />
      <Input name="slug" defaultValue={c?.slug} placeholder="endereco" required className="!h-10 w-36 text-[14px]" />
      <Select name="icon" defaultValue={c?.icon || 'shapes'} className="!h-10 w-36 text-[14px]">
        {['sparkles', 'heart-pulse', 'shopping-bag', 'chart-column', 'utensils', 'sun', 'cpu', 'graduation-cap', 'briefcase', 'shapes'].map((i) => <option key={i}>{i}</option>)}
      </Select>
      <Input name="sort" type="number" defaultValue={c?.sort ?? 99} className="!h-10 w-20 text-[14px]" aria-label="Ordem" />
      <SubmitButton size="sm" variant={c ? 'secondary' : 'primary'}>{c ? 'Salvar' : 'Adicionar'}</SubmitButton>
      {c && <Button type="button" size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(start, () => deleteCategory(c.id))}>Excluir</Button>}
      {(state?.error || state?.message) && <div className="w-full"><FormMessage state={state} /></div>}
    </Form>
  );
}

export function SettingForm({ k, value, multiline, label, hint }: { k: string; value: string; multiline?: boolean; label: string; hint?: string }) {
  const [state, action] = useActionState(saveSetting.bind(null, k), null);
  return (
    <Form action={action} className="space-y-3">
      <Field label={label} hint={hint}>{multiline ? <Textarea name="value" defaultValue={value} className="min-h-48" /> : <Input name="value" defaultValue={value} inputMode="url" placeholder="https://" />}</Field>
      <FormMessage state={state} />
      <SubmitButton size="sm">Salvar</SubmitButton>
    </Form>
  );
}

export function BroadcastForm() {
  const [state, action] = useActionState(broadcast, null);
  return (
    <Form action={action} className="space-y-3" onBeforeSubmit={() => confirm('Enviar este aviso para todas as integrantes ativas?')}>
      <Field label="Título"><Input name="title" maxLength={80} required /></Field>
      <Field label="Mensagem"><Textarea name="body" maxLength={240} required className="min-h-24" /></Field>
      <Field label="Abrir ao tocar (opcional)" hint="Página do app, ex.: /agenda"><Input name="link" placeholder="/agenda" /></Field>
      <FormMessage state={state} />
      <SubmitButton>Enviar aviso</SubmitButton>
    </Form>
  );
}
