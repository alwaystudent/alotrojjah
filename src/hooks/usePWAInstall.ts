import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type BrowserType = 'ios' | 'samsung' | 'firefox' | 'mac_safari' | 'chromium' | 'other';

const STORAGE_KEY_PWA_INSTALLED = 'alutrujjah_pwa_installed_v1';
const STORAGE_KEY_PWA_ALERT_DISMISSED = 'alutrujjah_pwa_single_alert_dismissed_v1';

function detectStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as unknown as { standalone?: boolean };
  const byDisplayMode =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches;
  const byIOSStandalone = nav.standalone === true;
  const byTWA = typeof document !== 'undefined' && document.referrer.startsWith('android-app://');
  return Boolean(byDisplayMode || byIOSStandalone || byTWA);
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (detectStandaloneDisplay()) return true;
    try {
      return localStorage.getItem(STORAGE_KEY_PWA_INSTALLED) === 'true';
    } catch {
      return false;
    }
  });
  const [alertDismissed, setAlertDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEY_PWA_ALERT_DISMISSED) === 'true';
    } catch {
      return false;
    }
  });
  const [isIOS, setIsIOS] = useState(false);
  const [browserType, setBrowserType] = useState<BrowserType>('chromium');

  useEffect(() => {
    let cancelled = false;

    const markInstalled = () => {
      if (cancelled) return;
      setIsInstalled(true);
      setDeferredPrompt(null);
      try {
        localStorage.setItem(STORAGE_KEY_PWA_INSTALLED, 'true');
      } catch {
        // ignore
      }
    };

    if (detectStandaloneDisplay()) {
      markInstalled();
    } else if (typeof navigator !== 'undefined') {
      // Smart check via Web App Installed Related Apps API when available
      const navWithRelated = navigator as unknown as {
        getInstalledRelatedApps?: () => Promise<Array<{ platform?: string }>>;
      };
      if (typeof navWithRelated.getInstalledRelatedApps === 'function') {
        navWithRelated
          .getInstalledRelatedApps()
          .then((apps) => {
            if (!cancelled && Array.isArray(apps) && apps.length > 0) {
              markInstalled();
            }
          })
          .catch(() => {});
      }
    }

    // Trigger silent SW update check when checking installation state
    const win = window as unknown as { __alutrujjahCheckSilentUpdate?: () => void };
    if (typeof win.__alutrujjahCheckSilentUpdate === 'function') {
      win.__alutrujjahCheckSilentUpdate();
    }

    // Detect browser environment
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      setBrowserType('ios');
    } else if (/samsungbrowser/.test(userAgent)) {
      setBrowserType('samsung');
    } else if (/firefox/.test(userAgent)) {
      setBrowserType('firefox');
    } else if (/macintosh/.test(userAgent) && /safari/.test(userAgent) && !/chrome/.test(userAgent)) {
      setBrowserType('mac_safari');
    } else {
      setBrowserType('chromium');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // If browser explicitly offers beforeinstallprompt, app is not currently installed
      if (!detectStandaloneDisplay()) {
        setIsInstalled(false);
        try {
          localStorage.removeItem(STORAGE_KEY_PWA_INSTALLED);
        } catch {
          // ignore
        }
      }
    };

    const handleAppInstalled = () => {
      markInstalled();
      // Sync silent SW update immediately upon installation
      const w = window as unknown as { __alutrujjahCheckSilentUpdate?: () => void };
      if (typeof w.__alutrujjahCheckSilentUpdate === 'function') {
        w.__alutrujjahCheckSilentUpdate();
      }
    };

    const standaloneMq = window.matchMedia('(display-mode: standalone)');
    const handleDisplayChange = () => {
      if (detectStandaloneDisplay()) {
        markInstalled();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    if (typeof standaloneMq.addEventListener === 'function') {
      standaloneMq.addEventListener('change', handleDisplayChange);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (typeof standaloneMq.removeEventListener === 'function') {
        standaloneMq.removeEventListener('change', handleDisplayChange);
      }
    };
  }, []);

  const dismissSingleAlert = useCallback(() => {
    setAlertDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY_PWA_ALERT_DISMISSED, 'true');
    } catch {
      // ignore
    }
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        try {
          localStorage.setItem(STORAGE_KEY_PWA_INSTALLED, 'true');
        } catch {
          // ignore
        }
        return true;
      }
    } catch {
      // Ignored
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    shouldShowSingleAlert: !isInstalled && !alertDismissed,
    dismissSingleAlert,
    isIOS,
    browserType,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
