'use client';
import { useActionState, useTransition } from 'react';
import { createPoll, deleteBookMonth, deleteCoupon, deletePoll, resolvePoll, saveBookMonth, saveClubBook, saveCoupon } from '@/actions/admin-books';
import { Form } from '@/components/ui/form';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Button } from '@/components/ui/button';
import { ImagePicker } from '@/components/image-picker';
import { toast } from '@/components/ui/toaster';
import type { ActionResult, Book } from '@/lib/types';

type Opt = { id: string; label: string };
const run = (start: (cb: () => Promise<void>) => void, fn: () => Promise<ActionResult>) =>
  start(async () => { const r = await fn(); toast(r?.error || r?.message || 'Feito', r?.error ? 'error' : 'ok'); });

export function ClubBookForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(saveClubBook.bind(null, null), null);
  return (
    <Form action={action} className="grid gap-3 md:grid-cols-2">
      <Field label="Título"><Input name="title" required maxLength={160} /></Field>
      <Field label="Autora ou autor"><Input name="author" maxLength={120} /></Field>
      <div className="md:col-span-2"><span className="mb-1.5 block text-[13px] font-semibold">Capa</span><ImagePicker userId={userId} name="cover" max={1} label="Capa" /></div>
      <div className="flex flex-wrap items-center gap-2 md:col-span-2"><FormMessage state={state} /><SubmitButton>Adicionar ao catálogo</SubmitButton></div>
    </Form>
  );
}

export function MonthForm({ books, events, defaultMonth, current }: {
  books: Book[]; events: Opt[]; defaultMonth: string;
  current?: { id: string; month: string; book_id: string; note: string | null; meeting_event_id: string | null };
}) {
  const [state, action] = useActionState(saveBookMonth, null);
  const [pending, start] = useTransition();
  return (
    <Form action={action} className="grid gap-3 md:grid-cols-2">
      <Field label="Mês"><Input type="month" name="month" required defaultValue={current?.month.slice(0, 7) || defaultMonth} readOnly={!!current} /></Field>
      <Field label="Livro"><Select name="book_id" required defaultValue={current?.book_id || ''}>
        <option value="" disabled>Escolha no catálogo</option>
        {books.map((b) => <option key={b.id} value={b.id}>{b.title}{b.author ? ` · ${b.author}` : ''}</option>)}
      </Select></Field>
      <Field label="Encontro sobre o livro" hint="Crie o evento em Eventos e escolha aqui. Quem vai ler recebe o aviso." className="md:col-span-2">
        <Select name="meeting_event_id" defaultValue={current?.meeting_event_id || ''}>
          <option value="">Ainda sem data</option>
          {events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </Select>
      </Field>
      <Field label="Por que este livro (opcional)" className="md:col-span-2"><Textarea name="note" maxLength={1000} rows={3} defaultValue={current?.note || ''} /></Field>
      <div className="flex flex-wrap items-center gap-2 md:col-span-2">
        <FormMessage state={state} /><SubmitButton>{current ? 'Salvar mês' : 'Definir livro do mês'}</SubmitButton>
        {current && <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(start, () => deleteBookMonth(current.id))}>Remover mês</Button>}
      </div>
    </Form>
  );
}

export function PollForm({ books, defaults }: { books: Book[]; defaults: { target: string; opens: string; closes: string } }) {
  const [state, action] = useActionState(createPoll, null);
  return (
    <Form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Livro de qual mês" className="sm:col-span-2"><Input type="month" name="target_month" required defaultValue={defaults.target} /></Field>
      <Field label="Abre em"><Input type="date" name="opens_on" required defaultValue={defaults.opens} /></Field>
      <Field label="Fecha em" hint="Penúltima semana do mês"><Input type="date" name="closes_on" required defaultValue={defaults.closes} /></Field>
      {[1, 2, 3].map((n) => (
        <Field key={n} label={`Opção ${n}`} className="sm:col-span-2"><Select name={`option${n}`} required defaultValue="">
          <option value="" disabled>Escolha no catálogo</option>
          {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </Select></Field>
      ))}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><FormMessage state={state} /><SubmitButton>Criar votação</SubmitButton></div>
    </Form>
  );
}

export function PollAdminActions({ pollId, options, canResolve }: { pollId: string; options: Book[]; canResolve: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {canResolve && options.map((b) => (
        <Button key={b.id} size="sm" variant="secondary" disabled={pending} onClick={() => run(start, () => resolvePoll(pollId, b.id))}>Escolher “{b.title}”</Button>
      ))}
      <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(start, () => deletePoll(pollId))}>Excluir votação</Button>
    </div>
  );
}

export function CouponForm({ books, businesses, defaults }: { books: Book[]; businesses: Opt[]; defaults: { book: string; starts: string } }) {
  const [state, action] = useActionState(saveCoupon, null);
  return (
    <Form action={action} className="grid gap-3 md:grid-cols-2">
      <Field label="Livro"><Select name="book_id" required defaultValue={defaults.book}>
        <option value="" disabled>Escolha no catálogo</option>
        {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
      </Select></Field>
      <Field label="Loja"><Input name="store" required maxLength={80} placeholder="Ex.: Livraria parceira" /></Field>
      <Field label="Código do cupom"><Input name="code" required maxLength={40} autoCapitalize="characters" /></Field>
      <Field label="Link para comprar (opcional)"><Input name="url" type="url" placeholder="https://" /></Field>
      <Field label="Empresa do clube (opcional)" hint="Se a loja for de uma integrante"><Select name="business_id" defaultValue="">
        <option value="">Nenhuma</option>
        {businesses.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
      </Select></Field>
      <Field label="Detalhe (opcional)"><Input name="details" maxLength={300} placeholder="Ex.: 15% de desconto no livro impresso" /></Field>
      <Field label="Aparece a partir de" hint="Última semana do mês"><Input type="date" name="starts_on" required defaultValue={defaults.starts} /></Field>
      <Field label="Válido até (opcional)"><Input type="date" name="valid_until" /></Field>
      <div className="flex flex-wrap items-center gap-2 md:col-span-2"><FormMessage state={state} /><SubmitButton>Criar cupom</SubmitButton></div>
    </Form>
  );
}

export function DeleteCouponButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <Button size="sm" variant="ghost" className="text-danger" disabled={pending} onClick={() => run(start, () => deleteCoupon(id))}>Remover</Button>;
}
