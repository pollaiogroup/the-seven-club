import { Briefcase, ChartColumn, Cpu, GraduationCap, HeartPulse, Shapes, ShoppingBag, Sparkles, Store, Sun, Utensils } from 'lucide-react';

const MAP = { sparkles: Sparkles, 'heart-pulse': HeartPulse, 'shopping-bag': ShoppingBag, 'chart-column': ChartColumn, utensils: Utensils, sun: Sun, cpu: Cpu, 'graduation-cap': GraduationCap, briefcase: Briefcase, shapes: Shapes } as const;

export function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const I = MAP[icon as keyof typeof MAP] || Store;
  return <I className={className} strokeWidth={1.6} />;
}
