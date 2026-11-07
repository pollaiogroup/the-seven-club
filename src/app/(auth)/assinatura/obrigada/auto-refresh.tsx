'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Atualiza a página a cada poucos segundos (por até 20 minutos) enquanto o pagamento é confirmado. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => { if (Date.now() - started > 20 * 60e3) clearInterval(t); else router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
