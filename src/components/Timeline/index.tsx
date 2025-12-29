import { useCallback, useEffect, useRef, useState } from 'react';
import type { Clip, Track } from '../../store/timeline';
import { useTimelineStore } from '../../store/timeline';

// Types for drag operations
type DragMode = 'none' | 'move' | 'trim-left' | 'trim-right';

interface DragState {
  mode: DragMode;
  clipId: string;
  trackId: string;
  initialX: number;
  initialStartTime: number;
  initialDuration: number;
  initialInPoint: number;
  initialOutPoint: number;
}

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
  const setDuration = useTimelineStore((s) => s.setDuration);
  const setZoom = useTimelineStore((s) => s.setZoom);
  const setScrollX = useTimelineStore((s) => s.setScrollX);
  const setIsPlaying = useTimelineStore((s) => s.setIsPlaying);
  const selectClip = useTimelineStore((s) => s.selectClip);
  const deselectAll = useTimelineStore((s) => s.deselectAll);
  const toggleTrackMute = useTimelineStore((s) => s.toggleTrackMute);
  const toggleTrackLock = useTimelineStore((s) => s.toggleTrackLock);
  const splitClip = useTimelineStore((s) => s.splitClip);
  const removeClip = useTimelineStore((s) => s.removeClip);
  const updateClip = useTimelineStore((s) => s.updateClip);
  const addClip = useTimelineStore((s) => s.addClip);

  // Drag state for clip manipulation
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(
    null,
  );

  const timelineRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);

  // Calculate timeline width based on duration and zoom
  const timelineWidth = Math.max((duration + 10) * zoom, 1000);

  // Helper to find clip and check if track is locked
  const findClipAndTrack = useCallback(
    (clipId: string) => {
      for (const track of tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          return { clip, track };
        }
      }
      return null;
    },
    [tracks],
  );

  const isTrackLocked = useCallback(
    (clipId: string) => {
      const result = findClipAndTrack(clipId);
      return result?.track.locked ?? false;
    },
    [findClipAndTrack],
  );

  // Keep global duration in sync with clips (covers drops, trims, deletes)
  useEffect(() => {
    const maxEnd = tracks.reduce((acc, track) => {
      const trackEnd = track.clips.reduce(
        (clipMax, clip) => Math.max(clipMax, clip.startTime + clip.duration),
        0,
      );
      return Math.max(acc, trackEnd);
    }, 0);

    if (maxEnd !== duration) {
      setDuration(maxEnd);
    }
  }, [tracks, duration, setDuration]);

  // Split selected clip at playhead
  const handleSplitSelectedClip = useCallback(() => {
    if (selectedClipIds.length === 0) return;

    for (const clipId of selectedClipIds) {
      if (isTrackLocked(clipId)) continue;

      const result = findClipAndTrack(clipId);
      if (!result) continue;

      const { clip } = result;
      // Check if playhead is within this clip
      if (currentTime > clip.startTime && currentTime < clip.startTime + clip.duration) {
        splitClip(clipId, currentTime);
      }
    }
  }, [selectedClipIds, currentTime, splitClip, findClipAndTrack, isTrackLocked]);

  // Delete selected clips
  const handleDeleteSelectedClips = useCallback(() => {
    if (selectedClipIds.length === 0) return;

    for (const clipId of selectedClipIds) {
      if (isTrackLocked(clipId)) continue;
      removeClip(clipId);
    }
  }, [selectedClipIds, removeClip, isTrackLocked]);

  // Duplicate a clip
  const handleDuplicateClip = useCallback(
    (clipId: string) => {
      const result = findClipAndTrack(clipId);
      if (!result || result.track.locked) return;

      const { clip, track } = result;
      const addClip = useTimelineStore.getState().addClip;
      addClip({
        type: clip.type,
        trackId: track.id,
        sourceId: clip.sourceId,
        startTime: clip.startTime + clip.duration, // Place after original
        duration: clip.duration,
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
        text: clip.text,
        fontFamily: clip.fontFamily,
        fontSize: clip.fontSize,
        color: clip.color,
        position: clip.position,
      });
    },
    [findClipAndTrack],
  );

  // Start dragging a clip (move or trim)
  const handleClipDragStart = useCallback(
    (e: React.MouseEvent, clipId: string, mode: DragMode) => {
      if (mode === 'none') return;
      if (isTrackLocked(clipId)) return;

      const result = findClipAndTrack(clipId);
      if (!result) return;

      const { clip, track } = result;

      e.preventDefault();
      e.stopPropagation();

      setDragState({
        mode,
        clipId,
        trackId: track.id,
        initialX: e.clientX,
        initialStartTime: clip.startTime,
        initialDuration: clip.duration,
        initialInPoint: clip.inPoint,
        initialOutPoint: clip.outPoint,
      });

      // Select the clip if not already selected
      if (!selectedClipIds.includes(clipId)) {
        selectClip(clipId);
      }
    },
    [findClipAndTrack, isTrackLocked, selectedClipIds, selectClip],
  );

  // Handle mouse move during drag
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.initialX;
      const deltaTime = deltaX / zoom;

      const result = findClipAndTrack(dragState.clipId);
      if (!result) return;

      // Get source duration for trimming bounds
      const sources = useTimelineStore.getState().sources;
      const source = sources.find((s) => s.id === result.clip.sourceId);
      const sourceDuration = source?.duration ?? result.clip.duration;

      switch (dragState.mode) {
        case 'move': {
          // Move clip horizontally
          const newStartTime = Math.max(0, dragState.initialStartTime + deltaTime);
          updateClip(dragState.clipId, { startTime: newStartTime });
          break;
        }
        case 'trim-left': {
          // Trim from left edge - adjusts startTime, duration, and inPoint
          const maxTrim = dragState.initialDuration - 0.1; // Minimum 0.1s duration
          const minInPoint = 0;
          const clampedDelta = Math.max(-dragState.initialInPoint, Math.min(maxTrim, deltaTime));

          const newStartTime = dragState.initialStartTime + clampedDelta;
          const newDuration = dragState.initialDuration - clampedDelta;
          const newInPoint = Math.max(minInPoint, dragState.initialInPoint + clampedDelta);

          updateClip(dragState.clipId, {
            startTime: newStartTime,
            duration: newDuration,
            inPoint: newInPoint,
          });
          break;
        }
        case 'trim-right': {
          // Trim from right edge - adjusts duration and outPoint
          const minDuration = 0.1; // Minimum 0.1s
          const maxOutPoint = sourceDuration;
          const maxDelta = maxOutPoint - dragState.initialOutPoint;
          const minDelta = minDuration - dragState.initialDuration;

          const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaTime));
          const newDuration = dragState.initialDuration + clampedDelta;
          const newOutPoint = dragState.initialOutPoint + clampedDelta;

          updateClip(dragState.clipId, {
            duration: newDuration,
            outPoint: newOutPoint,
          });
          break;
        }
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, zoom, updateClip, findClipAndTrack]);

  // Context menu handlers
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, clipId: string) => {
      e.preventDefault();
      e.stopPropagation();

      // Select the clip
      if (!selectedClipIds.includes(clipId)) {
        selectClip(clipId);
      }

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        clipId,
      });
    },
    [selectedClipIds, selectClip],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

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

  // Handle dropping media from the Media Bin onto a track
  const handleDropMedia = useCallback(
    (e: React.DragEvent, track: Track) => {
      e.preventDefault();
      const payload = e.dataTransfer.getData('application/json');
      if (!payload) return;

      let item: { id: string; type: Clip['type']; duration: number };
      try {
        item = JSON.parse(payload);
      } catch {
        return;
      }

      if (item.type !== track.type) return;
      if (!item.duration || item.duration <= 0) return;

      const scrollLeft = timelineRef.current?.scrollLeft ?? 0;
      const rect = tracksContainerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left + scrollLeft;
      const startTime = Math.max(0, x / zoom);

      addClip({
        type: track.type,
        trackId: track.id,
        sourceId: item.id,
        startTime,
        duration: item.duration,
        inPoint: 0,
        outPoint: item.duration,
      });

      setCurrentTime(startTime);
      setIsPlaying(false);
    },
    [addClip, setCurrentTime, setIsPlaying, zoom],
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
        // Split clip at playhead
        case 'KeyS':
        case 'KeyC':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleSplitSelectedClip();
          }
          break;
        // Delete selected clips
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          handleDeleteSelectedClips();
          break;
        // Escape to close context menu
        case 'Escape':
          setContextMenu(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlaying,
    currentTime,
    duration,
    setIsPlaying,
    setCurrentTime,
    handleSplitSelectedClip,
    handleDeleteSelectedClips,
  ]);

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

          {/* Editing tools */}
          <div className="flex items-center gap-1 ml-4 pl-4 border-l border-[var(--fuse-bg-tertiary)]">
            <button
              onClick={handleSplitSelectedClip}
              disabled={selectedClipIds.length === 0}
              className="px-3 h-8 flex items-center gap-1.5 rounded-lg bg-[var(--fuse-bg-tertiary)] hover:bg-[var(--fuse-accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
              title="Split clip at playhead (S)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m0-16l-4 4m4-4l4 4"
                />
              </svg>
              Split
            </button>
            <button
              onClick={handleDeleteSelectedClips}
              disabled={selectedClipIds.length === 0}
              className="px-3 h-8 flex items-center gap-1.5 rounded-lg bg-[var(--fuse-bg-tertiary)] hover:bg-red-500/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
              title="Delete selected clip (Delete)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
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
                  onClipDragStart={handleClipDragStart}
                  onClipContextMenu={handleContextMenu}
                  isDragging={dragState?.clipId !== undefined}
                onDropMedia={handleDropMedia}
                />
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[var(--fuse-playhead)] pointer-events-none z-20"
                style={{ left: currentTime * zoom }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--fuse-playhead)] rotate-45" />
              </div>

            {/* Project end marker */}
            {duration > 0 && (
              <div
                className="absolute top-0 bottom-0 w-px bg-[var(--fuse-accent)]/50 pointer-events-none z-10"
                style={{ left: duration * zoom }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1 rounded text-[10px] font-mono bg-[var(--fuse-bg-primary)] text-[var(--fuse-accent)] border border-[var(--fuse-accent)]/40">
                  {formatTime(duration)}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[var(--fuse-bg-secondary)] border border-[var(--fuse-bg-tertiary)] rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-[var(--fuse-text-primary)] hover:bg-[var(--fuse-bg-tertiary)] flex items-center gap-2"
            onClick={() => {
              const result = findClipAndTrack(contextMenu.clipId);
              if (result) {
                const { clip } = result;
                if (currentTime > clip.startTime && currentTime < clip.startTime + clip.duration) {
                  splitClip(contextMenu.clipId, currentTime);
                }
              }
              closeContextMenu();
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h8M8 12h4m-4 5h8"
              />
            </svg>
            Split at Playhead
            <span className="ml-auto text-xs text-[var(--fuse-text-secondary)]">S</span>
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-[var(--fuse-text-primary)] hover:bg-[var(--fuse-bg-tertiary)] flex items-center gap-2"
            onClick={() => {
              handleDuplicateClip(contextMenu.clipId);
              closeContextMenu();
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Duplicate
            <span className="ml-auto text-xs text-[var(--fuse-text-secondary)]">⌘D</span>
          </button>
          <div className="h-px bg-[var(--fuse-bg-tertiary)] my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[var(--fuse-bg-tertiary)] flex items-center gap-2"
            onClick={() => {
              removeClip(contextMenu.clipId);
              closeContextMenu();
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
            <span className="ml-auto text-xs text-[var(--fuse-text-secondary)]">⌫</span>
          </button>
        </div>
      )}
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
  onClipDragStart: (e: React.MouseEvent, clipId: string, mode: DragMode) => void;
  onClipContextMenu: (e: React.MouseEvent, clipId: string) => void;
  isDragging: boolean;
  onDropMedia: (e: React.DragEvent, track: Track) => void;
}

function TrackRow({
  track,
  zoom,
  selectedClipIds,
  onClipClick,
  onClipDragStart,
  onClipContextMenu,
  isDragging,
  onDropMedia,
}: TrackRowProps) {
  const typeColors = {
    video: 'bg-[var(--fuse-clip-video)]',
    audio: 'bg-[var(--fuse-clip-audio)]',
    text: 'bg-[var(--fuse-clip-text)]',
  };

  return (
    <div
      className="relative border-b border-[var(--fuse-bg-tertiary)]"
      style={{ height: track.height, background: 'var(--fuse-timeline-track)' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDropMedia(e, track)}
    >
      {track.clips.map((clip) => (
        <ClipBlock
          key={clip.id}
          clip={clip}
          zoom={zoom}
          color={typeColors[track.type]}
          isSelected={selectedClipIds.includes(clip.id)}
          isLocked={track.locked}
          onClick={(multi) => onClipClick(clip.id, multi)}
          onDragStart={(e, mode) => onClipDragStart(e, clip.id, mode)}
          onContextMenu={(e) => onClipContextMenu(e, clip.id)}
          isDragging={isDragging}
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
  isLocked: boolean;
  onClick: (multi: boolean) => void;
  onDragStart: (e: React.MouseEvent, mode: DragMode) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isDragging: boolean;
}

function ClipBlock({
  clip,
  zoom,
  color,
  isSelected,
  isLocked,
  onClick,
  onDragStart,
  onContextMenu,
  isDragging,
}: ClipBlockProps) {
  const width = clip.duration * zoom;
  const left = clip.startTime * zoom;

  return (
    <div
      className={`absolute top-1 bottom-1 rounded transition-all ${color} ${
        isSelected
          ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--fuse-timeline-track)] z-10'
          : ''
      } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-grab'} ${
        isDragging ? 'cursor-grabbing' : ''
      }`}
      style={{
        left,
        width: Math.max(width, 20),
        opacity: isLocked ? 0.5 : 0.9,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e.shiftKey || e.metaKey);
      }}
      onMouseDown={(e) => {
        if (isLocked) return;
        // Check if click is on trim handles
        const rect = e.currentTarget.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const handleWidth = 8;

        if (localX <= handleWidth) {
          onDragStart(e, 'trim-left');
        } else if (localX >= rect.width - handleWidth) {
          onDragStart(e, 'trim-right');
        } else {
          onDragStart(e, 'move');
        }
      }}
      onContextMenu={onContextMenu}
    >
      <div className="px-2 py-1 text-[10px] text-white truncate font-medium select-none pointer-events-none">
        {clip.type === 'text' ? clip.text || 'Text' : `Clip`}
      </div>

      {/* Trim handles - visual indicators */}
      {!isLocked && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 rounded-l flex items-center justify-center group"
            title="Drag to trim start"
          >
            <div className="w-0.5 h-4 bg-white/60 rounded opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 rounded-r flex items-center justify-center group"
            title="Drag to trim end"
          >
            <div className="w-0.5 h-4 bg-white/60 rounded opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </>
      )}

      {/* Lock indicator */}
      {isLocked && (
        <div className="absolute right-1 top-1">
          <svg className="w-3 h-3 text-white/50" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}
