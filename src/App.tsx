import { useEffect, useState, useRef } from 'react';
import { isWebCodecsSupported } from './lib/webcodecs';
import { initStorage } from './lib/storage';
import { useTimelineStore } from './store/timeline';
import Timeline from './components/Timeline';
import Preview from './components/Preview';
import MediaBin from './components/MediaBin';
import ExportDialog from './components/ExportDialog';
import TextOverlayEditor from './components/TextOverlay';

function App() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const addTrack = useTimelineStore((s) => s.addTrack);
  const tracks = useTimelineStore((s) => s.tracks);
  const selectedClipIds = useTimelineStore((s) => s.selectedClipIds);
  const initialized = useRef(false);
  
  // Get the first selected clip for properties panel
  const selectedClipId = selectedClipIds[0] || null;
  const selectedClip = selectedClipId 
    ? tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId)
    : null;

  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initialized.current) return;
    initialized.current = true;
    
    // Check browser support and initialize storage
    const init = async () => {
      const supported = isWebCodecsSupported();
      setIsSupported(supported);
      
      if (supported) {
        await initStorage();
        
        // Initialize default tracks if empty
        const currentTracks = useTimelineStore.getState().tracks;
        if (currentTracks.length === 0) {
          addTrack('video', 'Video 1');
          addTrack('audio', 'Audio 1');
          addTrack('text', 'Text 1');
        }
      }
    };
    
    init();
  }, [addTrack]);

  if (isSupported === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--fuse-bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--fuse-accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--fuse-text-secondary)]">Initializing Fuse...</p>
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--fuse-bg-primary)] p-8">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--fuse-text-primary)] mb-3">
            Browser Not Supported
          </h1>
          <p className="text-[var(--fuse-text-secondary)] mb-6">
            Fuse requires WebCodecs API for hardware-accelerated video processing. 
            Please use a modern browser like Chrome 94+, Edge 94+, or Opera 80+.
          </p>
          <a 
            href="https://caniuse.com/webcodecs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-[var(--fuse-accent)] text-white rounded-lg hover:bg-[var(--fuse-accent-hover)] transition-colors"
          >
            Check Browser Support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--fuse-bg-primary)] overflow-hidden">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 bg-[var(--fuse-bg-secondary)] border-b border-[var(--fuse-bg-tertiary)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--fuse-accent)] to-orange-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6.47L5.76 10H20v8H4V6.47M22 4h-4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4z"/>
              </svg>
            </div>
            <span className="font-semibold text-[var(--fuse-text-primary)]">Fuse</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-1.5 bg-[var(--fuse-accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--fuse-accent-hover)] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Media Bin */}
        <aside className="w-64 bg-[var(--fuse-bg-secondary)] border-r border-[var(--fuse-bg-tertiary)] flex flex-col">
          <MediaBin />
        </aside>

        {/* Center - Preview */}
        <main className="flex-1 flex flex-col min-w-0">
          <Preview />
        </main>

        {/* Right Sidebar - Properties */}
        <aside className="w-72 bg-[var(--fuse-bg-secondary)] border-l border-[var(--fuse-bg-tertiary)] p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-[var(--fuse-text-secondary)] uppercase tracking-wide mb-4">
            {selectedClip ? `${selectedClip.type.charAt(0).toUpperCase() + selectedClip.type.slice(1)} Properties` : 'Properties'}
          </h2>
          
          {selectedClip?.type === 'text' ? (
            <TextOverlayEditor clipId={selectedClipId} />
          ) : selectedClip?.type === 'video' || selectedClip?.type === 'audio' ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-[var(--fuse-text-secondary)]">Start Time</label>
                <div className="text-sm text-[var(--fuse-text-primary)] font-mono">
                  {formatTime(selectedClip.startTime)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--fuse-text-secondary)]">Duration</label>
                <div className="text-sm text-[var(--fuse-text-primary)] font-mono">
                  {formatTime(selectedClip.duration)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--fuse-text-secondary)]">In Point</label>
                <div className="text-sm text-[var(--fuse-text-primary)] font-mono">
                  {formatTime(selectedClip.inPoint)}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[var(--fuse-text-secondary)]">Out Point</label>
                <div className="text-sm text-[var(--fuse-text-primary)] font-mono">
                  {formatTime(selectedClip.outPoint)}
                </div>
              </div>
            </div>
          ) : (
            <TextOverlayEditor clipId={null} />
          )}
        </aside>
      </div>

      {/* Timeline */}
      <div className="h-64 bg-[var(--fuse-bg-secondary)] border-t border-[var(--fuse-bg-tertiary)]">
        <Timeline />
      </div>

      {/* Export Dialog */}
      {isExportOpen && <ExportDialog onClose={() => setIsExportOpen(false)} />}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

export default App;
