'use client';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { browserClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/toaster';
import type { Stroke } from '@/lib/planner';
import { InkCanvas } from './ink-canvas';
import { usePlanner } from './planner-context';

const W = 1000;

/** Página livre com pauta: escrita à mão e texto digitado na mesma folha. Salva sozinha. */
export function InkPage({ pageKey, initial, ratio = 1.3, label, placeholder }: {
  pageKey: string; initial: { text: string; ink: Stroke[] | null }; ratio?: number; label: string; placeholder?: string;
}) {
  const { pushUndo, input } = usePlanner();
  const [text, setText] = useState(initial.text);
  const [ink, setInk] = useState<Stroke[]>(initial.ink ?? []);
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const state = useRef({ text, ink }); state.current = { text, ink };

  const save = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const { error } = await browserClient().from('planner_pages').upsert({ key: pageKey, text: state.current.text, ink: state.current.ink.length ? state.current.ink : null });
    if (error) toast('Não foi possível salvar a página.', 'error');
  };
  const later = (ms = 900) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => void save(), ms); };
  useEffect(() => {
    const flush = () => { if (timer.current) void save(); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-paper ring-1 ring-line" style={{ aspectRatio: `1 / ${ratio}` }}>
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 35px, #E3D7C6 35px 36px)', backgroundPosition: '0 20px' }} />
      <textarea
        ref={area} value={text} maxLength={6000} aria-label={label} placeholder={ink.length ? undefined : placeholder}
        onChange={(e) => { setText(e.target.value); later(); }}
        className={clsx('absolute inset-0 h-full w-full resize-none bg-transparent px-5 pt-[27px] font-display text-[18px] leading-[36px] text-[#2D2A3E] italic outline-none placeholder:text-dusty')}
      />
      <InkCanvas className={clsx('absolute inset-0', input === 'type' && 'pointer-events-none')} strokes={ink} basis="width" units={W} penWidth={3.4} label={`${label}: escrita à mão`}
        onTypeTap={() => area.current?.focus()}
        onChange={(next, prev) => { setInk(next); state.current.ink = next; later(); pushUndo(() => { setInk(prev); state.current.ink = prev; later(300); }); }} />
    </div>
  );
}
