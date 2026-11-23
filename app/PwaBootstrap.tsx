"use client";
import { useEffect } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
declare global {
  interface Window {
    __twofoldInstallPrompt?: InstallEvent;
  }
}
export default function PwaBootstrap() {
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js")
        .catch((error) =>
          console.error("[pwa] service worker registration failed", error),
        );
    let lastSessionRefresh = 0;
    const refreshSession = () => {
      if (
        document.visibilityState !== "visible" ||
        Date.now() - lastSessionRefresh < 12 * 60 * 60 * 1000
      )
        return;
      lastSessionRefresh = Date.now();
      void fetch("/api/auth/session", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => {});
    };
    refreshSession();
    document.addEventListener("visibilitychange", refreshSession);
    const capture = (event: Event) => {
      event.preventDefault();
      window.__twofoldInstallPrompt = event as InstallEvent;
      window.dispatchEvent(new Event("twofold-install-available"));
    };
    const installed = () => {
      window.__twofoldInstallPrompt = undefined;
      window.dispatchEvent(new Event("twofold-app-installed"));
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      document.removeEventListener("visibilitychange", refreshSession);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return null;
}
