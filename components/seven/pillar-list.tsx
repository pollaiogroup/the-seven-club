'use client';
import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';
import clsx from 'clsx';
import { Check, ChevronRight } from 'lucide-react';
import type { Pillar } from '@/lib/types';
import { quickToggle } from '@/actions/seven';
import { toast } from '@/components/ui/toaster';
import { PillarGlyph } from './pillar-glyph';

export function PillarList({ pillars }: { pillars: Pillar[] }) {
  const [, start] = useTransition();
  const [state, setOptimistic] = useOptimistic(pillars.map((p) => ({ id: p.id, done: !!p.check_in?.completed_at })), (cur, upd: { id: number; done: boolean }) => cur.map((c) => (c.id === upd.id ? upd : c)));
  return (
    <ul className="divide-y divide-line rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
      {pillars.map((p) => {
        const done = state.find((s) => s.id === p.id)?.done;
        return (
          <li key={p.id} className="flex items-center gap-3 pr-2 pl-3">
            <Link href={`/seven/${p.slug}`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
              <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', done ? 'bg-burgundy text-ivory' : 'bg-dusty-soft text-burgundy')}>
                <PillarGlyph slug={p.slug} />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[14px] font-bold tracking-wide">{p.name}</span>
                <span className="block truncate text-[13px] text-muted">{p.prompt}</span>
              </span>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-taupe" />
            </Link>
            <button
              aria-label={done ? `Desmarcar ${p.name}` : `Marcar ${p.name} como concluído`}
              aria-pressed={done}
              onClick={() => start(async () => {
                setOptimistic({ id: p.id, done: !done });
                const r = await quickToggle(p.id, !done);
                if (r?.error) toast(r.error, 'error');
              })}
              className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition', done ? 'text-burgundy' : 'text-taupe')}>
              <span className={clsx('flex h-7 w-7 items-center justify-center rounded-full ring-2', done ? 'bg-burgundy ring-burgundy' : 'ring-taupe')}>
                {done && <Check className="h-4 w-4 text-ivory" strokeWidth={3} />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
