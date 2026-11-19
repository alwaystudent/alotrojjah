/**
 * Synthesized Web Audio Ringtone & Service Worker Persistent Call Notification Helper
 * Requires zero external MP3 dependencies and cleanly releases AudioContext resources.
 */

class CallRingtoneManager {
  private audioCtx: AudioContext | null = null;
  private intervalId: number | null = null;
  private isPlaying = false;

  public unlockAudio(): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    } catch {
      // Ignore if AudioContext blocked prior to gesture
    }
  }

  private playToneBurst(mode: 'incoming' | 'outgoing') {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const notes =
        mode === 'incoming'
          ? [
              { freq: 659.25, start: 0, dur: 0.22 },
              { freq: 783.99, start: 0.2, dur: 0.22 },
              { freq: 987.77, start: 0.4, dur: 0.35 },
              { freq: 783.99, start: 0.85, dur: 0.2 },
              { freq: 987.77, start: 1.05, dur: 0.4 },
            ]
          : [
              { freq: 440, start: 0, dur: 0.45 },
              { freq: 523.25, start: 0.05, dur: 0.45 },
            ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = mode === 'incoming' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        gain.gain.setValueAtTime(0.001, now + n.start);
        gain.gain.exponentialRampToValueAtTime(
          mode === 'incoming' ? 0.18 : 0.08,
          now + n.start + 0.04
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.05);
      });

      if (mode === 'incoming' && typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([260, 120, 260]);
        } catch {
          // ignore
        }
      }
    } catch {
      // Audio playback blocked by autoplay until interaction
    }
  }

  public start(mode: 'incoming' | 'outgoing' = 'incoming'): void {
    this.stop();
    this.isPlaying = true;
    this.playToneBurst(mode);
    const intervalMs = mode === 'incoming' ? 2100 : 2800;
    this.intervalId = window.setInterval(() => {
      if (!this.isPlaying) return;
      this.playToneBurst(mode);
    }, intervalMs);
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch {
        // ignore
      }
    }
  }
}

export const callRingtone = new CallRingtoneManager();

export async function dispatchBackgroundCallNotification(params: {
  sessionId: string;
  callerName: string;
  surahLabel: string;
  ayahRange: string;
  lang: 'ar' | 'en';
}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active) {
        reg.active.postMessage({
          type: 'SHOW_CALL_NOTIFICATION',
          ...params,
        });
        return;
      }
    }
  } catch {
    // Fallback below
  }

  try {
    const isAr = params.lang !== 'en';
    new Notification(
      isAr
        ? `مكالمة سرد ثنائي واردة من ${params.callerName}`
        : `Incoming Duo Sard Call from ${params.callerName}`,
      {
        body: `${params.surahLabel} (${params.ayahRange})`,
        icon: '/pwa-192x192.png',
        tag: `alutrujjah-call-${params.sessionId}`,
        requireInteraction: true,
        silent: false,
      }
    );
  } catch {
    // Ignore restricted Notification inside iframe
  }
}

export async function dismissBackgroundCallNotification(sessionId: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active) {
        reg.active.postMessage({
          type: 'CLOSE_CALL_NOTIFICATION',
          sessionId,
        });
      }
      if (reg && reg.getNotifications) {
        const notifs = await reg.getNotifications({ tag: `alutrujjah-call-${sessionId}` });
        notifs.forEach((n) => n.close());
      }
    }
  } catch {
    // Ignore
  }
}
