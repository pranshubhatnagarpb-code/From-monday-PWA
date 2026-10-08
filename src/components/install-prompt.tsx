import { useEffect, useState, type ReactNode } from "react";
import { Download, EllipsisVertical, Link2, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isInAppBrowser, isIosSafari, useInstallPrompt } from "@/hooks/use-install-prompt";

const DISMISS_KEY = "fm-install-dismissed-at";
const DISMISS_DAYS = 7;
// Some Android browsers never fire `beforeinstallprompt`; after this delay we show manual steps instead.
const ANDROID_FALLBACK_DELAY_MS = 4000;

const recentlyDismissed = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <span className="flex flex-wrap items-center gap-1 text-sm text-foreground">{children}</span>
    </li>
  );
}

const Key = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 text-xs font-medium">
    {children}
  </span>
);

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.origin);
          setCopied(true);
        } catch {
          /* clipboard unavailable — user can still copy from the address bar */
        }
      }}
    >
      <Link2 /> {copied ? "Link copied" : "Copy link"}
    </Button>
  );
}

/** Platform-specific install instructions / action. Returns null when nothing useful can be shown. */
function InstallBody({ showAndroidFallback }: { showAndroidFallback: boolean }) {
  const { canPrompt, promptInstall, platform } = useInstallPrompt();

  if (isInAppBrowser) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          To install, open this page in {platform === "ios" ? "Safari" : "Chrome"}: tap the{" "}
          <Key>⋯</Key> menu and choose <Key>Open in browser</Key>, or copy the link and paste it
          there.
        </p>
        <CopyLinkButton />
      </div>
    );
  }

  if (canPrompt) {
    return (
      <Button className="w-full" onClick={() => promptInstall()}>
        <Download /> Install app
      </Button>
    );
  }

  if (platform === "ios") {
    return (
      <ol className="space-y-2.5">
        <Step n={1}>
          Tap{" "}
          <Key>
            <Share className="h-3.5 w-3.5" /> Share
          </Key>
          {isIosSafari ? "at the bottom of Safari" : "in the address bar"}
        </Step>
        <Step n={2}>
          Scroll down and tap{" "}
          <Key>
            <SquarePlus className="h-3.5 w-3.5" /> Add to Home Screen
          </Key>
        </Step>
        <Step n={3}>
          Tap <Key>Add</Key> in the top-right corner
        </Step>
      </ol>
    );
  }

  if (platform === "android" && showAndroidFallback) {
    return (
      <ol className="space-y-2.5">
        <Step n={1}>
          Tap the browser menu{" "}
          <Key>
            <EllipsisVertical className="h-3.5 w-3.5" />
          </Key>
        </Step>
        <Step n={2}>
          Tap <Key>Install app</Key> or <Key>Add to Home screen</Key>
        </Step>
      </ol>
    );
  }

  return null;
}

function useAndroidFallback() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), ANDROID_FALLBACK_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  return show;
}

const AppIcon = () => (
  <img
    src="/icons/icon-192.png"
    alt=""
    className="h-11 w-11 shrink-0 rounded-xl border shadow-sm"
  />
);

/** Floating banner shown to visitors using the portal in a browser tab. */
export function InstallBanner() {
  const { canPrompt, isInstalled, platform } = useInstallPrompt();
  const showAndroidFallback = useAndroidFallback();
  const [dismissed, setDismissed] = useState(recentlyDismissed);

  const hasSomethingToShow =
    isInAppBrowser ||
    canPrompt ||
    platform === "ios" ||
    (platform === "android" && showAndroidFallback);
  if (isInstalled || dismissed || !hasSomethingToShow) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore — banner just reappears next visit */
    }
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-label="Install the From Monday app"
      className="fixed inset-x-3 z-[60] mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 rounded-2xl border bg-card p-4 shadow-xl"
      style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mb-3 flex items-start gap-3">
        <AppIcon />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">Install From Monday</p>
          <p className="text-xs text-muted-foreground">
            Add the app to your home screen for one-tap access to your diet plan and progress.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="-m-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <InstallBody showAndroidFallback={showAndroidFallback} />
    </div>
  );
}

/** Always-available install card (e.g. on the profile page) — ignores the banner's dismissal. */
export function InstallAppCard() {
  const { canPrompt, isInstalled, platform } = useInstallPrompt();
  if (isInstalled || (platform === "desktop" && !canPrompt && !isInAppBrowser)) return null;

  return (
    <div className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <AppIcon />
        <div>
          <p className="font-semibold text-foreground">Get the app</p>
          <p className="text-xs text-muted-foreground">
            Install From Monday on your phone's home screen.
          </p>
        </div>
      </div>
      <InstallBody showAndroidFallback />
    </div>
  );
}
