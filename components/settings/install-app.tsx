'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Check, Copy, EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Instalação do app pelo navegador (PWA), sem lojas.
 * iPhone: Safari > Compartilhar > Adicionar à Tela de Início.
 * Android: o Chrome oferece o próprio botão de instalar (beforeinstallprompt) ou o menu ⋮.
 */
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export type InstallMode = 'loading' | 'installed' | 'ios' | 'ios-other' | 'inapp' | 'android' | 'desktop';

// O Chrome dispara o evento uma vez, logo ao carregar: guardamos fora do componente.
let deferred: BIP | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIP; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || !!(navigator as { standalone?: boolean }).standalone;
}

export function isIOS() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function detect(): InstallMode {
  if (isStandalone()) return 'installed';
  const ua = navigator.userAgent;
  // navegadores embutidos (Instagram, Facebook, TikTok, LinkedIn…) não instalam apps
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|LinkedInApp|musical_ly|TikTok|Snapchat|Pinterest/i.test(ua)) return 'inapp';
  if (isIOS()) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? 'ios-other' : 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

export function useInstall() {
  const [mode, setMode] = useState<InstallMode>('loading');
  const [canPrompt, setCanPrompt] = useState(false);
  useEffect(() => {
    setMode(detect());
    const sync = () => { setCanPrompt(!!deferred); if (!deferred && isStandalone()) setMode('installed'); };
    sync();
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, []);
  async function install() {
    if (!deferred) return false;
    const evt = deferred;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferred = null;
    setCanPrompt(false);
    if (outcome === 'accepted') setMode('installed');
    return outcome === 'accepted';
  }
  return { mode, canPrompt, install };
}

function CopyLink({ dark }: { dark?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" variant={dark ? 'light' : 'secondary'} onClick={async () => {
      try { await navigator.clipboard.writeText(window.location.origin + '/instalar'); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* sem permissão de cópia */ }
    }}>
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{done ? 'Link copiado' : 'Copiar o link'}
    </Button>
  );
}

const Step = ({ n, children, dark }: { n: number; children: React.ReactNode; dark?: boolean }) => (
  <li className="flex gap-3">
    <span className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold', dark ? 'bg-ivory text-burgundy' : 'bg-burgundy text-ivory')}>{n}</span>
    <span className="pt-0.5">{children}</span>
  </li>
);
const Ic = ({ i: I }: { i: typeof Share }) => <I className="mx-0.5 inline h-4 w-4 -translate-y-px" aria-hidden />;

export function IOSSteps({ dark }: { dark?: boolean }) {
  return (
    <ol className="space-y-3">
      <Step n={1} dark={dark}>No Safari, toque em <Ic i={Share} /> <b>Compartilhar</b>. Na versão mais nova do iPhone, ele fica dentro do botão <b>⋯</b>.</Step>
      <Step n={2} dark={dark}>Role a lista e toque em <Ic i={SquarePlus} /> <b>Adicionar à Tela de Início</b>.</Step>
      <Step n={3} dark={dark}>Toque em <b>Adicionar</b> e abra o clube pelo ícone. Se pedir, entre com seu e-mail e senha.</Step>
    </ol>
  );
}

export function AndroidSteps({ dark }: { dark?: boolean }) {
  return (
    <ol className="space-y-3">
      <Step n={1} dark={dark}>No Chrome, toque no menu <Ic i={EllipsisVertical} /> no alto da tela.</Step>
      <Step n={2} dark={dark}>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</Step>
      <Step n={3} dark={dark}>Confirme e abra o clube pelo ícone.</Step>
    </ol>
  );
}

/** Instruções para o aparelho em uso. */
export function InstallSteps({ dark }: { dark?: boolean }) {
  const { mode, canPrompt, install } = useInstall();
  const muted = dark ? 'text-ivory/75' : 'text-muted';
  if (mode === 'loading') return null;
  if (mode === 'installed') return <p className={clsx('text-[14px]', dark ? 'text-dusty' : 'text-olive-ink')}>O app já está instalado neste aparelho.</p>;
  if (canPrompt) return <Button full variant={dark ? 'light' : 'primary'} onClick={install}>Instalar o THE SEVEN CLUB</Button>;
  if (mode === 'ios') return <IOSSteps dark={dark} />;
  if (mode === 'android') return <AndroidSteps dark={dark} />;
  if (mode === 'ios-other' || mode === 'inapp')
    return (
      <div className="space-y-3">
        <p>
          {mode === 'inapp'
            ? 'Você abriu o link dentro de outro app. Toque nos três pontinhos e escolha “Abrir no navegador”, ou copie o link e cole no Safari (iPhone) ou no Chrome (Android).'
            : 'No iPhone, a instalação funciona melhor pelo Safari. Copie o link e cole no Safari.'}
        </p>
        <CopyLink dark={dark} />
      </div>
    );
  return <p className={muted}>Abra este endereço no celular para instalar: <b className={dark ? 'text-ivory' : 'text-espresso'}>{typeof window !== 'undefined' ? window.location.host : ''}/instalar</b></p>;
}

/** Bloco usado em Ajustes. */
export function InstallApp() {
  return <div className="py-3 text-[14px] leading-snug"><InstallSteps /></div>;
}
