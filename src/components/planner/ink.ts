'use client';
import { getStroke } from 'perfect-freehand';
import type { Stroke } from '@/lib/planner';

/** Altura de uma linha em unidades de tinta. A letra mantém o mesmo tamanho em qualquer tela. */
export const LINE_UNITS = 40;

const avg = (a: number, b: number) => (a + b) / 2;
function outlinePath(points: number[][]) {
  const n = points.length;
  if (n < 2) return null;
  const path = new Path2D();
  const [a, b] = [points[0]!, points[1]!];
  path.moveTo(a[0]!, a[1]!);
  path.quadraticCurveTo(b[0]!, b[1]!, avg(b[0]!, points[2]?.[0] ?? b[0]!), avg(b[1]!, points[2]?.[1] ?? b[1]!));
  for (let i = 2; i < n - 1; i++) {
    const p = points[i]!, q = points[i + 1]!;
    path.quadraticCurveTo(p[0]!, p[1]!, avg(p[0]!, q[0]!), avg(p[1]!, q[1]!));
  }
  path.closePath();
  return path;
}

export function strokeToPath(s: Stroke, scale: number, last = true) {
  const pts: number[][] = [];
  let realPressure = false;
  for (let i = 0; i < s.p.length; i += 3) {
    const pr = s.p[i + 2] ?? 0.5;
    if (pr !== 0.5) realPressure = true;
    pts.push([s.p[i]! * scale, s.p[i + 1]! * scale, pr]);
  }
  if (pts.length === 1) pts.push([pts[0]![0]! + 0.3, pts[0]![1]! + 0.3, pts[0]![2]!]);
  const outline = getStroke(pts, { size: s.w * scale, thinning: 0.6, smoothing: 0.55, streamline: 0.4, simulatePressure: !realPressure, last });
  return outlinePath(outline);
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number) {
  for (const s of strokes) {
    const path = strokeToPath(s, scale);
    if (!path) continue;
    ctx.fillStyle = s.c;
    ctx.fill(path);
  }
}

/** A borracha apaga o traço inteiro que ela toca. */
export function hitStroke(s: Stroke, x: number, y: number, r: number) {
  const r2 = (r + s.w / 2) ** 2;
  for (let i = 0; i < s.p.length; i += 3) {
    const dx = s.p[i]! - x, dy = s.p[i + 1]! - y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

export const round = (n: number) => Math.round(n * 10) / 10;
