'use client';
import { useState, useTransition } from 'react';
import { Download, Heart, Image as ImageIcon, Send, Smartphone } from 'lucide-react';
import clsx from 'clsx';
import type { Affirmation } from '@/lib/types';
import { shareAffirmation, toggleFavorite } from '@/actions/affirmations';
import { THEMES } from '@/lib/labels';
import { longDate } from '@/lib/format';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { toast } from '@/components/ui/toaster';

const STAR = [[50, 2], [58.24, 32.88], [87.53, 20.07], [68.52, 45.77], [96.8, 60.68], [64.85, 61.85], [70.83, 93.25], [50, 69], [29.17, 93.25], [35.15, 61.85], [3.2, 60.68], [31.48, 45.77], [12.47, 20.07], [41.76, 32.88]];

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.beginPath();
  STAR.forEach(([x, y], i) => { const px = cx + (x! - 50) * size / 100, py = cy + (y! - 50) * size / 100; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Gera a imagem no próprio aparelho, com a identidade do clube. */
async function render(a: Affirmation, kind: 'post' | 'wallpaper') {
  const W = 1080, H = kind === 'post' ? 1350 : 1920;
  await Promise.all([document.fonts.load('italic 64px "Playfair Display Variable"'), document.fonts.load('600 28px "DM Sans Variable"')]);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#450B18'; ctx.fillRect(0, 0, W, H);
  star(ctx, W * 0.86, H * 0.08, 620, 'rgba(94,26,41,0.55)');
  const cy = kind === 'post' ? H * 0.46 : H * 0.48;
  star(ctx, W / 2, cy - 330, 70, '#C9AFA8');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F4EBDD';
  const size = a.text.length > 80 ? 62 : 72;
  ctx.font = `italic ${size}px "Playfair Display Variable", Georgia, serif`;
  const lines = wrap(ctx, `“${a.text}”`, W - 200);
  const lh = size * 1.32;
  const top = cy - (lines.length * lh) / 2 + size * 0.4;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * lh));
  ctx.font = '600 26px "DM Sans Variable", system-ui';
  ctx.fillStyle = '#C9AFA8';
  ctx.letterSpacing = '8px';
  ctx.fillText((THEMES[a.theme] || '').toUpperCase(), W / 2, top + lines.length * lh + 40);
  ctx.letterSpacing = '10px';
  ctx.font = '500 30px "Playfair Display Variable", Georgia, serif';
  ctx.fillStyle = '#F4EBDD';
  ctx.fillText('THE SEVEN CLUB', W / 2, H - (kind === 'post' ? 150 : 260));
  ctx.font = '600 20px "DM Sans Variable", system-ui';
  ctx.fillStyle = '#C9AFA8';
  ctx.letterSpacing = '9px';
  ctx.fillText('BORN TO LEAD.', W / 2, H - (kind === 'post' ? 105 : 215));
  if (a.day && kind === 'post') { ctx.letterSpacing = '2px'; ctx.font = '400 24px "DM Sans Variable", system-ui'; ctx.fillText(longDate(a.day), W / 2, 110); }
  return new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
}

async function deliver(blob: Blob, name: string) {
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'THE SEVEN CLUB' }); return; } catch { /* cancelado */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function FavoriteButton({ a, compact = false }: { a: Affirmation; compact?: boolean }) {
  const [fav, setFav] = useState(a.favorited);
  const [, start] = useTransition();
  return (
    <button aria-pressed={fav} aria-label={fav ? 'Remover dos favoritos' : 'Favoritar'}
      onClick={() => { const n = !fav; setFav(n); start(async () => { const r = await toggleFavorite(a.id, n); if (r?.error) { setFav(!n); toast(r.error, 'error'); } }); }}
      className={clsx('inline-flex items-center justify-center gap-2 rounded-full transition', compact ? 'h-10 w-10 text-burgundy hover:bg-burgundy/5' : 'h-12 flex-1 bg-ivory/10 text-ivory ring-1 ring-ivory/20')}>
      <Heart className={clsx('h-5 w-5', fav && (compact ? 'fill-burgundy' : 'fill-ivory'))} />
      {!compact && (fav ? 'Favorita' : 'Favoritar')}
    </button>
  );
}

export function AffirmationActions({ a }: { a: Affirmation }) {
  const [sharing, setSharing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [shared, setShared] = useState(!!a.shared);
  const make = async (kind: 'post' | 'wallpaper') => {
    setBusy(kind);
    try { await deliver(await render(a, kind), kind === 'post' ? 'afirmacao-seven-club.png' : 'papel-de-parede-seven-club.png'); }
    catch { toast('Não foi possível gerar a imagem.', 'error'); }
    finally { setBusy(null); }
  };
  return (
    <>
      <div className="mt-6 flex gap-2">
        <FavoriteButton a={a} />
        <button onClick={() => setSharing(true)} disabled={shared} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ivory font-semibold text-burgundy disabled:opacity-60">
          <Send className="h-5 w-5" />{shared ? 'Compartilhada' : 'No Feed'}
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={() => make('post')} disabled={!!busy} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ivory/10 text-[14px] text-ivory ring-1 ring-ivory/20">
          {busy === 'post' ? <Download className="h-5 w-5 animate-bounce" /> : <ImageIcon className="h-5 w-5" />}Imagem
        </button>
        <button onClick={() => make('wallpaper')} disabled={!!busy} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ivory/10 text-[14px] text-ivory ring-1 ring-ivory/20">
          {busy === 'wallpaper' ? <Download className="h-5 w-5 animate-bounce" /> : <Smartphone className="h-5 w-5" />}Papel de parede
        </button>
      </div>
      <BottomSheet open={sharing} onClose={() => setSharing(false)} title="Compartilhar no Feed">
        <blockquote className="font-display rounded-2xl bg-burgundy p-5 text-[18px] text-ivory italic">“{a.text}”</blockquote>
        <Textarea className="mt-4" placeholder="Quer acrescentar algo? (opcional)" value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} />
        <Button full className="mt-4" disabled={pending} onClick={() => start(async () => {
          const r = await shareAffirmation(a.id, text);
          if (r?.error) return toast(r.error, 'error');
          toast('Compartilhada no Feed'); setShared(true); setSharing(false);
        })}>Publicar</Button>
      </BottomSheet>
    </>
  );
}
