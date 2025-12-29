import { useCallback, useEffect, useRef, useState } from 'react';
import { useTimelineStore } from '../../store/timeline';

export default function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });

  const currentTime = useTimelineStore((s) => s.currentTime);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const setIsPlaying = useTimelineStore((s) => s.setIsPlaying);
  const duration = useTimelineStore((s) => s.duration);
  const tracks = useTimelineStore((s) => s.tracks);

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

  // Render frame
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Find clips at current time
    const videoClips = tracks
      .filter((t) => t.type === 'video' && !t.muted)
      .flatMap((t) => t.clips)
      .filter((c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration);

    const textClips = tracks
      .filter((t) => t.type === 'text' && !t.muted)
      .flatMap((t) => t.clips)
      .filter((c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration);

    // Render placeholder for video clips
    if (videoClips.length > 0) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#4a4a6a';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Video Frame', canvas.width / 2, canvas.height / 2);
      ctx.font = '14px sans-serif';
      ctx.fillText(`Time: ${currentTime.toFixed(2)}s`, canvas.width / 2, canvas.height / 2 + 30);
    }

    // Render text overlays
    for (const clip of textClips) {
      if (clip.text) {
        ctx.fillStyle = clip.color || '#ffffff';
        ctx.font = `${clip.fontSize || 48}px ${clip.fontFamily || 'sans-serif'}`;
        ctx.textAlign = 'center';
        const x = clip.position?.x ?? canvas.width / 2;
        const y = clip.position?.y ?? canvas.height - 100;
        ctx.fillText(clip.text, x, y);
      }
    }
  }, [currentTime, tracks]);

  // Render on time change
  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();
    let animationId: number;

    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const newTime = currentTime + delta;
      if (newTime >= duration) {
        setCurrentTime(0);
        setIsPlaying(false);
      } else {
        setCurrentTime(newTime);
      }

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
          >
            {isPlaying ? (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
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
