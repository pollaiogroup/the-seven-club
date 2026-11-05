'use client';
import { useTransition } from 'react';
import type { EventItem } from '@/lib/types';
import { setRegistration } from '@/actions/events';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';

export function Registration({ e, past }: { e: EventItem; past: boolean }) {
  const [pending, start] = useTransition();
  const go = (s: 'registered' | 'confirmed' | 'cancelled') => start(async () => {
    const r = await setRegistration(e.id, s);
    toast(r?.error || r?.message || 'Feito', r?.error ? 'error' : 'ok');
  });
  const active = e.my_status && e.my_status !== 'cancelled';
  const full = e.capacity != null && e.taken >= e.capacity && !active;
  if (past) return <p className="text-center text-[14px] text-muted">{active ? 'Você participou deste evento.' : 'Evento encerrado.'}</p>;
  if (!active) return <Button full size="lg" disabled={pending || full} onClick={() => go('registered')}>{full ? 'Vagas esgotadas' : 'Quero participar'}</Button>;
  return (
    <div className="space-y-2">
      {e.my_status === 'registered'
        ? <Button full size="lg" disabled={pending} onClick={() => go('confirmed')}>Confirmar presença</Button>
        : <p className="rounded-full bg-olive/15 py-3 text-center text-[14px] font-semibold text-olive-ink">Presença confirmada</p>}
      <Button full variant="ghost" disabled={pending} onClick={() => { if (confirm('Cancelar sua inscrição?')) go('cancelled'); }}>Cancelar inscrição</Button>
    </div>
  );
}
