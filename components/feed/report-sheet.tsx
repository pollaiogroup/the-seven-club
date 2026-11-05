'use client';
import { useState, useTransition } from 'react';
import { report } from '@/actions/posts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { toast } from '@/components/ui/toaster';

const REASONS = ['Desrespeito ou ofensa', 'Spam ou venda insistente', 'Exposição de outra pessoa', 'Informação falsa', 'Outro motivo'];

export function ReportSheet({ open, onClose, targetType, targetId }: { open: boolean; onClose: () => void; targetType: string; targetId: string }) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [pending, start] = useTransition();
  return (
    <BottomSheet open={open} onClose={onClose} title="Denunciar">
      <p className="mb-4 text-[14px] text-muted">A moderação do clube vai analisar. A autora não sabe quem denunciou.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)}
            className={`rounded-full px-4 py-2 text-[13px] ring-1 ${reason === r ? 'bg-burgundy text-ivory ring-burgundy' : 'bg-paper ring-line'}`}>{r}</button>
        ))}
      </div>
      <Textarea placeholder="Detalhes (opcional)" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={400} />
      <Button full className="mt-4" disabled={!reason || pending} onClick={() => start(async () => {
        const r = await report({ target_type: targetType, target_id: targetId, reason: detail ? `${reason}: ${detail}` : reason });
        toast(r?.error || r?.message || 'Enviado', r?.error ? 'error' : 'ok');
        if (!r?.error) { onClose(); setReason(''); setDetail(''); }
      })}>Enviar denúncia</Button>
    </BottomSheet>
  );
}
