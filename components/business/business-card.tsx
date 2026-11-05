import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { BusinessCard } from '@/lib/types';
import { Avatar } from '@/components/ui/avatar';
import { mediaUrl } from '@/lib/media';

export function BusinessRow({ b }: { b: BusinessCard }) {
  return (
    <Link href={`/business/${b.slug}`} className="flex items-center gap-4 rounded-[var(--radius-card)] bg-paper p-3 ring-1 ring-line transition hover:ring-dusty">
      <Avatar name={b.name} path={b.logo_path} size={56} className="rounded-2xl" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[16px] font-semibold">{b.name}</p>
        {b.tagline && <p className="mt-0.5 truncate text-[13px] text-muted">{b.tagline}</p>}
        <p className="mt-1 truncate text-[12px] text-muted">{b.category?.name}{b.owner ? ` · Por ${b.owner.full_name}` : ''}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-taupe" />
    </Link>
  );
}

export function BusinessFeature({ b }: { b: BusinessCard }) {
  const cover = mediaUrl(b.cover_path);
  return (
    <Link href={`/business/${b.slug}`} className="block w-44 shrink-0 overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-line transition hover:ring-dusty">
      <div className="flex h-24 items-center justify-center bg-dusty-soft" style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {!cover && <Avatar name={b.name} path={b.logo_path} size={56} className="rounded-2xl" />}
      </div>
      <div className="p-3 leading-tight">
        <p className="truncate text-[15px] font-semibold">{b.name}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted">{b.tagline || b.category?.name}</p>
        {b.owner && <p className="mt-1.5 truncate text-[12px] text-muted">Por {b.owner.full_name}</p>}
      </div>
    </Link>
  );
}
