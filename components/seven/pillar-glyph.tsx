import { Banknote, Brain, Briefcase, Crown, Dumbbell, HeartHandshake, Palmtree } from 'lucide-react';

const ICONS = { body: Dumbbell, mind: Brain, leadership: Crown, business: Briefcase, wealth: Banknote, connection: HeartHandshake, lifestyle: Palmtree } as const;

export function PillarGlyph({ slug, className = 'h-5 w-5' }: { slug: string; className?: string }) {
  const I = ICONS[slug as keyof typeof ICONS] || Dumbbell;
  return <I className={className} strokeWidth={1.7} />;
}
