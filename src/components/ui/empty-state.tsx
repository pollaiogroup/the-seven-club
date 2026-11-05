import type { ReactNode } from 'react';
import { SevenStar } from './icons';

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <SevenStar outline className="h-10 w-10 text-dusty" />
      <h3 className="mt-4 text-xl text-burgundy">{title}</h3>
      {children && <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
