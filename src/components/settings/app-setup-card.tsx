'use client';
import { useEffect, useState } from 'react';
import { BellRing, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstallSteps, useInstall } from './install-app';
import { usePush } from './push-toggle';

/**
 * Cartão do feed que leva a integrante a instalar o app e, depois de instalado,
 * a ligar as notificações. Some por 7 dias quando ela toca em “Agora não”.
 */
const KEY = 'seven:setup-card';
const SNOOZE = 7 * 24 * 60 * 60 * 1000;
const snoozed = (what: string) => { try { return Number(localStorage.getItem(`${KEY}:${what}`) || 0) > Date.now(); } catch { return false; } };
const snooze = (what: string) => { try { localStorage.setItem(`${KEY}:${what}`, String(Date.now() + SNOOZE)); } catch { /* armazenamento indisponível */ } };

export function AppSetupCard({ welcome = false }: { welcome?: boolean }) {
  const { mode, canPrompt, install } = useInstall();
  const push = usePush();
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(welcome);
  useEffect(() => setHidden({ install: !welcome && snoozed('install'), push: snoozed('push') }), [welcome]);

  const close = (what: string) => { snooze(what); setHidden((h) => ({ ...h, [what]: true })); };
  const shell = 'relative mx-4 mt-4 rounded-[var(--radius-card)] bg-paper p-4 pr-11 ring-1 ring-line';
  const dismiss = (what: string) => (
    <button type="button" onClick={() => close(what)} aria-label="Agora não" className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-burgundy/5">
      <X className="h-4 w-4" />
    </button>
  );

  // 1. instalar (só no celular; no computador o clube segue pelo navegador)
  if (mode !== 'loading' && mode !== 'installed' && mode !== 'desktop' && !hidden.install) {
    return (
      <section className={shell} aria-label="Instalar o app" data-install-prompt>
        {dismiss('install')}
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-burgundy text-ivory"><Smartphone className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1 leading-snug">
            <p className="font-semibold">Leve o clube para a tela de início</p>
            <p className="mt-0.5 text-[13px] text-muted">Instale o app direto daqui, sem loja, para abrir em um toque e receber os avisos do clube.</p>
          </div>
        </div>
        <div className="mt-3 text-[14px] leading-snug">
          {canPrompt ? <Button full onClick={install}>Instalar o app</Button>
            : open ? <InstallSteps />
            : <Button full variant="secondary" onClick={() => setOpen(true)}>Ver como instalar</Button>}
        </div>
      </section>
    );
  }

  // 2. notificações, com o app já instalado
  if (mode === 'installed' && push.state === 'off' && !hidden.push) {
    return (
      <section className={shell} aria-label="Ativar notificações">
        {dismiss('push')}
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-burgundy text-ivory"><BellRing className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1 leading-snug">
            <p className="font-semibold">Ative as notificações</p>
            <p className="mt-0.5 text-[13px] text-muted">Para saber do livro do mês, dos encontros e da sua afirmação do dia. Você escolhe o que receber em Ajustes.</p>
          </div>
        </div>
        <Button full className="mt-3" onClick={async () => { if (await push.enable()) close('push'); }}>Ativar notificações</Button>
      </section>
    );
  }
  return null;
}
