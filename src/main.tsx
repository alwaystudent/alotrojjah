import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Automatic seamless PWA updates — applies new releases immediately without manual cache clearing or reinstall
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let pendingReloadAfterCall = false;
  let lastUpdateCheckAt = 0;

  const triggerSafeReload = () => {
    const win = window as unknown as { __alutrujjahActiveVoiceCall?: boolean };
    if (win.__alutrujjahActiveVoiceCall) {
      pendingReloadAfterCall = true;
      return;
    }
    window.location.reload();
  };

  window.addEventListener('alutrujjah:call-ended', () => {
    if (pendingReloadAfterCall) {
      pendingReloadAfterCall = false;
      window.location.reload();
    }
  });

  let swReloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swReloading) return;
    swReloading = true;
    triggerSafeReload();
  });

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = () => {
        const now = Date.now();
        if (now - lastUpdateCheckAt < 45_000) return;
        lastUpdateCheckAt = now;
        registration.update().catch(() => {});
      };

      // Check shortly after startup, periodically, and when user returns to the app
      window.setTimeout(checkForUpdate, 3000);
      window.setInterval(checkForUpdate, 5 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate();
        }
      });
    },
    onNeedRefresh() {
      // With skipWaiting + clientsClaim enabled, force activation immediately
      updateSW(true).catch(() => {});
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
