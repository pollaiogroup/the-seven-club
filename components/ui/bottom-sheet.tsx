'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Painel que sobe de baixo (padrão para criar, registrar e filtrar no celular). */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 sm:mx-auto sm:mb-8 sm:max-w-lg"
    >
      <div className="animate-sheet pb-safe max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-ivory sm:rounded-[28px]">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-ivory px-5 pt-3 pb-2">
          <span className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line" />
          <h2 className="pt-3 text-xl text-burgundy">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="mt-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-burgundy/5">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </dialog>
  );
}
