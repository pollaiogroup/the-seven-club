import type { ReactNode } from 'react';

export function AdminTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-[28px] text-burgundy">{title}</h1>{subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}</div>
      {action}
    </div>
  );
}

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius-card)] bg-paper p-4 ring-1 ring-line md:p-5 ${className}`}>
      {title && <h2 className="mb-3 text-[17px] text-burgundy">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-paper p-4 ring-1 ring-line">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="font-display mt-1 text-[30px] leading-none text-espresso">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
