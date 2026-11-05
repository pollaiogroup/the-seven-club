import { SevenStar } from '@/components/ui/icons';

/** Arco de progresso do dia (abre embaixo, como no mockup). */
export function ProgressRing({ done, total = 7 }: { done: number; total?: number }) {
  const r = 70;
  const sweep = 270;
  const circ = 2 * Math.PI * r;
  const arc = (circ * sweep) / 360;
  const pct = Math.min(1, done / total);
  return (
    <div className="relative mx-auto h-[176px] w-[176px]" role="img" aria-label={`${done} de ${total} pilares concluídos hoje`}>
      <svg viewBox="0 0 176 176" className="h-full w-full -rotate-[225deg]">
        <circle cx="88" cy="88" r={r} fill="none" stroke="var(--color-line)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${arc} ${circ}`} />
        <circle cx="88" cy="88" r={r} fill="none" stroke="var(--color-burgundy)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${arc * pct} ${circ}`} style={{ transition: 'stroke-dasharray .6s var(--ease-soft)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <SevenStar className="h-7 w-7 text-burgundy" />
        <p className="font-display mt-1 text-[30px] leading-none text-espresso">{done} / {total}</p>
        <p className="mt-1 text-[13px] text-muted">concluídos</p>
      </div>
    </div>
  );
}
