'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Eraser, Keyboard, LockKeyhole, PenLine, Undo2 } from 'lucide-react';
import { PLANNER_TABS } from '@/lib/planner';
import { SevenStar } from '@/components/ui/icons';
import { INK_COLORS, PlannerProvider, usePlanner } from './planner-context';

function Toolbar() {
  const { input, setInput, tool, setTool, color, setColor, undo, canUndo } = usePlanner();
  const seg = (on: boolean) => clsx('flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition', on ? 'bg-burgundy text-ivory' : 'text-muted hover:text-burgundy');
  const ic = (on: boolean) => clsx('flex h-9 w-9 items-center justify-center rounded-full transition', on ? 'bg-burgundy text-ivory' : 'text-espresso hover:bg-burgundy/5');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Como escrever" className="flex rounded-full bg-paper p-1 ring-1 ring-line">
        <button type="button" role="radio" aria-checked={input === 'ink'} className={seg(input === 'ink')} onClick={() => setInput('ink')}><PenLine className="h-4 w-4" />Escrever</button>
        <button type="button" role="radio" aria-checked={input === 'type'} className={seg(input === 'type')} onClick={() => setInput('type')}><Keyboard className="h-4 w-4" />Digitar</button>
      </div>
      <div className="flex items-center gap-1 rounded-full bg-paper p-1 ring-1 ring-line">
        <button type="button" aria-label="Caneta" aria-pressed={tool === 'pen'} className={ic(tool === 'pen')} onClick={() => setTool('pen')}><PenLine className="h-[18px] w-[18px]" /></button>
        <button type="button" aria-label="Borracha" aria-pressed={tool === 'eraser'} className={ic(tool === 'eraser')} onClick={() => setTool('eraser')}><Eraser className="h-[18px] w-[18px]" /></button>
        <span className="mx-1 h-5 w-px bg-line" />
        {INK_COLORS.map((c) => (
          <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={color === c} onClick={() => { setColor(c); setTool('pen'); }}
            className="flex h-9 w-8 items-center justify-center">
            <span className="h-5 w-5 rounded-full" style={{ background: c, boxShadow: color === c ? `0 0 0 2px #FBF7F0, 0 0 0 3.5px ${c}` : undefined }} />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" aria-label="Desfazer" disabled={!canUndo} className={clsx(ic(false), 'disabled:opacity-35')} onClick={undo}><Undo2 className="h-[18px] w-[18px]" /></button>
      </div>
    </div>
  );
}

function Tabs({ vertical }: { vertical: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Divisórias do planner" className={clsx(vertical ? 'hidden w-[64px] shrink-0 flex-col gap-1.5 py-6 md:flex' : 'no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2 md:hidden')}>
      {PLANNER_TABS.map((t) => {
        const on = t.match.some((m) => path === m);
        const star = t.label !== 'MEU MÊS' && t.label !== 'ESTANTE';
        return (
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} style={{ background: t.bg, color: t.fg }}
            className={clsx('flex shrink-0 items-center justify-center gap-1.5 font-bold tracking-[.16em] transition',
              vertical ? clsx('min-h-[108px] flex-1 rounded-r-[14px] text-[10px] [writing-mode:vertical-rl]', on ? 'mr-0' : 'mr-2 opacity-90 hover:mr-0') : clsx('rounded-full px-3.5 py-2 text-[10.5px]', on ? 'ring-2 ring-burgundy ring-offset-2 ring-offset-ivory' : ''))}>
            {star && <SevenStar className={clsx('h-2.5 w-2.5', vertical && '[writing-mode:horizontal-tb]')} />}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PlannerShell({ children }: { children: React.ReactNode }) {
  return (
    <PlannerProvider>
      <div className="pt-safe pb-nav md:pb-0">
        <header className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3 md:px-6">
          <div className="flex items-center gap-2.5 text-burgundy">
            <SevenStar className="h-[18px] w-[18px]" />
            <span className="font-display text-[15px] tracking-[.12em] sm:text-[17px] sm:tracking-[.14em]">THE SEVEN CLUB PLANNER</span>
            <span className="ml-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-line"><LockKeyhole className="h-3 w-3" />Só você vê</span>
          </div>
          <Toolbar />
        </header>
        <Tabs vertical={false} />
        <div className="mx-auto flex max-w-[1180px] md:pl-6">
          <div className="min-w-0 flex-1 px-4 md:px-0">{children}</div>
          <Tabs vertical />
        </div>
      </div>
    </PlannerProvider>
  );
}
