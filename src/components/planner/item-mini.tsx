import clsx from 'clsx';
import { ArrowRight, Check, Circle, X } from 'lucide-react';
import { pillarById, type PlannerItem } from '@/lib/planner';
import { InkPreview } from './ink-preview';
import { PillarDot } from './day-view';

/** Uma linha do planner em tamanho pequeno, para a semana e as páginas dos pilares. */
export function ItemMini({ item }: { item: PlannerItem }) {
  const p = pillarById(item.pillar_id);
  const Icon = item.status === 'done' ? Check : item.status === 'cancelled' ? X : item.status === 'moved' ? ArrowRight : Circle;
  return (
    <li className="flex min-h-[30px] items-center gap-2 border-b border-line/70 py-1 last:border-0">
      <Icon className={clsx('h-3.5 w-3.5 shrink-0', item.status === 'done' ? 'text-burgundy' : item.status === 'moved' ? 'text-olive' : item.status === 'cancelled' ? 'text-taupe' : 'text-line')} strokeWidth={3} />
      <span className={clsx('min-w-0 flex-1 truncate font-display text-[15px] italic', item.status === 'done' && 'text-muted line-through decoration-burgundy/60', item.status === 'cancelled' && 'text-taupe line-through', item.status === 'moved' && 'text-olive')}>
        {item.text || (item.ink?.length ? <InkPreview strokes={item.ink} height={24} className={clsx(item.status !== 'open' && 'opacity-50')} /> : <span className="text-muted">sem texto</span>)}
      </span>
      {p && <PillarDot p={p} on size={18} />}
    </li>
  );
}
