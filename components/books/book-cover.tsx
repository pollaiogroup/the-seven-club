import clsx from 'clsx';
import { mediaUrl } from '@/lib/media';
import type { Book } from '@/lib/types';

// Capas sem foto ganham uma das cores da marca, sempre a mesma para o mesmo título
const TONES = [['bg-burgundy', 'text-ivory', 'text-dusty'], ['bg-olive', 'text-ivory', 'text-ivory/80'], ['bg-espresso', 'text-ivory', 'text-dusty'], ['bg-dusty', 'text-burgundy', 'text-burgundy/70'], ['bg-burgundy-soft', 'text-ivory', 'text-dusty']];
const tone = (title: string) => TONES[[...title].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length]!;

/** Capa do livro em proporção 2:3; sem imagem, mostra título e autora em tipografia. */
export function BookCover({ book, className, priority = false }: { book: Book; className?: string; priority?: boolean }) {
  const src = mediaUrl(book.cover_path);
  const [bg, ink, sub] = tone(book.title);
  return (
    <div className={clsx('@container relative aspect-[2/3] overflow-hidden rounded-[6px]', bg, ' shadow-[0_6px_18px_rgba(37,37,31,0.18)] ring-1 ring-black/5', className)}>
      {src ? (
        <img src={src} alt={`Capa de ${book.title}`} className="h-full w-full object-cover" loading={priority ? 'eager' : 'lazy'} decoding="async" />
      ) : (
        <div className={clsx('flex h-full w-full flex-col justify-between p-[10%] @max-[72px]:invisible', ink)}>
          <span className="font-display line-clamp-5 text-[clamp(10px,13cqw,24px)] leading-[1.12]">{book.title}</span>
          {book.author && <span className={clsx('line-clamp-2 text-[clamp(8px,8cqw,13px)] tracking-wide', sub)}>{book.author}</span>}
        </div>
      )}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[6%] bg-gradient-to-r from-black/20 to-transparent" />
    </div>
  );
}
