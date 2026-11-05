'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { Star } from 'lucide-react';

/** Avaliação de 1 a 7 estrelas (só leitura). */
export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-0.5', className)} role="img" aria-label={`${value} de 7 estrelas`}>
      {Array.from({ length: 7 }, (_, i) => (
        <Star key={i} style={{ width: size, height: size }} className={i < value ? 'fill-burgundy text-burgundy' : 'text-dusty'} strokeWidth={1.5} />
      ))}
    </span>
  );
}

/** Campo de estrelas de 1 a 7 para o formulário (envia `name` com o número). */
export function StarInput({ name, defaultValue = 0 }: { name: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div>
      <input type="hidden" name={name} value={value || ''} />
      <div role="radiogroup" aria-label="Avaliação de 1 a 7 estrelas" className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
            onClick={() => setValue(n)} onMouseEnter={() => setHover(n)}
            className="flex h-11 w-10 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-burgundy">
            <Star className={clsx('h-8 w-8 transition', n <= shown ? 'fill-burgundy text-burgundy' : 'text-dusty')} strokeWidth={1.4} />
          </button>
        ))}
      </div>
      <p className="mt-1 text-[13px] text-muted">{value ? `${value} de 7` : 'Toque para avaliar'}</p>
    </div>
  );
}
