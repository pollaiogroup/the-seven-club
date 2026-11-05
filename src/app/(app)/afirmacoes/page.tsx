import Link from 'next/link';
import clsx from 'clsx';
import { BellRing } from 'lucide-react';
import { requireMember } from '@/lib/auth';
import { rpc } from '@/lib/db';
import type { Affirmation } from '@/lib/types';
import { THEMES } from '@/lib/labels';
import { longDate, shortDate } from '@/lib/format';
import { SevenStar } from '@/components/ui/icons';
import { PageHeader, Sheet } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { AffirmationActions, FavoriteButton } from '@/components/affirmation/affirmation-actions';

export const metadata = { title: 'Afirmação do dia' };

export default async function Affirmations({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba = 'historico' } = await searchParams;
  await requireMember();
  const [today, list] = await Promise.all([
    rpc<Affirmation | null>('affirmation_today'),
    aba === 'favoritas' ? rpc<Affirmation[]>('affirmations_favorites') : rpc<Affirmation[]>('affirmations_history', { p_limit: 60 }),
  ]);
  const past = aba === 'favoritas' ? list : list.filter((x) => x.day !== today?.day);
  return (
    <>
      <PageHeader title="Afirmação do dia" back="/feed" />
      <div className="bg-burgundy px-5 pb-12 text-ivory">
        <div className="mx-auto max-w-xl">
          {today ? (
            <article className="relative overflow-hidden rounded-[28px] bg-burgundy-deep px-6 pt-10 pb-6 text-center ring-1 ring-dusty/20">
              <SevenStar className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 text-burgundy-soft/50" />
              <SevenStar className="relative mx-auto h-8 w-8 text-dusty" />
              <p className="relative mt-3 text-[12px] text-dusty">{longDate(today.day!)}</p>
              <p className="font-display relative mt-6 text-[28px] leading-snug italic">“{today.text}”</p>
              <p className="relative mt-5 text-[11px] tracking-brand text-dusty uppercase">{THEMES[today.theme]}</p>
              <div className="relative"><AffirmationActions a={today} /></div>
            </article>
          ) : (
            <p className="rounded-2xl bg-white/10 p-5 text-center text-[15px]">A biblioteca de afirmações ainda está sendo preparada pela curadoria do clube.</p>
          )}
          <Link href="/ajustes#notificacoes" className="mt-4 flex items-center justify-center gap-2 text-[13px] text-dusty"><BellRing className="h-4 w-4" />Escolher horário da notificação diária</Link>
        </div>
      </div>
      <Sheet className="pt-5">
        <nav className="flex gap-2 px-4">
          {[{ k: 'historico', l: 'Histórico' }, { k: 'favoritas', l: 'Favoritas' }].map((t) => (
            <Link key={t.k} href={`/afirmacoes?aba=${t.k}`} scroll={false} className={clsx('flex-1 rounded-full py-2.5 text-center text-[13px] font-semibold ring-1', aba === t.k ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper ring-line')}>{t.l}</Link>
          ))}
        </nav>
        {past.length === 0 ? (
          <EmptyState title={aba === 'favoritas' ? 'Nenhuma favorita ainda' : 'O histórico começa hoje'}>{aba === 'favoritas' ? 'Toque no coração para guardar as afirmações que mais tocam você.' : 'Cada dia, uma nova afirmação entra aqui.'}</EmptyState>
        ) : (
          <ul className="space-y-3 px-4 pt-4">
            {past.map((x) => (
              <li key={`${x.id}-${x.day}`} className="flex items-start gap-3 rounded-[var(--radius-card)] bg-paper p-4 ring-1 ring-line">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[17px] leading-snug text-espresso italic">“{x.text}”</p>
                  <p className="mt-2 text-[12px] text-muted">{THEMES[x.theme]}{x.day ? ` · ${shortDate(x.day)}` : ''}</p>
                </div>
                <FavoriteButton a={x} compact />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
