import { useState } from 'react';
import { getEncoderPreset } from '../../lib/webcodecs';
import { useTimelineStore } from '../../store/timeline';

interface ExportDialogProps {
  onClose: () => void;
}

type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';
type Resolution = '720p' | '1080p' | '4k';

const RESOLUTIONS: Record<Resolution, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

export default function ExportDialog({ onClose }: ExportDialogProps) {
  const [quality, setQuality] = useState<QualityPreset>('high');
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [frameRate, setFrameRate] = useState(30);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const duration = useTimelineStore((s) => s.duration);
  const tracks = useTimelineStore((s) => s.tracks);

  const preset = getEncoderPreset(quality);
  const res = RESOLUTIONS[resolution];

  const estimatedSize = Math.round(
    ((preset.videoBitrate + preset.audioBitrate) * duration) / 8 / 1024 / 1024,
  );

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);

    // Simulate export progress (actual implementation would use WebCodecs + WASM muxer)
    const totalFrames = Math.ceil(duration * frameRate);

    for (let frame = 0; frame <= totalFrames; frame++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      setProgress((frame / totalFrames) * 100);
    }

    // Create a placeholder download
    const blob = new Blob(['Placeholder MP4 data'], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fuse-export.mp4';
    a.click();
    URL.revokeObjectURL(url);

    setIsExporting(false);
    onClose();
  };

  const clipCount = tracks.reduce((acc, t) => acc + t.clips.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--fuse-bg-secondary)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--fuse-bg-tertiary)]">
          <h2 className="text-lg font-semibold text-[var(--fuse-text-primary)]">Export Video</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--fuse-bg-tertiary)] transition-colors"
          >
            <svg
              className="w-5 h-5 text-[var(--fuse-text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Project Summary */}
          <div className="p-4 rounded-xl bg-[var(--fuse-bg-tertiary)]">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-[var(--fuse-text-primary)]">
                  {formatDuration(duration)}
                </p>
                <p className="text-xs text-[var(--fuse-text-secondary)]">Duration</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--fuse-text-primary)]">{clipCount}</p>
                <p className="text-xs text-[var(--fuse-text-secondary)]">Clips</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--fuse-text-primary)]">
                  ~{estimatedSize}MB
                </p>
                <p className="text-xs text-[var(--fuse-text-secondary)]">Est. Size</p>
              </div>
            </div>
          </div>

          {/* Quality Preset */}
          <div>
            <label className="block text-sm font-medium text-[var(--fuse-text-primary)] mb-2">
              Quality
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'ultra'] as QualityPreset[]).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    quality === q
                      ? 'bg-[var(--fuse-accent)] text-white'
                      : 'bg-[var(--fuse-bg-tertiary)] text-[var(--fuse-text-secondary)] hover:bg-[var(--fuse-bg-tertiary)]/80'
                  }`}
                >
                  {q.charAt(0).toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <label className="block text-sm font-medium text-[var(--fuse-text-primary)] mb-2">
              Resolution
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['720p', '1080p', '4k'] as Resolution[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    resolution === r
                      ? 'bg-[var(--fuse-accent)] text-white'
                      : 'bg-[var(--fuse-bg-tertiary)] text-[var(--fuse-text-secondary)] hover:bg-[var(--fuse-bg-tertiary)]/80'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--fuse-text-secondary)]">
              {res.width} × {res.height}
            </p>
          </div>

          {/* Frame Rate */}
          <div>
            <label className="block text-sm font-medium text-[var(--fuse-text-primary)] mb-2">
              Frame Rate: {frameRate} fps
            </label>
            <input
              type="range"
              min="24"
              max="60"
              step="6"
              value={frameRate}
              onChange={(e) => setFrameRate(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none bg-[var(--fuse-bg-tertiary)] accent-[var(--fuse-accent)]"
            />
            <div className="flex justify-between text-xs text-[var(--fuse-text-secondary)] mt-1">
              <span>24</span>
              <span>30</span>
              <span>60</span>
            </div>
          </div>

          {/* Export Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-[var(--fuse-bg-tertiary)] overflow-hidden">
                <div
                  className="h-full bg-[var(--fuse-accent)] transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-center text-[var(--fuse-text-secondary)]">
                Exporting... {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[var(--fuse-bg-tertiary)]">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[var(--fuse-bg-tertiary)] text-[var(--fuse-text-primary)] hover:bg-[var(--fuse-bg-tertiary)]/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || clipCount === 0}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[var(--fuse-accent)] text-white hover:bg-[var(--fuse-accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Export MP4
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
