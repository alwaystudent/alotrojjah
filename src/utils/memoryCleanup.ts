/**
 * Memory & RAM Automatic Cleanup Manager for Al-Utrujjah Platform
 * Ensures all device resources (Microphone tracks, AudioContexts, SpeechRecognition,
 * intervals, animation frames, and object URLs) are immediately freed upon app close (pagehide/beforeunload)
 * or session completion to prevent memory leaks and protect user device RAM.
 */

type CleanupTask = () => void;

class MemoryCleanupManager {
  private cleanupTasks: Set<CleanupTask> = new Set();
  private activeStreams: Set<MediaStream> = new Set();
  private activeAudioContexts: Set<AudioContext> = new Set();
  private activeIntervals: Set<number> = new Set();
  private isRegistered = false;

  public init() {
    if (this.isRegistered || typeof window === 'undefined') return;
    this.isRegistered = true;

    // Automatic cleanup triggered when closing the tab, browser, or navigating away
    window.addEventListener('pagehide', () => this.runFullCleanup());
    window.addEventListener('beforeunload', () => this.runFullCleanup());
    window.addEventListener('unload', () => this.runFullCleanup());

    // Also run cleanup when document becomes hidden to save mobile RAM in background
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushTransientCaches();
      }
    });
  }

  /**
   * Register a custom cleanup task
   */
  public register(task: CleanupTask): () => void {
    this.cleanupTasks.add(task);
    return () => {
      this.cleanupTasks.delete(task);
    };
  }

  /**
   * Register an active MediaStream (e.g. mic stream) for guaranteed release
   */
  public registerStream(stream: MediaStream): () => void {
    this.activeStreams.add(stream);
    return () => {
      this.activeStreams.delete(stream);
    };
  }

  /**
   * Register an AudioContext for guaranteed closure
   */
  public registerAudioContext(ctx: AudioContext): () => void {
    this.activeAudioContexts.add(ctx);
    return () => {
      this.activeAudioContexts.delete(ctx);
    };
  }

  /**
   * Clean up all active streams, contexts, and registered tasks immediately
   */
  public runFullCleanup(): void {
    // 1. Stop all microphone and media tracks immediately
    this.activeStreams.forEach((stream) => {
      try {
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch {
        // Ignored
      }
    });
    this.activeStreams.clear();

    // 2. Close all AudioContexts
    this.activeAudioContexts.forEach((ctx) => {
      try {
        if (ctx.state !== 'closed') {
          ctx.close();
        }
      } catch {
        // Ignored
      }
    });
    this.activeAudioContexts.clear();

    // 3. Run all registered custom cleanup callbacks
    this.cleanupTasks.forEach((task) => {
      try {
        task();
      } catch {
        // Ignored
      }
    });
    this.cleanupTasks.clear();

    // 4. Flush transient browser performance and resource timings
    this.flushTransientCaches();
  }

  public flushTransientCaches(): void {
    try {
      if (typeof window !== 'undefined' && window.performance && window.performance.clearResourceTimings) {
        window.performance.clearResourceTimings();
      }
      if (typeof window !== 'undefined' && window.performance && window.performance.clearMarks) {
        window.performance.clearMarks();
      }
    } catch {
      // Ignored
    }
  }
}

export const memoryManager = new MemoryCleanupManager();

// Automatically initialize in browser environment
if (typeof window !== 'undefined') {
  memoryManager.init();
}
