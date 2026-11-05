import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

/** Cabeçalho bordô das telas internas, com título serifado e área segura do iOS. */
export function PageHeader({ title, subtitle, back, actions, children }: { title: ReactNode; subtitle?: ReactNode; back?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="pt-safe bg-burgundy text-ivory">
      <div className="mx-auto flex max-w-2xl items-start gap-2 px-5 pt-4 pb-5">
        {back && (
          <Link href={back} aria-label="Voltar" className="-ml-2 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
            <ChevronLeft className="h-6 w-6" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[28px] leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[14px] text-dusty">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1 pt-1">{actions}</div>}
      </div>
      {children && <div className="mx-auto max-w-2xl px-5 pb-5">{children}</div>}
    </header>
  );
}

/** Folha de conteúdo marfim que sobe sobre o cabeçalho. */
export function Sheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <main className={`relative -mt-3 min-h-[60dvh] rounded-t-[28px] bg-ivory pb-nav ${className}`}>
      <div className="mx-auto max-w-2xl">{children}</div>
    </main>
  );
}

export function IconLink({ href, label, children, badge }: { href: string; label: string; children: ReactNode; badge?: number }) {
  return (
    <Link href={href} aria-label={label} className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
      {children}
      {!!badge && badge > 0 && (
        <span className="absolute top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-grioh px-1 text-[10px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-5 pt-6 pb-3">
      <h2 className="text-[19px] text-burgundy">{children}</h2>
      {action}
    </div>
  );
}
