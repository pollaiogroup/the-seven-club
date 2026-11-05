'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { SevenStar } from '@/components/ui/icons';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center">
      <SevenStar outline className="h-10 w-10 text-dusty" />
      <h1 className="mt-4 text-[24px] text-burgundy">Algo não carregou</h1>
      <p className="mt-2 max-w-xs text-[14px] text-muted">Pode ser a conexão. Tente de novo em instantes.</p>
      <Button className="mt-6" onClick={reset}>Tentar de novo</Button>
    </div>
  );
}
