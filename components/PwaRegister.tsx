"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    navigator.serviceWorker.register(`${basePath}/sw.js`).catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  return null;
}
