import { useCallback, useEffect, useState } from 'react';
import { markTelemetryInstalled } from '../utils/deviceTelemetry';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type BrowserType = 'ios' | 'samsung' | 'firefox' | 'mac_safari' | 'chromium' | 'other';

const STORAGE_KEY_PWA_INSTALLED = 'alutrujjah_pwa_installed_v1';
const STORAGE_KEY_PWA_ALERT_DISMISSED = 'alutrujjah_pwa_single_alert_dismissed_v1';

interface PWAWindow extends Window {
  __alutrujjahDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
  __alutrujjahCheckSilentUpdate?: () => void;
}

let sharedDeferredPrompt: BeforeInstallPromptEvent | null =
  typeof window !== 'undefined'
    ? ((window as PWAWindow).__alutrujjahDeferredInstallPrompt ?? null)
    : null;

const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

function setSharedPrompt(prompt: BeforeInstallPromptEvent | null) {
  sharedDeferredPrompt = prompt;
  if (typeof window !== 'undefined') {
    (window as PWAWindow).__alutrujjahDeferredInstallPrompt = prompt;
  }
  promptListeners.forEach((listener) => listener(prompt));
}

function getLatestDeferredPrompt(): BeforeInstallPromptEvent | null {
  if (sharedDeferredPrompt) return sharedDeferredPrompt;
  if (typeof window !== 'undefined') {
    const winPrompt = (window as PWAWindow).__alutrujjahDeferredInstallPrompt;
    if (winPrompt) {
      sharedDeferredPrompt = winPrompt;
      return winPrompt;
    }
  }
  return null;
}

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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    getLatestDeferredPrompt()
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (detectStandaloneDisplay()) return true;
    // If browser already fired beforeinstallprompt before mount, it's definitely not installed
    if (getLatestDeferredPrompt()) return false;
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

    const markInstalled = (source: 'standalone' | 'pwa_prompt' = 'pwa_prompt') => {
      if (cancelled) return;
      setIsInstalled(true);
      setSharedPrompt(null);
      markTelemetryInstalled(source);
    };

    const syncPromptListener = (prompt: BeforeInstallPromptEvent | null) => {
      if (cancelled) return;
      setDeferredPrompt(prompt);
      if (prompt && !detectStandaloneDisplay()) {
        setIsInstalled(false);
        try {
          localStorage.removeItem(STORAGE_KEY_PWA_INSTALLED);
        } catch {
          // ignore
        }
      }
    };
    promptListeners.add(syncPromptListener);

    // Sync immediately in case head script captured beforeinstallprompt before mount
    const existingPrompt = getLatestDeferredPrompt();
    if (existingPrompt) {
      syncPromptListener(existingPrompt);
    }

    if (detectStandaloneDisplay()) {
      markInstalled('standalone');
    } else if (typeof navigator !== 'undefined' && !existingPrompt) {
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
    const win = window as PWAWindow;
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
      setSharedPrompt(e as BeforeInstallPromptEvent);
    };

    const handleHeadPromptReady = () => {
      const latest = getLatestDeferredPrompt();
      if (latest) {
        syncPromptListener(latest);
      }
    };

    const handleAppInstalled = () => {
      markInstalled();
      // Sync silent SW update immediately upon installation
      const w = window as PWAWindow;
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
    window.addEventListener('alutrujjah:pwa-prompt-ready', handleHeadPromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('alutrujjah:pwa-installed', handleAppInstalled);
    if (typeof standaloneMq.addEventListener === 'function') {
      standaloneMq.addEventListener('change', handleDisplayChange);
    }

    return () => {
      cancelled = true;
      promptListeners.delete(syncPromptListener);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('alutrujjah:pwa-prompt-ready', handleHeadPromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('alutrujjah:pwa-installed', handleAppInstalled);
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

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptEvent = deferredPrompt ?? getLatestDeferredPrompt();
    if (!promptEvent) return 'unavailable';
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      setSharedPrompt(null);
      if (outcome === 'accepted') {
        setIsInstalled(true);
        markTelemetryInstalled('pwa_prompt');
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt || getLatestDeferredPrompt()),
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
