'use client';
import { useEffect, useRef } from 'react';
import type { Stroke } from '@/lib/planner';
import { drawStrokes, LINE_UNITS } from './ink';

/** Miniatura da escrita à mão de uma linha (somente leitura). */
export function InkPreview({ strokes, height = 26, className }: { strokes: Stroke[]; height?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = height / LINE_UNITS;
  const width = Math.min(Math.max(...strokes.flatMap((s) => s.p.filter((_, i) => i % 3 === 0)), 40) * scale + 8, 900);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
    const ctx = c.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    drawStrokes(ctx, strokes, scale);
  }, [strokes, width, height, scale]);
  return <canvas ref={ref} aria-label="Escrita à mão" role="img" className={className} style={{ width, height, maxWidth: '100%' }} />;
}
