import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimelineStore } from '../../store/timeline';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import { getFileData } from '../../lib/storage';

export default function Preview() {
  const decodedSourcesRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });

  // Use requestFrame instead of seekTo - it has jump detection built in
  const { canvasRef, isReady, decodeVideo, requestFrame, renderFrame } = useVideoPlayer();

  const currentTime = useTimelineStore((s) => s.currentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const setIsPlaying = useTimelineStore((s) => s.setIsPlaying);
  const duration = useTimelineStore((s) => s.duration);
  const tracks = useTimelineStore((s) => s.tracks);
  const sources = useTimelineStore((s) => s.sources);

  // Handle container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      // Maintain 16:9 aspect ratio
      const aspectRatio = 16 / 9;
      let canvasWidth = width - 32; // padding
      let canvasHeight = canvasWidth / aspectRatio;

      if (canvasHeight > height - 80) {
        // leave room for controls
        canvasHeight = height - 80;
        canvasWidth = canvasHeight * aspectRatio;
      }

      setCanvasSize({ width: canvasWidth, height: canvasHeight });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Find all active video clips at a given time
  const findActiveVideoClips = useCallback(
    (time: number) => {
      return tracks
        .filter((t) => t.type === 'video' && !t.muted)
        .flatMap((t) => t.clips)
        .filter((c) => time >= c.startTime && time < c.startTime + c.duration);
    },
    [tracks],
  );

  // Decode sources as soon as the worker is ready
  useEffect(() => {
    if (!isReady) return;

    const loadSources = async () => {
      for (const source of sources) {
        if (decodedSourcesRef.current.has(source.id)) continue;

        const data = await getFileData(source.id);
        if (!data) continue;

        decodeVideo(data, source.id);
        decodedSourcesRef.current.add(source.id);
      }

      // Render once after new sources start decoding
      renderFrame();
    };

    loadSources();
  }, [sources, isReady, decodeVideo, renderFrame]);

  // Request frames for active clips when time changes (with jump detection)
  // This replaces the old seekTo call - requestFrame only seeks when needed
  useEffect(() => {
    const activeClips = findActiveVideoClips(currentTime);

    for (const clip of activeClips) {
      const clipTime = clip.inPoint + (currentTime - clip.startTime);
      // requestFrame uses jump detection - only seeks if delta > threshold
      requestFrame(clip.sourceId, clipTime);
    }

    // Render the current frame
    renderFrame();
  }, [currentTime, findActiveVideoClips, requestFrame, renderFrame]);

  // Playback loop - NO seeking here, just update time and render
  // The frame request effect above handles seeking only when needed
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();
    let time = currentTime;
    let animationId: number;

    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      time += delta;

      // Loop or stop at end
      if (time >= duration && duration > 0) {
        time = 0;
        setIsPlaying(false);
        return;
      }

      // Just update time - the useEffect above will handle frame requests
      // with jump detection (continuous playback won't trigger seeks)
      setCurrentTime(time);

      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, currentTime, duration, setCurrentTime, setIsPlaying]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col items-center justify-center p-4 bg-[var(--fuse-bg-primary)]"
    >
      {/* Canvas Container */}
      <div
        className="relative rounded-lg overflow-hidden shadow-2xl"
        style={{ width: canvasSize.width, height: canvasSize.height }}
      >
        <canvas ref={canvasRef} width={1920} height={1080} className="w-full h-full bg-black" />

        {/* Overlay Controls */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            type="button"
          >
            {isPlaying ? (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <title>Pause</title>
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <title>Play</title>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Preview Info */}
      <div className="mt-4 flex items-center gap-4 text-sm text-[var(--fuse-text-secondary)]">
        <span>1920 × 1080</span>
        <span>•</span>
        <span>30 fps</span>
        <span>•</span>
        <span>16:9</span>
      </div>
    </div>
  );
}
