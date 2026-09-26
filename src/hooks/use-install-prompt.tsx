import { useSyncExternalStore } from "react";

// Chromium's install event (Android Chrome, Edge, Samsung Internet, desktop Chrome).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "ios" | "android" | "desktop";

// The event can fire before React mounts, so it is captured at module load
// (this file is imported from main.tsx) and exposed through a tiny store.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own banner instead of the mini-infobar
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    emit();
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

export const platform: InstallPlatform =
  /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
    ? "ios"
    : /android/i.test(ua)
      ? "android"
      : "desktop";

// In-app browsers (Instagram, Facebook, etc.) can't install PWAs — the user must open the link in a real browser.
export const isInAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|LinkedInApp|GSA\//i.test(ua);

// iOS only allows "Add to Home Screen" from Safari (and, from iOS 16.4, Chrome/Edge via the Share menu).
export const isIosSafari = platform === "ios" && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);

export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferredPrompt !== null, () => false);
  const isInstalled = useSyncExternalStore(subscribe, () => installed || isStandalone(), () => false);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    const evt = deferredPrompt;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferredPrompt = null; // the event can only be used once
    emit();
    return outcome === "accepted";
  };

  return { canPrompt, isInstalled, promptInstall, platform };
}
