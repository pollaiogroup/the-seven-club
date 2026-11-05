'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setBlock } from '@/actions/posts';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { ReportSheet } from '@/components/feed/report-sheet';

export function ProfileActions({ memberId, name, blocked }: { memberId: string; name: string; blocked: boolean }) {
  const [pending, start] = useTransition();
  const [reporting, setReporting] = useState(false);
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" className="flex-1" disabled={pending} onClick={() => {
        if (!blocked && !confirm(`Bloquear ${name}? Você deixa de ver as publicações dela.`)) return;
        start(async () => { const r = await setBlock(memberId, !blocked); if (r?.error) toast(r.error, 'error'); else { toast(blocked ? 'Desbloqueada' : 'Bloqueada'); router.refresh(); } });
      }}>{blocked ? 'Desbloquear' : 'Bloquear'}</Button>
      <Button variant="secondary" size="sm" className="flex-1" onClick={() => setReporting(true)}>Denunciar</Button>
      <ReportSheet open={reporting} onClose={() => setReporting(false)} targetType="member" targetId={memberId} />
    </div>
  );
}
