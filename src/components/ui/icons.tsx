import clsx from 'clsx';

const STAR = '50.00,2.00 58.24,32.88 87.53,20.07 68.52,45.77 96.80,60.68 64.85,61.85 70.83,93.25 50.00,69.00 29.17,93.25 35.15,61.85 3.20,60.68 31.48,45.77 12.47,20.07 41.76,32.88';

/** Estrela de 7 pontas. Marca provisória até o arquivo oficial (public/brand/seven-star.svg). */
export function SevenStar({ className, outline = false, strokeWidth = 5 }: { className?: string; outline?: boolean; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <polygon
        points={STAR}
        fill={outline ? 'none' : 'currentColor'}
        stroke={outline ? 'currentColor' : 'none'}
        strokeWidth={outline ? strokeWidth : 0}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Símbolo original da Grioh: o G acompanha a cor do texto, o ponto mantém o laranja original. */
export function GriohIcon({ className }: { className?: string }) {
  return (
    <span className={clsx('grioh-icon', className)} aria-hidden="true">
      <span className="g" />
      <span className="dot" />
    </span>
  );
}

export function Wordmark({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <div className={clsx('flex flex-col items-center text-center', className)}>
      <SevenStar className="h-7 w-7 text-dusty" />
      <span className="font-display mt-2 text-[15px] tracking-[0.22em] uppercase">The Seven Club</span>
      {tagline && <span className="mt-1 text-[10px] tracking-brand text-dusty uppercase">Born to lead.</span>}
    </div>
  );
}
