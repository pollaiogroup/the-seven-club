'use client';
import { useActionState, useState, useTransition } from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { deleteLibraryEntry, saveLibraryEntry } from '@/actions/books';
import { Form } from '@/components/ui/form';
import { Field, FormMessage, Input, Textarea } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Button } from '@/components/ui/button';
import { ImagePicker } from '@/components/image-picker';
import { toast } from '@/components/ui/toaster';
import { BookCover } from '@/components/books/book-cover';
import { StarInput } from '@/components/books/stars';
import type { Book, LibraryEntry } from '@/lib/types';

/** Registrar livro lido: escolhe um livro do clube ou cadastra outro, com estrelas de 1 a 7 e comentário. */
export function LibraryForm({ userId, clubBooks, entry }: { userId: string; clubBooks: Book[]; entry?: LibraryEntry }) {
  const [state, action] = useActionState(saveLibraryEntry.bind(null, entry?.id ?? null), null);
  const [mode, setMode] = useState<'club' | 'other'>(clubBooks.length ? 'club' : 'other');
  const [picked, setPicked] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Form action={action} className="space-y-6">
      {entry ? (
        <div className="flex items-center gap-4">
          <BookCover book={entry.book} className="w-20 shrink-0" />
          <div><p className="text-[18px] leading-tight font-semibold">{entry.book.title}</p>{entry.book.author && <p className="text-[14px] text-muted">{entry.book.author}</p>}</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div role="tablist" className="grid grid-cols-2 gap-2 rounded-full bg-paper p-1 ring-1 ring-line">
            {([['club', 'Livro do clube'], ['other', 'Outro livro']] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                className={clsx('h-10 rounded-full text-[14px] font-semibold transition', mode === k ? 'bg-burgundy text-ivory' : 'text-espresso')}>{l}</button>
            ))}
          </div>
          {mode === 'club' ? (
            clubBooks.length ? (
              <div>
                <input type="hidden" name="book_id" value={picked || ''} />
                <ul className="grid grid-cols-3 gap-3">
                  {clubBooks.map((b) => (
                    <li key={b.id}>
                      <button type="button" aria-pressed={picked === b.id} onClick={() => setPicked(b.id)}
                        className={clsx('relative w-full rounded-xl p-1.5 text-left ring-1 transition', picked === b.id ? 'ring-2 ring-burgundy' : 'ring-transparent')}>
                        <BookCover book={b} />
                        {picked === b.id && <span className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-burgundy text-ivory"><Check className="h-4 w-4" /></span>}
                        <span className="mt-1.5 line-clamp-2 block text-[12px] leading-tight font-semibold">{b.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="text-[14px] text-muted">O clube ainda não leu nenhum livro. Cadastre outro livro.</p>
          ) : (
            <div className="space-y-4">
              <Field label="Título"><Input name="title" required maxLength={160} autoComplete="off" /></Field>
              <Field label="Autora ou autor"><Input name="author" maxLength={120} autoComplete="off" /></Field>
              <div><span className="mb-1.5 block text-[13px] font-semibold">Capa (opcional)</span><ImagePicker userId={userId} name="cover" max={1} label="Foto da capa" /></div>
            </div>
          )}
        </div>
      )}

      <div><span className="mb-1.5 block text-[13px] font-semibold">Sua avaliação</span><StarInput name="rating" defaultValue={entry?.rating ?? 0} /></div>
      <Field label="Quando terminou (opcional)"><Input type="month" name="finished_on" defaultValue={entry?.finished_on?.slice(0, 7) || ''} className="max-w-[220px]" /></Field>
      <Field label="Comentário (opcional)" hint="Aparece quando alguém abre este livro na sua estante.">
        <Textarea name="review" maxLength={2000} rows={5} defaultValue={entry?.review || ''} placeholder="O que ficou com você depois desta leitura?" />
      </Field>

      <div className="space-y-3">
        <FormMessage state={state} />
        <SubmitButton full pendingText="Salvando…">{entry ? 'Salvar alterações' : 'Registrar na minha biblioteca'}</SubmitButton>
        {entry && (
          <Button type="button" variant="ghost" full className="text-danger" disabled={pending}
            onClick={() => start(async () => { const r = await deleteLibraryEntry(entry.id); if (r?.error) toast(r.error, 'error'); })}>
            Tirar da biblioteca
          </Button>
        )}
      </div>
    </Form>
  );
}
