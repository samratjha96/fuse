import { useCallback, useState } from 'react';
import type { VideoInfo } from '../../lib/demuxer';
import { demuxFile } from '../../lib/demuxer';
import { getFileData, storeFile } from '../../lib/storage';
import { useTimelineStore } from '../../store/timeline';

interface MediaItem {
  id: string;
  name: string;
  type: 'video' | 'audio';
  duration: number;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export default function MediaBin() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const addSource = useTimelineStore((s) => s.addSource);
  const addClip = useTimelineStore((s) => s.addClip);
  const tracks = useTimelineStore((s) => s.tracks);

  const handleImport = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setIsImporting(true);

      for (const file of Array.from(files)) {
        if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
          continue;
        }

        try {
          // Store file in IndexedDB
          const fileId = await storeFile(file);

          // Demux to get metadata
          const fileData = await getFileData(fileId);
          if (!fileData) continue;

          const blob = new Blob([fileData], { type: file.type });
          const videoFile = new File([blob], file.name, { type: file.type });

          const info = await new Promise<VideoInfo>((resolve, reject) => {
            demuxFile(videoFile, {
              onInfo: resolve,
              onVideoSample: () => {},
              onAudioSample: () => {},
              onError: reject,
            });
          });

          const mediaItem: MediaItem = {
            id: fileId,
            name: file.name,
            type: 'video',
            duration: info.duration,
            width: info.width,
            height: info.height,
          };

          setMediaItems((prev) => [...prev, mediaItem]);

          // Add to sources
          addSource({
            name: file.name,
            type: 'video',
            duration: info.duration,
            width: info.width,
            height: info.height,
            codec: info.videoCodec,
          });
        } catch (error) {
          console.error('Failed to import file:', error);
        }
      }

      setIsImporting(false);
    },
    [addSource],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleImport(e.dataTransfer.files);
    },
    [handleImport],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleAddToTimeline = useCallback(
    (item: MediaItem) => {
      // Find the first video track
      const videoTrack = tracks.find((t) => t.type === 'video');
      if (!videoTrack) return;

      // Calculate start time (after last clip)
      const lastClip = videoTrack.clips[videoTrack.clips.length - 1];
      const startTime = lastClip ? lastClip.startTime + lastClip.duration : 0;

      addClip({
        type: 'video',
        trackId: videoTrack.id,
        sourceId: item.id,
        startTime,
        duration: item.duration,
        inPoint: 0,
        outPoint: item.duration,
      });
    },
    [tracks, addClip],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-[var(--fuse-bg-tertiary)]">
        <h2 className="text-sm font-medium text-[var(--fuse-text-primary)]">Media</h2>
        <label className="cursor-pointer">
          <input
            type="file"
            accept="video/*,audio/*"
            multiple
            className="hidden"
            onChange={(e) => handleImport(e.target.files)}
          />
          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--fuse-bg-tertiary)] hover:bg-[var(--fuse-accent)] rounded transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Import
          </span>
        </label>
      </div>

      {/* Drop Zone / Content */}
      <div
        className={`flex-1 overflow-y-auto p-2 ${
          dragOver
            ? 'bg-[var(--fuse-accent)]/10 border-2 border-dashed border-[var(--fuse-accent)]'
            : ''
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isImporting && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--fuse-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isImporting && mediaItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--fuse-bg-tertiary)] flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-[var(--fuse-text-secondary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                />
              </svg>
            </div>
            <p className="text-sm text-[var(--fuse-text-secondary)] mb-1">Drop media files here</p>
            <p className="text-xs text-[var(--fuse-text-secondary)]/60">MP4, WebM, MOV supported</p>
          </div>
        )}

        {/* Media Items Grid */}
        <div className="grid grid-cols-2 gap-2">
          {mediaItems.map((item) => (
            <MediaItemCard
              key={item.id}
              item={item}
              onDoubleClick={() => handleAddToTimeline(item)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface MediaItemCardProps {
  item: MediaItem;
  onDoubleClick: () => void;
}

function MediaItemCard({ item, onDoubleClick }: MediaItemCardProps) {
  return (
    <div
      className="group relative aspect-video rounded-lg overflow-hidden bg-[var(--fuse-bg-tertiary)] cursor-pointer hover:ring-2 hover:ring-[var(--fuse-accent)] transition-all"
      onDoubleClick={onDoubleClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify(item));
      }}
    >
      {/* Thumbnail placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-[var(--fuse-text-secondary)]/30"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
        </svg>
      </div>

      {/* Duration badge */}
      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[10px] bg-black/70 rounded text-white">
        {formatDuration(item.duration)}
      </div>

      {/* Name overlay on hover */}
      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-white truncate">{item.name}</p>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
