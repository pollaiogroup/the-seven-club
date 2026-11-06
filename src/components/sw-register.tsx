'use client';
import { useEffect } from 'react';
import { toast } from '@/components/ui/toaster';

/** Registra o service worker e avisa quando há uma versão nova do app. */
export function ServiceWorker() {
  useEffect(() => {
    if (!navigator.serviceWorker || process.env.NODE_ENV !== 'production') return;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
      reg?.addEventListener('updatefound', () => {
        const next = reg.installing;
        next?.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Atualizando para a nova versão…');
            next.postMessage('SKIP_WAITING');
          }
        });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    });
  }, []);
  return null;
}
