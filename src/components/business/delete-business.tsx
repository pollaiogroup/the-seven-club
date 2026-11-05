'use client';
import { useTransition } from 'react';
import { deleteBusiness } from '@/actions/business';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';

export function DeleteBusiness({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" full disabled={pending} className="text-danger" onClick={() => {
      if (!confirm('Excluir a empresa, suas publicações, produtos e galeria? Não dá para desfazer.')) return;
      start(async () => { const r = await deleteBusiness(id); if (r?.error) toast(r.error, 'error'); });
    }}>Excluir empresa</Button>
  );
}
