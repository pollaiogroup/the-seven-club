import Link from 'next/link';
import clsx from 'clsx';

/** Dia, Semana e Mês dentro da divisória "Meu mês". */
export function ViewSwitch({ view, day }: { view: 'dia' | 'semana' | 'mes'; day: string }) {
  const items = [['dia', 'Dia', '/planner'], ['semana', 'Semana', '/planner/semana'], ['mes', 'Mês', '/planner/mes']] as const;
  return (
    <nav aria-label="Visão" className="flex rounded-full bg-ivory p-1">
      {items.map(([k, label, href]) => (
        <Link key={k} href={`${href}?dia=${day}`} aria-current={view === k ? 'page' : undefined}
          className={clsx('rounded-full px-4 py-1.5 text-[13px] font-semibold transition', view === k ? 'bg-burgundy text-ivory' : 'text-muted hover:text-burgundy')}>{label}</Link>
      ))}
    </nav>
  );
}
