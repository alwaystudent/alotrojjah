import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Silent Automatic PWA Update Engine
// Ensures the app always stays updated silently without manual cache clearing or reinstalling
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const hadControllerAtLoad = Boolean(navigator.serviceWorker.controller);
  let pendingSilentReload = false;
  let lastUpdateCheckAt = 0;
  let swReloading = false;

  const canSafelyApplyReload = () => {
    const win = window as unknown as {
      __alutrujjahActiveVoiceCall?: boolean;
      __alutrujjahActiveRecitation?: boolean;
    };
    return !win.__alutrujjahActiveVoiceCall && !win.__alutrujjahActiveRecitation;
  };

  const applySilentReloadIfSafe = () => {
    if (swReloading) return;
    if (!canSafelyApplyReload()) {
      pendingSilentReload = true;
      return;
    }
    swReloading = true;
    window.location.reload();
  };

  window.addEventListener('alutrujjah:call-ended', () => {
    if (pendingSilentReload) {
      pendingSilentReload = false;
      applySilentReloadIfSafe();
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only reload when replacing a previously active SW version (not on initial install)
    if (!hadControllerAtLoad) return;
    applySilentReloadIfSafe();
  });

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkSilentlyForUpdate = () => {
        const now = Date.now();
        if (now - lastUpdateCheckAt < 45_000) return;
        lastUpdateCheckAt = now;
        registration.update().catch(() => {});
      };

      const win = window as unknown as {
        __alutrujjahCheckSilentUpdate?: () => void;
      };
      win.__alutrujjahCheckSilentUpdate = checkSilentlyForUpdate;

      // Silent check shortly after launch, periodically, and when returning to the app
      window.setTimeout(checkSilentlyForUpdate, 2500);
      window.setInterval(checkSilentlyForUpdate, 5 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkSilentlyForUpdate();
        }
      });
    },
    onNeedRefresh() {
      // Activate new Service Worker silently immediately
      updateSW(true).catch(() => {});
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
