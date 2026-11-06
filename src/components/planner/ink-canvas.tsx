'use client';
import { useEffect, useRef, useState } from 'react';
import type { Stroke } from '@/lib/planner';
import { drawStrokes, hitStroke, round, strokeToPath } from './ink';
import { usePlanner } from './planner-context';

/**
 * Área de escrita à mão. A caneta (Apple Pencil, S Pen) sempre escreve.
 * No modo "Escrever", o mouse e o dedo também escrevem, até a primeira caneta aparecer (aí o dedo deixa de riscar, para a palma não marcar a página).
 * No modo "Digitar", o toque passa para o campo de texto (onTypeTap).
 * basis: 'height' mantém o tamanho da letra pela altura (linhas); 'width' escala pela largura (páginas de notas).
 */
export function InkCanvas({ strokes, onChange, basis, units, penWidth, onTypeTap, className, label }: {
  strokes: Stroke[]; onChange: (next: Stroke[], prev: Stroke[]) => void;
  basis: 'height' | 'width'; units: number; penWidth: number;
  onTypeTap?: () => void; className?: string; label: string;
}) {
  const { tool, input, color, penSeen, markPen } = usePlanner();
  const wrap = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const cur = useRef<Stroke | null>(null);
  const erase = useRef<{ before: Stroke[]; now: Stroke[] } | null>(null);
  const scale = basis === 'height' ? size.h / units : size.w / units;

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { const r = e!.contentRect; setSize({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const prep = (c: HTMLCanvasElement | null) => {
    if (!c || !size.w || !size.h) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (c.width !== Math.round(size.w * dpr) || c.height !== Math.round(size.h * dpr)) { c.width = Math.round(size.w * dpr); c.height = Math.round(size.h * dpr); }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    return ctx;
  };
  useEffect(() => { const ctx = prep(base.current); if (ctx) drawStrokes(ctx, erase.current?.now ?? strokes, scale); });

  const drawLive = () => {
    const ctx = prep(live.current); if (!ctx || !cur.current) return;
    const path = strokeToPath(cur.current, scale, false);
    if (path) { ctx.fillStyle = cur.current.c; ctx.fill(path); }
  };
  const point = (e: { clientX: number; clientY: number }) => {
    const r = live.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };
  const pressure = (e: PointerEvent | React.PointerEvent) => (e.pointerType === 'pen' && e.pressure > 0 ? Math.round(e.pressure * 100) / 100 : 0.5);
  const eraseAt = (x: number, y: number) => {
    const s = erase.current!; const keep = s.now.filter((k) => !hitStroke(k, x, y, basis === 'height' ? 3 : 9));
    if (keep.length !== s.now.length) { s.now = keep; const ctx = prep(base.current); if (ctx) drawStrokes(ctx, keep, scale); }
  };

  const drawsHere = (e: React.PointerEvent) =>
    e.pointerType === 'pen' || (input === 'ink' && (e.pointerType === 'mouse' || (e.pointerType === 'touch' && !penSeen)));

  return (
    <div ref={wrap} className={className ?? 'relative'}>
      <canvas ref={base} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas
        ref={live}
        role="img"
        aria-label={label}
        className="absolute inset-0 h-full w-full select-none"
        style={{ touchAction: input === 'ink' || penSeen ? 'none' : 'auto', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', cursor: input === 'ink' ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'text' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'pen') markPen();
          if (!drawsHere(e) || !scale) { if (input === 'type' || e.pointerType === 'touch') onTypeTap?.(); return; }
          e.preventDefault();
          live.current!.setPointerCapture(e.pointerId);
          const { x, y } = point(e);
          if (tool === 'eraser' || e.button === 5) { erase.current = { before: strokes, now: strokes }; eraseAt(x, y); return; }
          cur.current = { c: color, w: penWidth, p: [round(x), round(y), pressure(e)] };
          drawLive();
        }}
        onPointerMove={(e) => {
          if (erase.current) { const { x, y } = point(e); eraseAt(x, y); return; }
          if (!cur.current) return;
          const evs = (e.nativeEvent.getCoalescedEvents?.() ?? []) as PointerEvent[];
          for (const ev of evs.length ? evs : [e.nativeEvent]) { const { x, y } = point(ev); cur.current.p.push(round(x), round(y), pressure(ev)); }
          drawLive();
        }}
        onPointerUp={() => {
          if (erase.current) { const { before, now } = erase.current; erase.current = null; if (now.length !== before.length) onChange(now, before); return; }
          const s = cur.current; cur.current = null; prep(live.current);
          if (s) onChange([...strokes, s], strokes);
        }}
        onPointerCancel={() => { cur.current = null; erase.current = null; prep(live.current); }}
      />
    </div>
  );
}
