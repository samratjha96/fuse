import { useState, useCallback } from 'react';
import { useTimelineStore } from '../../store/timeline';
import type { Clip } from '../../store/timeline';

const FONT_FAMILIES = [
  { name: 'Sans Serif', value: 'sans-serif' },
  { name: 'Serif', value: 'serif' },
  { name: 'Monospace', value: 'monospace' },
  { name: 'IBM Plex Sans', value: 'IBM Plex Sans, sans-serif' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
];

const FONT_SIZES = [24, 32, 48, 64, 72, 96, 128];

const COLORS = [
  '#ffffff', '#000000', '#f97316', '#ef4444', '#22c55e', 
  '#3b82f6', '#a855f7', '#ec4899', '#eab308', '#06b6d4',
];

interface TextOverlayEditorProps {
  clipId: string | null;
}

export default function TextOverlayEditor({ clipId }: TextOverlayEditorProps) {
  const tracks = useTimelineStore((s) => s.tracks);
  const updateClip = useTimelineStore((s) => s.updateClip);
  const addClip = useTimelineStore((s) => s.addClip);
  const currentTime = useTimelineStore((s) => s.currentTime);
  
  const [newText, setNewText] = useState('');

  // Find the selected clip
  const selectedClip: Clip | null = clipId 
    ? tracks.flatMap(t => t.clips).find(c => c.id === clipId) || null
    : null;

  const handleTextChange = useCallback((text: string) => {
    if (!clipId) return;
    updateClip(clipId, { text });
  }, [clipId, updateClip]);

  const handleFontChange = useCallback((fontFamily: string) => {
    if (!clipId) return;
    updateClip(clipId, { fontFamily });
  }, [clipId, updateClip]);

  const handleSizeChange = useCallback((fontSize: number) => {
    if (!clipId) return;
    updateClip(clipId, { fontSize });
  }, [clipId, updateClip]);

  const handleColorChange = useCallback((color: string) => {
    if (!clipId) return;
    updateClip(clipId, { color });
  }, [clipId, updateClip]);

  const handleAddText = useCallback(() => {
    if (!newText.trim()) return;

    // Find text track
    const textTrack = tracks.find(t => t.type === 'text');
    if (!textTrack) return;

    addClip({
      type: 'text',
      trackId: textTrack.id,
      sourceId: 'text-overlay',
      startTime: currentTime,
      duration: 5, // Default 5 seconds
      inPoint: 0,
      outPoint: 5,
      text: newText,
      fontFamily: 'sans-serif',
      fontSize: 48,
      color: '#ffffff',
      position: { x: 960, y: 980 }, // Center bottom for 1920x1080
    });

    setNewText('');
  }, [newText, tracks, currentTime, addClip]);

  if (!selectedClip || selectedClip.type !== 'text') {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-[var(--fuse-text-primary)]">Add Text Overlay</h3>
        
        <div className="space-y-2">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Enter text..."
            className="w-full px-3 py-2 bg-[var(--fuse-bg-tertiary)] rounded-lg text-sm text-[var(--fuse-text-primary)] placeholder:text-[var(--fuse-text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--fuse-accent)]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddText();
            }}
          />
          
          <button
            onClick={handleAddText}
            disabled={!newText.trim()}
            className="w-full py-2 bg-[var(--fuse-accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--fuse-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add to Timeline
          </button>
        </div>
        
        <p className="text-xs text-[var(--fuse-text-secondary)]">
          Text will be added at the current playhead position.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-[var(--fuse-text-primary)]">Edit Text Overlay</h3>
      
      {/* Text Input */}
      <div className="space-y-1">
        <label className="text-xs text-[var(--fuse-text-secondary)]">Text</label>
        <input
          type="text"
          value={selectedClip.text || ''}
          onChange={(e) => handleTextChange(e.target.value)}
          className="w-full px-3 py-2 bg-[var(--fuse-bg-tertiary)] rounded-lg text-sm text-[var(--fuse-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--fuse-accent)]"
        />
      </div>

      {/* Font Family */}
      <div className="space-y-1">
        <label className="text-xs text-[var(--fuse-text-secondary)]">Font</label>
        <select
          value={selectedClip.fontFamily || 'sans-serif'}
          onChange={(e) => handleFontChange(e.target.value)}
          className="w-full px-3 py-2 bg-[var(--fuse-bg-tertiary)] rounded-lg text-sm text-[var(--fuse-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--fuse-accent)]"
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.value} value={font.value}>
              {font.name}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size */}
      <div className="space-y-1">
        <label className="text-xs text-[var(--fuse-text-secondary)]">
          Size: {selectedClip.fontSize || 48}px
        </label>
        <div className="flex gap-1 flex-wrap">
          {FONT_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => handleSizeChange(size)}
              className={`px-2 py-1 text-xs rounded ${
                selectedClip.fontSize === size
                  ? 'bg-[var(--fuse-accent)] text-white'
                  : 'bg-[var(--fuse-bg-tertiary)] text-[var(--fuse-text-secondary)] hover:bg-[var(--fuse-bg-tertiary)]/80'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div className="space-y-1">
        <label className="text-xs text-[var(--fuse-text-secondary)]">Color</label>
        <div className="flex gap-1 flex-wrap">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                selectedClip.color === color
                  ? 'border-white scale-110'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        
        {/* Custom color input */}
        <div className="flex items-center gap-2 mt-2">
          <input
            type="color"
            value={selectedClip.color || '#ffffff'}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
          <input
            type="text"
            value={selectedClip.color || '#ffffff'}
            onChange={(e) => handleColorChange(e.target.value)}
            className="flex-1 px-2 py-1 bg-[var(--fuse-bg-tertiary)] rounded text-xs text-[var(--fuse-text-primary)] font-mono"
          />
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-1">
        <label className="text-xs text-[var(--fuse-text-secondary)]">
          Duration: {selectedClip.duration.toFixed(1)}s
        </label>
        <input
          type="range"
          min="0.5"
          max="30"
          step="0.5"
          value={selectedClip.duration}
          onChange={(e) => {
            if (clipId) {
              updateClip(clipId, { 
                duration: Number(e.target.value),
                outPoint: Number(e.target.value),
              });
            }
          }}
          className="w-full h-2 rounded-lg appearance-none bg-[var(--fuse-bg-tertiary)] accent-[var(--fuse-accent)]"
        />
      </div>
    </div>
  );
}

