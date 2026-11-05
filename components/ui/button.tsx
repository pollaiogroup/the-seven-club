import Link from 'next/link';
import clsx from 'clsx';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'light';
type Size = 'md' | 'sm' | 'lg';

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', full = false) {
  return clsx(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none',
    size === 'sm' && 'h-9 px-4 text-[13px]',
    size === 'md' && 'h-12 px-6 text-[15px]',
    size === 'lg' && 'h-14 px-7 text-base',
    variant === 'primary' && 'bg-burgundy text-ivory hover:bg-burgundy-soft',
    variant === 'secondary' && 'bg-paper text-burgundy ring-1 ring-line hover:ring-dusty',
    variant === 'ghost' && 'text-burgundy hover:bg-burgundy/5',
    variant === 'danger' && 'bg-danger text-white hover:opacity-90',
    variant === 'light' && 'bg-ivory text-burgundy hover:bg-paper',
    full && 'w-full'
  );
}

export function Button({ variant, size, full, className, ...props }: ComponentProps<'button'> & { variant?: Variant; size?: Size; full?: boolean }) {
  return <button {...props} className={clsx(buttonClass(variant, size, full), className)} />;
}

export function LinkButton({ variant, size, full, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; full?: boolean }) {
  return <Link {...props} className={clsx(buttonClass(variant, size, full), className)} />;
}
