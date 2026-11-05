'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { House, Store, UserRound } from 'lucide-react';
import { GriohIcon, SevenStar } from '@/components/ui/icons';

const ITEMS = [
  { href: '/feed', label: 'Feed', match: ['/feed', '/post', '/publicar', '/afirmacoes', '/agenda'] },
  { href: '/business', label: 'Business', match: ['/business'] },
  { href: '/seven', label: 'Seven', match: ['/seven'] },
  { href: '/ensino', label: 'Ensino', match: ['/ensino'] },
  { href: '/perfil', label: 'Profile', match: ['/perfil', '/projetos', '/ajustes'] },
] as const;

export function BottomNav({ handle }: { handle: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal" className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper/95 backdrop-blur-md md:inset-y-0 md:right-auto md:w-24 md:border-t-0 md:border-r">
      <ul className="mx-auto grid h-[4.75rem] max-w-2xl grid-cols-5 md:mt-24 md:h-auto md:grid-cols-1 md:gap-2">
        {ITEMS.map((item) => {
          const active = item.match.some((m) => path === m || path.startsWith(`${m}/`)) || (item.href === '/perfil' && path === `/integrantes/${handle}`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx('flex h-full flex-col items-center justify-center gap-1 py-2 text-[11px] transition md:py-4', active ? 'font-semibold text-burgundy' : 'text-muted hover:text-burgundy')}
              >
                {item.href === '/feed' && <House className="h-[23px] w-[23px]" strokeWidth={active ? 2.2 : 1.6} fill={active ? 'currentColor' : 'none'} />}
                {item.href === '/business' && <Store className="h-[23px] w-[23px]" strokeWidth={active ? 2.2 : 1.6} />}
                {item.href === '/seven' && <SevenStar outline={!active} strokeWidth={6} className="h-[24px] w-[24px]" />}
                {item.href === '/ensino' && <GriohIcon className="h-[24px] w-[24px]" />}
                {item.href === '/perfil' && <UserRound className="h-[23px] w-[23px]" strokeWidth={active ? 2.2 : 1.6} fill={active ? 'currentColor' : 'none'} />}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
