'use client';
import { useEffect } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
declare global { interface Window { __quekunleInstallPrompt?: InstallEvent } }
export default function PwaBootstrap() {
  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(error => console.error('[pwa] service worker registration failed', error));
    const capture = (event: Event) => { event.preventDefault(); window.__quekunleInstallPrompt = event as InstallEvent; window.dispatchEvent(new Event('quekunle-install-available')); };
    const installed = () => { window.__quekunleInstallPrompt = undefined; window.dispatchEvent(new Event('quekunle-app-installed')); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installed); };
  }, []);
  return null;
}
