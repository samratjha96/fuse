import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimelineStore } from '../store/timeline';

// =============================================================================
// PER-SOURCE FRAME CACHE
// =============================================================================
// Each video source has its own frame cache to prevent mixing frames from
// different videos. Uses LRU eviction based on distance from playhead.

interface SourceCache {
  frames: Map<number, ImageBitmap>; // timestamp -> frame
  sortedTimestamps: number[]; // Sorted for binary search
  lastAccessTime: number;
}

// Maximum frames per source
const MAX_FRAMES_PER_SOURCE = 300;
// Maximum total sources to cache
const MAX_CACHED_SOURCES = 10;

/**
 * Per-source frame cache manager
 */
class FrameCacheManager {
  private caches = new Map<string, SourceCache>();

  /**
   * Add a frame to the cache for a specific source
   */
  addFrame(sourceId: string, timestamp: number, frame: ImageBitmap): void {
    let cache = this.caches.get(sourceId);

    if (!cache) {
      cache = {
        frames: new Map(),
        sortedTimestamps: [],
        lastAccessTime: Date.now(),
      };
      this.caches.set(sourceId, cache);
    }

    // Don't add duplicate timestamps
    if (cache.frames.has(timestamp)) {
      frame.close();
      return;
    }

    // Evict old frames if cache is full
    while (cache.frames.size >= MAX_FRAMES_PER_SOURCE) {
      // Remove oldest timestamp
      const oldestTs = cache.sortedTimestamps.shift();
      if (oldestTs !== undefined) {
        const oldFrame = cache.frames.get(oldestTs);
        oldFrame?.close();
        cache.frames.delete(oldestTs);
      }
    }

    // Add new frame
    cache.frames.set(timestamp, frame);

    // Insert timestamp in sorted order (binary search insertion)
    const insertIdx = this.binarySearchInsertIdx(cache.sortedTimestamps, timestamp);
    cache.sortedTimestamps.splice(insertIdx, 0, timestamp);

    cache.lastAccessTime = Date.now();

    // Evict old sources if too many
    this.evictOldSources();
  }

  /**
   * Get the best available frame for a specific source at a given time
   * Returns the closest frame where timestamp <= time
   */
  getFrame(sourceId: string, time: number): ImageBitmap | null {
    const cache = this.caches.get(sourceId);
    if (!cache || cache.frames.size === 0) return null;

    cache.lastAccessTime = Date.now();

    // Binary search for largest timestamp <= time
    const timestamps = cache.sortedTimestamps;
    let lo = 0;
    let hi = timestamps.length - 1;
    let bestTs = -1;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (timestamps[mid] <= time) {
        bestTs = timestamps[mid];
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (bestTs === -1) {
      // No frame before requested time, return earliest frame
      return cache.frames.get(timestamps[0]) ?? null;
    }

    return cache.frames.get(bestTs) ?? null;
  }

  /**
   * Check if a source has any cached frames
   */
  hasFrames(sourceId: string): boolean {
    const cache = this.caches.get(sourceId);
    return cache ? cache.frames.size > 0 : false;
  }

  /**
   * Get the number of cached frames for a source
   */
  getFrameCount(sourceId: string): number {
    const cache = this.caches.get(sourceId);
    return cache ? cache.frames.size : 0;
  }

  /**
   * Clear all frames for a source
   */
  clearSource(sourceId: string): void {
    const cache = this.caches.get(sourceId);
    if (cache) {
      for (const frame of cache.frames.values()) {
        frame.close();
      }
      cache.frames.clear();
      cache.sortedTimestamps = [];
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      for (const frame of cache.frames.values()) {
        frame.close();
      }
    }
    this.caches.clear();
  }

  private binarySearchInsertIdx(arr: number[], value: number): number {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (arr[mid] < value) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  private evictOldSources(): void {
    if (this.caches.size <= MAX_CACHED_SOURCES) return;

    // Sort by last access time, evict oldest
    const sorted = [...this.caches.entries()].sort(
      ([, a], [, b]) => a.lastAccessTime - b.lastAccessTime,
    );

    while (sorted.length > MAX_CACHED_SOURCES) {
      const [sourceId, cache] = sorted.shift()!;
      for (const frame of cache.frames.values()) {
        frame.close();
      }
      this.caches.delete(sourceId);
    }
  }
}

// =============================================================================
// JUMP DETECTION
// =============================================================================
// Detects whether a time change is continuous playback or a jump (scrub/click)
// Only triggers seek on actual jumps to avoid decoder resets during playback

const JUMP_THRESHOLD_SECONDS = 0.1; // 100ms - if delta exceeds this, it's a jump

class PlaybackController {
  // Last requested time per source
  private lastRequestedTime = new Map<string, number>();

  /**
   * Determine if a time change is a jump or continuous playback
   * Returns 'seek' if we need to seek, 'continuous' if we can just render from cache
   */
  detectTimeChange(sourceId: string, newTime: number): 'seek' | 'continuous' {
    const lastTime = this.lastRequestedTime.get(sourceId);

    // First request for this source - not a jump, just starting
    if (lastTime === undefined) {
      this.lastRequestedTime.set(sourceId, newTime);
      return 'continuous';
    }

    const delta = Math.abs(newTime - lastTime);
    this.lastRequestedTime.set(sourceId, newTime);

    // If delta is larger than threshold, it's a jump
    if (delta > JUMP_THRESHOLD_SECONDS) {
      return 'seek';
    }

    return 'continuous';
  }

  /**
   * Reset tracking for a source (call when source is unloaded)
   */
  resetSource(sourceId: string): void {
    this.lastRequestedTime.delete(sourceId);
  }

  /**
   * Get last requested time for a source
   */
  getLastTime(sourceId: string): number | undefined {
    return this.lastRequestedTime.get(sourceId);
  }

  /**
   * Clear all tracking
   */
  clear(): void {
    this.lastRequestedTime.clear();
  }
}

// =============================================================================
// VIDEO PLAYER HOOK
// =============================================================================

export function useVideoPlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameCacheRef = useRef<FrameCacheManager>(new FrameCacheManager());
  const playbackControllerRef = useRef<PlaybackController>(new PlaybackController());
  const workerRef = useRef<Worker | null>(null);
  const renderFrameRef = useRef<(() => void) | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);

  const currentTime = useTimelineStore((s) => s.currentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const tracks = useTimelineStore((s) => s.tracks);

  // Initialize decode worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/decode.worker.ts', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (e) => {
      const { type, id: sourceId, frame, timestamp } = e.data;

      if (type === 'frame' && frame && sourceId) {
        // Add frame to per-source cache
        frameCacheRef.current.addFrame(sourceId, timestamp, frame);
        // Trigger render when frames arrive
        renderFrameRef.current?.();
      }
    };

    setIsReady(true);

    return () => {
      workerRef.current?.terminate();
      frameCacheRef.current.clearAll();
      playbackControllerRef.current.clear();
    };
  }, []);

  /**
   * Get a frame for a specific source at a specific time
   * Returns the best available frame (closest timestamp <= time)
   */
  const getFrame = useCallback((sourceId: string, time: number): ImageBitmap | null => {
    return frameCacheRef.current.getFrame(sourceId, time);
  }, []);

  /**
   * Legacy getFrameAtTime - deprecated, use getFrame(sourceId, time) instead
   * This is kept for backwards compatibility but won't work correctly with multiple sources
   */
  const getFrameAtTime = useCallback(
    (time: number): ImageBitmap | null => {
      // Try to find a frame from any source at this time
      // This is a fallback - prefer using getFrame with sourceId
      const videoClips = tracks
        .filter((t) => t.type === 'video' && !t.muted)
        .flatMap((t) => t.clips)
        .filter((c) => time >= c.startTime && time < c.startTime + c.duration);

      for (const clip of videoClips) {
        const clipTime = clip.inPoint + (time - clip.startTime);
        const frame = frameCacheRef.current.getFrame(clip.sourceId, clipTime);
        if (frame) return frame;
      }

      return null;
    },
    [tracks],
  );

  const decodeVideo = useCallback((data: ArrayBuffer, sourceId: string) => {
    if (!workerRef.current) return;

    workerRef.current.postMessage(
      {
        type: 'decode',
        id: sourceId,
        data,
      },
      [data],
    );
  }, []);

  const seekTo = useCallback((time: number, sourceId: string) => {
    if (!workerRef.current) return;

    workerRef.current.postMessage({
      type: 'seek',
      id: sourceId,
      time,
    });
  }, []);

  /**
   * Request a frame for a source at a specific time
   * Uses jump detection to only seek when necessary
   * Returns the best available frame from cache
   */
  const requestFrame = useCallback(
    (sourceId: string, time: number): ImageBitmap | null => {
      const controller = playbackControllerRef.current;
      const changeType = controller.detectTimeChange(sourceId, time);

      // Only seek if this is an actual jump (not continuous playback)
      if (changeType === 'seek') {
        seekTo(time, sourceId);
      }

      // Always return best available frame from cache
      return frameCacheRef.current.getFrame(sourceId, time);
    },
    [seekTo],
  );

  const extractThumbnail = useCallback(
    (data: ArrayBuffer, sourceId: string): Promise<ImageBitmap> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not ready'));
          return;
        }

        const handler = (e: MessageEvent) => {
          if (e.data.id !== sourceId) return;

          if (e.data.type === 'thumbnail') {
            workerRef.current?.removeEventListener('message', handler);
            resolve(e.data.thumbnail);
          } else if (e.data.type === 'error') {
            workerRef.current?.removeEventListener('message', handler);
            reject(new Error(e.data.error));
          }
        };

        workerRef.current.addEventListener('message', handler);
        workerRef.current.postMessage(
          {
            type: 'extractThumbnail',
            id: sourceId,
            data,
          },
          [data],
        );
      });
    },
    [],
  );

  // Render current frame to canvas
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find video clips at current time
    const videoClips = tracks
      .filter((t) => t.type === 'video' && !t.muted)
      .flatMap((t) => t.clips)
      .filter((c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration);

    // Render video frames (bottom to top for proper layering)
    for (const clip of videoClips.reverse()) {
      const clipTime = clip.inPoint + (currentTime - clip.startTime);
      // Use per-source getFrame
      const frame = frameCacheRef.current.getFrame(clip.sourceId, clipTime);

      if (frame) {
        ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      }
    }

    // Find and render text overlays
    const textClips = tracks
      .filter((t) => t.type === 'text' && !t.muted)
      .flatMap((t) => t.clips)
      .filter((c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration);

    for (const clip of textClips) {
      if (clip.text) {
        ctx.fillStyle = clip.color || '#ffffff';
        ctx.font = `bold ${clip.fontSize || 48}px ${clip.fontFamily || 'sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Add text shadow for visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const x = clip.position?.x ?? canvas.width / 2;
        const y = clip.position?.y ?? canvas.height - 100;
        ctx.fillText(clip.text, x, y);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    }
  }, [currentTime, tracks]);

  // Keep render callback available to the worker message handler
  useEffect(() => {
    renderFrameRef.current = renderFrame;
  }, [renderFrame]);

  return {
    canvasRef,
    isReady,
    isPlaying,
    decodeVideo,
    seekTo,
    requestFrame, // New: uses jump detection, only seeks when needed
    extractThumbnail,
    renderFrame,
    getFrame,
    getFrameAtTime, // Deprecated, kept for compatibility
  };
}
