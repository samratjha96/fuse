import { useCallback, useEffect, useRef } from 'react';
import type { Clip, Track } from '../../store/timeline';
import { useTimelineStore } from '../../store/timeline';

const TRACK_HEADER_WIDTH = 120;

export default function Timeline() {
  const tracks = useTimelineStore((s) => s.tracks);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const duration = useTimelineStore((s) => s.duration);
  const zoom = useTimelineStore((s) => s.zoom);
  const scrollX = useTimelineStore((s) => s.scrollX);
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const selectedClipIds = useTimelineStore((s) => s.selectedClipIds);

  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const setZoom = useTimelineStore((s) => s.setZoom);
  const setScrollX = useTimelineStore((s) => s.setScrollX);
  const setIsPlaying = useTimelineStore((s) => s.setIsPlaying);
  const selectClip = useTimelineStore((s) => s.selectClip);
  const deselectAll = useTimelineStore((s) => s.deselectAll);
  const toggleTrackMute = useTimelineStore((s) => s.toggleTrackMute);
  const toggleTrackLock = useTimelineStore((s) => s.toggleTrackLock);

  const timelineRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);

  // Calculate timeline width based on duration and zoom
  const timelineWidth = Math.max((duration + 10) * zoom, 1000);

  // Handle wheel for horizontal scroll and zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(zoom * delta);
      } else if (e.shiftKey) {
        e.preventDefault();
        setScrollX(scrollX + e.deltaY);
      }
    },
    [zoom, scrollX, setZoom, setScrollX],
  );

  // Handle click on timeline ruler to seek
  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollX;
      const time = x / zoom;
      setCurrentTime(Math.max(0, time));
    },
    [scrollX, zoom, setCurrentTime],
  );

  // Handle timeline background click to deselect
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        deselectAll();
      }
    },
    [deselectAll],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentTime(Math.max(0, currentTime - (e.shiftKey ? 1 : 0.1)));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentTime(currentTime + (e.shiftKey ? 1 : 0.1));
          break;
        case 'Home':
          e.preventDefault();
          setCurrentTime(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentTime(duration);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration, setIsPlaying, setCurrentTime]);

  // Generate time markers
  const generateTimeMarkers = () => {
    const markers = [];
    const step = zoom > 50 ? 1 : zoom > 20 ? 5 : 10;
    const maxTime = Math.ceil(duration + 10);

    for (let t = 0; t <= maxTime; t += step) {
      const x = t * zoom;
      if (x >= scrollX - 100 && x <= scrollX + 1200) {
        markers.push(
          <div
            key={t}
            className="absolute top-0 h-full flex flex-col items-start"
            style={{ left: x }}
          >
            <span className="text-[10px] text-[var(--fuse-text-secondary)] pl-1">
              {formatTime(t)}
            </span>
            <div className="w-px h-2 bg-[var(--fuse-bg-tertiary)]" />
          </div>,
        );
      }
    }
    return markers;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Timeline Controls */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-[var(--fuse-bg-tertiary)]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--fuse-bg-tertiary)] hover:bg-[var(--fuse-accent)] transition-colors"
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="text-sm font-mono text-[var(--fuse-text-primary)]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--fuse-text-secondary)]">Zoom</span>
          <input
            type="range"
            min="10"
            max="500"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 h-1 accent-[var(--fuse-accent)]"
          />
        </div>
      </div>

      {/* Timeline Body */}
      <div className="flex-1 flex min-h-0">
        {/* Track Headers */}
        <div
          className="flex-shrink-0 bg-[var(--fuse-bg-secondary)] border-r border-[var(--fuse-bg-tertiary)]"
          style={{ width: TRACK_HEADER_WIDTH }}
        >
          {/* Ruler header spacer */}
          <div className="h-6 border-b border-[var(--fuse-bg-tertiary)]" />

          {/* Track headers */}
          {tracks.map((track) => (
            <TrackHeader
              key={track.id}
              track={track}
              onToggleMute={() => toggleTrackMute(track.id)}
              onToggleLock={() => toggleTrackLock(track.id)}
            />
          ))}
        </div>

        {/* Scrollable Timeline Area */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
          onWheel={handleWheel}
          onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}
        >
          <div style={{ width: timelineWidth, minWidth: '100%' }}>
            {/* Time Ruler */}
            <div
              className="h-6 relative bg-[var(--fuse-bg-primary)] border-b border-[var(--fuse-bg-tertiary)] cursor-pointer"
              onClick={handleRulerClick}
            >
              {generateTimeMarkers()}
            </div>

            {/* Tracks */}
            <div ref={tracksContainerRef} className="relative" onClick={handleTimelineClick}>
              {tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  zoom={zoom}
                  selectedClipIds={selectedClipIds}
                  onClipClick={selectClip}
                />
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[var(--fuse-playhead)] pointer-events-none z-20"
                style={{ left: currentTime * zoom }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--fuse-playhead)] rotate-45" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TrackHeaderProps {
  track: Track;
  onToggleMute: () => void;
  onToggleLock: () => void;
}

function TrackHeader({ track, onToggleMute, onToggleLock }: TrackHeaderProps) {
  const typeColors = {
    video: 'bg-[var(--fuse-clip-video)]',
    audio: 'bg-[var(--fuse-clip-audio)]',
    text: 'bg-[var(--fuse-clip-text)]',
  };

  return (
    <div
      className="flex items-center gap-2 px-2 border-b border-[var(--fuse-bg-tertiary)]"
      style={{ height: track.height }}
    >
      <div className={`w-2 h-2 rounded-full ${typeColors[track.type]}`} />
      <span className="flex-1 text-xs text-[var(--fuse-text-primary)] truncate">{track.name}</span>
      <div className="flex gap-1">
        <button
          onClick={onToggleMute}
          className={`w-5 h-5 flex items-center justify-center rounded text-[10px] ${
            track.muted ? 'bg-red-500/20 text-red-400' : 'hover:bg-[var(--fuse-bg-tertiary)]'
          }`}
          title={track.muted ? 'Unmute' : 'Mute'}
        >
          {track.muted ? 'M' : 'M'}
        </button>
        <button
          onClick={onToggleLock}
          className={`w-5 h-5 flex items-center justify-center rounded text-[10px] ${
            track.locked ? 'bg-yellow-500/20 text-yellow-400' : 'hover:bg-[var(--fuse-bg-tertiary)]'
          }`}
          title={track.locked ? 'Unlock' : 'Lock'}
        >
          {track.locked ? 'L' : 'L'}
        </button>
      </div>
    </div>
  );
}

interface TrackRowProps {
  track: Track;
  zoom: number;
  selectedClipIds: string[];
  onClipClick: (clipId: string, multi?: boolean) => void;
}

function TrackRow({ track, zoom, selectedClipIds, onClipClick }: TrackRowProps) {
  const typeColors = {
    video: 'bg-[var(--fuse-clip-video)]',
    audio: 'bg-[var(--fuse-clip-audio)]',
    text: 'bg-[var(--fuse-clip-text)]',
  };

  return (
    <div
      className="relative border-b border-[var(--fuse-bg-tertiary)]"
      style={{ height: track.height, background: 'var(--fuse-timeline-track)' }}
    >
      {track.clips.map((clip) => (
        <ClipBlock
          key={clip.id}
          clip={clip}
          zoom={zoom}
          color={typeColors[track.type]}
          isSelected={selectedClipIds.includes(clip.id)}
          onClick={(multi) => onClipClick(clip.id, multi)}
        />
      ))}
    </div>
  );
}

interface ClipBlockProps {
  clip: Clip;
  zoom: number;
  color: string;
  isSelected: boolean;
  onClick: (multi: boolean) => void;
}

function ClipBlock({ clip, zoom, color, isSelected, onClick }: ClipBlockProps) {
  const width = clip.duration * zoom;
  const left = clip.startTime * zoom;

  return (
    <div
      className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all ${color} ${
        isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--fuse-timeline-track)]' : ''
      }`}
      style={{
        left,
        width: Math.max(width, 4),
        opacity: 0.9,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e.shiftKey || e.metaKey);
      }}
    >
      <div className="px-2 py-1 text-[10px] text-white truncate font-medium">
        {clip.type === 'text' ? clip.text || 'Text' : `Clip`}
      </div>

      {/* Trim handles */}
      <div className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/30 rounded-l" />
      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-white/30 rounded-r" />
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}
