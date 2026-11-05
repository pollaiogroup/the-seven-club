'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export function AdminNav({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto px-4 md:flex-col md:overflow-visible md:px-3">
      {items.map((i) => {
        const active = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={clsx('flex shrink-0 items-center justify-between gap-2 rounded-full px-4 py-2 text-[13px] transition md:rounded-xl md:py-2.5', active ? 'bg-ivory font-semibold text-burgundy' : 'text-ivory/80 hover:bg-white/10')}>
            {i.label}
            {!!i.badge && <span className="rounded-full bg-grioh px-1.5 text-[11px] font-bold text-white">{i.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
