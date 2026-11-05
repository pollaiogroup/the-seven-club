'use client';
import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { removePushSubscription, savePushSubscription } from '@/actions/profile';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';

const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const toBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export type PushState = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on' | 'unconfigured';

/** Estado e ações das notificações push neste aparelho. */
export function usePush() {
  const [state, setState] = useState<PushState>('loading');
  useEffect(() => {
    (async () => {
      if (!key) return setState('unconfigured');
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState(ios && !standalone ? 'ios-install' : 'unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })();
  }, []);

  async function enable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('denied'); return false; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushSubscription(json, navigator.userAgent);
      if (r?.error) throw new Error(r.error);
      setState('on');
      toast('Notificações ativadas neste aparelho');
      return true;
    } catch (e) {
      toast((e as Error).message || 'Não foi possível ativar.', 'error');
      return false;
    }
  }
  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
    setState('off');
    toast('Notificações desativadas neste aparelho');
  }
  return { state, enable, disable };
}

export function PushToggle() {
  const { state, enable, disable } = usePush();
  const text: Record<string, string> = {
    loading: 'Verificando…',
    unsupported: 'Este navegador não recebe notificações. Instale o app ou use outro navegador.',
    'ios-install': 'No iPhone, as notificações funcionam com o app instalado na tela de início. Veja como instalar abaixo.',
    denied: 'As notificações foram bloqueadas. Libere nas configurações do navegador ou do celular.',
    unconfigured: 'As notificações no celular ainda não foram configuradas pela administração. Os avisos continuam aparecendo no sino.',
    off: 'Receba avisos mesmo com o app fechado.',
    on: 'Ativadas neste aparelho.',
  };
  return (
    <div className="flex items-center gap-4 py-3">
      <BellRing className="h-5 w-5 shrink-0 text-burgundy" />
      <p className="flex-1 text-[14px] leading-snug">{text[state]}</p>
      {state === 'off' && <Button size="sm" onClick={enable}>Ativar</Button>}
      {state === 'on' && <Button size="sm" variant="secondary" onClick={disable}>Desativar</Button>}
    </div>
  );
}
