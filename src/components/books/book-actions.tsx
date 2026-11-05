'use client';
import { useState, useTransition } from 'react';
import clsx from 'clsx';
import { BookOpenCheck, Check, Copy } from 'lucide-react';
import { setBookReader, voteBook } from '@/actions/books';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { BookCover } from '@/components/books/book-cover';
import type { Book } from '@/lib/types';

export function ReadButton({ monthId, joined }: { monthId: string; joined: boolean }) {
  const [pending, start] = useTransition();
  const toggle = (join: boolean) => start(async () => {
    const r = await setBookReader(monthId, join);
    toast(r?.error || r?.message || 'Feito', r?.error ? 'error' : 'ok');
  });
  if (joined) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex h-12 items-center gap-2 rounded-full bg-olive/15 px-5 text-[15px] font-semibold text-olive-ink"><BookOpenCheck className="h-5 w-5" />Você vai ler este livro</span>
        <button type="button" disabled={pending} onClick={() => toggle(false)} className="text-[13px] text-muted underline-offset-2 hover:underline">Sair do clube deste mês</button>
      </div>
    );
  }
  return <Button full disabled={pending} onClick={() => toggle(true)}>Vou ler esse livro!</Button>;
}

export function PollVote({ pollId, options, myVote }: { pollId: string; options: Book[]; myVote: string | null }) {
  const [vote, setVote] = useState(myVote);
  const [pending, start] = useTransition();
  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map((b) => {
        const mine = vote === b.id;
        return (
          <button key={b.id} type="button" disabled={pending} aria-pressed={mine}
            onClick={() => start(async () => {
              const r = await voteBook(pollId, b.id);
              if (!r?.error) setVote(b.id);
              toast(r?.error || r?.message || 'Feito', r?.error ? 'error' : 'ok');
            })}
            className={clsx('group flex flex-col gap-2 rounded-2xl p-2 text-left ring-1 transition', mine ? 'bg-burgundy/5 ring-2 ring-burgundy' : 'bg-paper ring-line hover:ring-dusty')}>
            <BookCover book={b} />
            <span className="line-clamp-2 text-[13px] leading-tight font-semibold">{b.title}</span>
            {b.author && <span className="-mt-1 line-clamp-1 text-[12px] text-muted">{b.author}</span>}
            <span className={clsx('mt-auto inline-flex h-8 items-center justify-center gap-1 rounded-full text-[12px] font-semibold', mine ? 'bg-burgundy text-ivory' : 'bg-ivory text-burgundy')}>
              {mine ? <><Check className="h-3.5 w-3.5" />Seu voto</> : 'Votar'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
      catch { toast('Não foi possível copiar. Selecione o código e copie.', 'error'); }
    }} className="inline-flex h-11 items-center gap-2 rounded-xl border border-dashed border-burgundy bg-paper px-4 font-mono text-[16px] font-semibold tracking-wider text-burgundy select-all">
      {code}{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      <span className="sr-only">{copied ? 'Código copiado' : 'Copiar código'}</span>
    </button>
  );
}
