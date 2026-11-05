'use client';
import { useState } from 'react';
import { Flag } from 'lucide-react';
import { ReportSheet } from '@/components/feed/report-sheet';

export function ReportButton({ targetType, targetId, label = 'Denunciar' }: { targetType: string; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-[13px] text-muted hover:text-danger"><Flag className="h-4 w-4" />{label}</button>
      <ReportSheet open={open} onClose={() => setOpen(false)} targetType={targetType} targetId={targetId} />
    </>
  );
}
