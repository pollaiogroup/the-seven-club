import clsx from 'clsx';
import { mediaUrl } from '@/lib/media';
import { initials } from '@/lib/format';

export function Avatar({ name, path, size = 40, className }: { name: string; path?: string | null; size?: number; className?: string }) {
  const url = mediaUrl(path);
  return (
    <span
      className={clsx('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-dusty-soft font-display text-burgundy ring-1 ring-black/5', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {url ? <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}
