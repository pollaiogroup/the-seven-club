import Link from 'next/link';
import { Quote } from 'lucide-react';
import type { Affirmation } from '@/lib/types';
import { THEMES } from '@/lib/labels';

/** Destaque da afirmação do dia no topo do Feed. */
export function AffirmationTeaser({ affirmation }: { affirmation: Affirmation | null }) {
  if (!affirmation) return null;
  return (
    <Link href="/afirmacoes" className="block rounded-[22px] bg-burgundy-soft/70 px-5 py-4 ring-1 ring-dusty/25 transition hover:bg-burgundy-soft">
      <div className="flex items-center gap-2 text-[12px] text-dusty">
        <Quote className="h-4 w-4 fill-dusty" />
        <span className="font-semibold tracking-wide">Afirmação do dia</span>
        <span className="ml-auto">{THEMES[affirmation.theme]}</span>
      </div>
      <p className="font-display mt-2 text-center text-[19px] leading-snug text-ivory italic">“{affirmation.text}”</p>
    </Link>
  );
}
