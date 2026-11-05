'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

type Toast = { id: number; text: string; tone: 'ok' | 'error' };

export function toast(text: string, tone: 'ok' | 'error' = 'ok') {
  window.dispatchEvent(new CustomEvent('seven:toast', { detail: { text, tone } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { text, tone } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, text, tone }]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
    };
    window.addEventListener('seven:toast', on);
    return () => window.removeEventListener('seven:toast', on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-nav-offset z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} className={clsx('animate-rise rounded-full px-5 py-3 text-[14px] font-medium shadow-lg', t.tone === 'ok' ? 'bg-espresso text-ivory' : 'bg-danger text-white')}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
