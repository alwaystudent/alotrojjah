import { memoryManager } from './memoryCleanup';

type RingtoneMode = 'incoming' | 'outgoing';

class CallRingtoneManager {
  private audioCtx: AudioContext | null = null;
  private unregisterCtx: (() => void) | null = null;
  private loopTimer: number | null = null;
  private activeMode: RingtoneMode | null = null;
  private activeNodes: AudioNode[] = [];

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return null;

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioCtxCtor();
      if (this.unregisterCtx) this.unregisterCtx();
      this.unregisterCtx = memoryManager.registerAudioContext(this.audioCtx);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public unlockAudio(): void {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      // Silent 1-sample buffer unlock for iOS/Safari/Chrome autoplay policies
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // Ignore audio unlock errors when blocked
    }
  }

  private playTone(freq: number, startOffsetSec: number, durationSec: number, peakGain: number) {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'closed') return;
    try {
      const now = ctx.currentTime + startOffsetSec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + durationSec + 0.02);

      this.activeNodes.push(osc, gain);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
  }

  private triggerPattern(mode: RingtoneMode) {
    if (mode === 'incoming') {
      // Pleasant warm chime arpeggio (D5 -> F#5 -> A5) repeated gently
      this.playTone(587.33, 0.0, 0.22, 0.12);
      this.playTone(739.99, 0.16, 0.22, 0.12);
      this.playTone(880.0, 0.32, 0.34, 0.14);
      this.playTone(587.33, 0.82, 0.2, 0.09);
      this.playTone(880.0, 0.98, 0.32, 0.11);
    } else {
      // Soft outgoing ringback tone
      this.playTone(440.0, 0.0, 0.42, 0.05);
      this.playTone(480.0, 0.0, 0.42, 0.04);
    }
  }

  public start(mode: RingtoneMode): void {
    if (this.activeMode === mode && this.loopTimer !== null) return;
    this.stop();
    this.activeMode = mode;
    this.triggerPattern(mode);
    const intervalMs = mode === 'incoming' ? 2300 : 2800;
    this.loopTimer = window.setInterval(() => {
      if (this.activeMode === mode) {
        this.triggerPattern(mode);
      }
    }, intervalMs);
  }

  public playErrorAlertCue(): void {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([90, 50, 90]);
      }
      const ctx = this.ensureContext();
      if (!ctx || ctx.state === 'closed') return;
      this.playTone(523.25, 0.0, 0.14, 0.11);
      this.playTone(392.0, 0.13, 0.2, 0.11);
    } catch {
      // Ignore audio/vibration errors
    }
  }

  public stop(): void {
    this.activeMode = null;
    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    this.activeNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeNodes = [];
  }
}

export const callRingtone = new CallRingtoneManager();

let fallbackNotificationRef: Notification | null = null;

export async function dispatchBackgroundCallNotification(params: {
  sessionId: string;
  callerName: string;
  surahLabel?: string;
  ayahRange?: string;
  lang: 'ar' | 'en';
}): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const targetSw = reg?.active || navigator.serviceWorker.controller;
      if (targetSw) {
        targetSw.postMessage({
          type: 'SHOW_CALL_NOTIFICATION',
          ...params,
        });
        return;
      }
    }
  } catch {
    // Fallback to direct Notification API below
  }

  try {
    if (fallbackNotificationRef) {
      fallbackNotificationRef.close();
      fallbackNotificationRef = null;
    }
    const title =
      params.lang === 'ar'
        ? `مكالمة سرد ثنائي من ${params.callerName}`
        : `Incoming Duo Call from ${params.callerName}`;
    const body = [params.surahLabel, params.ayahRange].filter(Boolean).join(' · ');
    fallbackNotificationRef = new Notification(title, {
      body: body || (params.lang === 'ar' ? 'اضغط للرد على المكالمة' : 'Tap to answer call'),
      tag: `duo-call-${params.sessionId}`,
      requireInteraction: true,
    });
  } catch {
    // Ignore unsupported Notification options on mobile browsers
  }
}

export async function dismissBackgroundCallNotification(sessionId?: string): Promise<void> {
  if (fallbackNotificationRef) {
    try {
      fallbackNotificationRef.close();
    } catch {
      // ignore
    }
    fallbackNotificationRef = null;
  }

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const targetSw = reg?.active || navigator.serviceWorker.controller;
    if (targetSw) {
      targetSw.postMessage({
        type: 'CLOSE_CALL_NOTIFICATION',
        sessionId: sessionId || null,
      });
    }
  } catch {
    // ignore
  }
}
