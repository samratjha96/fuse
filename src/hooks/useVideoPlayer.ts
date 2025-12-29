import { useRef, useCallback, useEffect, useState } from 'react';
import { useTimelineStore } from '../store/timeline';

interface FrameCache {
  timestamp: number;
  frame: ImageBitmap;
}

const MAX_CACHE_SIZE = 60; // Cache ~2 seconds at 30fps

export function useVideoPlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameCache = useRef<FrameCache[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  const currentTime = useTimelineStore((s) => s.currentTime);
  const tracks = useTimelineStore((s) => s.tracks);

  // Initialize decode worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/decode.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e) => {
      const { type, frame, timestamp } = e.data;
      
      if (type === 'frame' && frame) {
        addFrameToCache(timestamp, frame);
      }
    };

    setIsReady(true);

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const addFrameToCache = useCallback((timestamp: number, frame: ImageBitmap) => {
    const cache = frameCache.current;
    
    // Remove old frames if cache is full
    while (cache.length >= MAX_CACHE_SIZE) {
      const oldFrame = cache.shift();
      oldFrame?.frame.close();
    }
    
    // Insert in sorted order
    const insertIndex = cache.findIndex((f) => f.timestamp > timestamp);
    if (insertIndex === -1) {
      cache.push({ timestamp, frame });
    } else {
      cache.splice(insertIndex, 0, { timestamp, frame });
    }
  }, []);

  const getFrameAtTime = useCallback((time: number): ImageBitmap | null => {
    const cache = frameCache.current;
    if (cache.length === 0) return null;

    // Find closest frame
    let closestFrame: FrameCache | null = null;
    let closestDiff = Infinity;

    for (const cached of cache) {
      const diff = Math.abs(cached.timestamp - time);
      if (diff < closestDiff && cached.timestamp <= time) {
        closestDiff = diff;
        closestFrame = cached;
      }
    }

    return closestFrame?.frame || null;
  }, []);

  const decodeVideo = useCallback((data: ArrayBuffer, sourceId: string) => {
    if (!workerRef.current) return;
    
    workerRef.current.postMessage({
      type: 'decode',
      id: sourceId,
      data,
    }, [data]);
  }, []);

  const seekTo = useCallback((time: number, sourceId: string) => {
    if (!workerRef.current) return;
    
    workerRef.current.postMessage({
      type: 'seek',
      id: sourceId,
      time,
    });
  }, []);

  const extractThumbnail = useCallback((data: ArrayBuffer, sourceId: string): Promise<ImageBitmap> => {
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
      workerRef.current.postMessage({
        type: 'extractThumbnail',
        id: sourceId,
        data,
      }, [data]);
    });
  }, []);

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
      .filter(t => t.type === 'video' && !t.muted)
      .flatMap(t => t.clips)
      .filter(c => currentTime >= c.startTime && currentTime < c.startTime + c.duration);

    // Render video frames (bottom to top for proper layering)
    for (const clip of videoClips.reverse()) {
      const clipTime = clip.inPoint + (currentTime - clip.startTime);
      const frame = getFrameAtTime(clipTime);
      
      if (frame) {
        ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
      }
    }

    // Find and render text overlays
    const textClips = tracks
      .filter(t => t.type === 'text' && !t.muted)
      .flatMap(t => t.clips)
      .filter(c => currentTime >= c.startTime && currentTime < c.startTime + c.duration);

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
  }, [currentTime, tracks, getFrameAtTime]);

  return {
    canvasRef,
    isReady,
    decodeVideo,
    seekTo,
    extractThumbnail,
    renderFrame,
    getFrameAtTime,
  };
}

