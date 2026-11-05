'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AndroidSteps, InstallSteps, IOSSteps, isStandalone, useInstall } from '@/components/settings/install-app';

export function InstallGuide() {
  const router = useRouter();
  const { mode } = useInstall();
  const [all, setAll] = useState(false);
  // aberto pelo ícone, vai direto para o clube
  useEffect(() => { if (isStandalone()) router.replace('/feed'); }, [router]);

  const label = mode === 'ios' || mode === 'ios-other' ? 'No seu iPhone' : mode === 'android' ? 'No seu Android' : 'Neste aparelho';
  const card = 'rounded-[var(--radius-card)] bg-white/8 p-5 text-[15px] leading-snug ring-1 ring-white/12';
  return (
    <div className="mt-8 space-y-4">
      {mode !== 'desktop' && mode !== 'loading' && (
        <section className={card}>
          <h2 className="mb-4 text-[13px] font-semibold tracking-wider text-dusty uppercase">{label}</h2>
          <InstallSteps dark />
        </section>
      )}
      {mode === 'desktop' || all ? (
        <>
          <section className={card}><h2 className="mb-4 text-[13px] font-semibold tracking-wider text-dusty uppercase">iPhone</h2><IOSSteps dark /></section>
          <section className={card}><h2 className="mb-4 text-[13px] font-semibold tracking-wider text-dusty uppercase">Android</h2><AndroidSteps dark /></section>
        </>
      ) : mode !== 'loading' && (
        <button type="button" onClick={() => setAll(true)} className="w-full text-center text-[14px] text-dusty underline underline-offset-4">Ver instruções para iPhone e Android</button>
      )}
      <p className="pt-2 text-[13px] leading-relaxed text-ivory/70">
        No iPhone, as notificações do clube só chegam com o app instalado na tela de início (iOS 16.4 ou mais novo). Depois de instalar, ative em Ajustes.
      </p>
    </div>
  );
}
