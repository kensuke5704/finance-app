"use client";

import { useEffect, useState } from "react";

export default function PwaRegister() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // PWA registration failed. The app still works normally online.
        });
      });
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setCanInstall(true);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setCanInstall(false);
      localStorage.setItem("finance-pwa-installed", "true");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanInstall(false);
  }

  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={install}
      className="fixed bottom-4 right-4 z-[9999] rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-slate-700"
    >
      ホーム画面に追加
    </button>
  );
}
