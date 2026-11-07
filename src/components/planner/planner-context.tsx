'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type Tool = 'pen' | 'eraser';
export type InputMode = 'ink' | 'type';
export const INK_COLORS = ['#2D2A3E', '#450B18', '#85866A', '#C9AFA8'] as const;

type Ctx = {
  tool: Tool; setTool: (t: Tool) => void;
  input: InputMode; setInput: (m: InputMode) => void;
  color: string; setColor: (c: string) => void;
  penSeen: boolean; markPen: () => void;
  pushUndo: (fn: () => void) => void; undo: () => void; canUndo: boolean;
};
const PlannerCtx = createContext<Ctx | null>(null);
export const usePlanner = () => {
  const c = useContext(PlannerCtx);
  if (!c) throw new Error('usePlanner fora do PlannerProvider');
  return c;
};

const KEY = 'seven:planner-input-v2';

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [tool, setTool] = useState<Tool>('pen');
  const [input, setInputState] = useState<InputMode>('type');
  const [color, setColor] = useState<string>(INK_COLORS[0]);
  const [penSeen, setPenSeen] = useState(false);
  const stack = useRef<(() => void)[]>([]);
  const [depth, setDepth] = useState(0);

  // Digitar é o padrão em todo aparelho (a caneta escreve à mão mesmo assim). A escolha fica salva neste aparelho.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* armazenamento indisponível */ }
    if (saved === 'ink' || saved === 'type') setInputState(saved);
  }, []);
  const setInput = useCallback((m: InputMode) => { setInputState(m); try { localStorage.setItem(KEY, m); } catch { /* ignora */ } }, []);
  const markPen = useCallback(() => setPenSeen(true), []);
  const pushUndo = useCallback((fn: () => void) => { stack.current.push(fn); if (stack.current.length > 60) stack.current.shift(); setDepth(stack.current.length); }, []);
  const undo = useCallback(() => { const fn = stack.current.pop(); setDepth(stack.current.length); fn?.(); }, []);

  const value = useMemo(() => ({ tool, setTool, input, setInput, color, setColor, penSeen, markPen, pushUndo, undo, canUndo: depth > 0 }),
    [tool, input, setInput, color, penSeen, markPen, pushUndo, undo, depth]);
  return <PlannerCtx.Provider value={value}>{children}</PlannerCtx.Provider>;
}
