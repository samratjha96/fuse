import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// Types
export type ClipType = 'video' | 'audio' | 'text';

export interface Clip {
  id: string;
  type: ClipType;
  trackId: string;
  sourceId: string; // Reference to source file in storage
  startTime: number; // Start time on timeline (in seconds)
  duration: number; // Duration on timeline (in seconds)
  inPoint: number; // Trim start in source (in seconds)
  outPoint: number; // Trim end in source (in seconds)
  // Text-specific properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  position?: { x: number; y: number };
}

export interface Track {
  id: string;
  type: ClipType;
  name: string;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
  height: number;
}

export interface SourceFile {
  id: string;
  name: string;
  type: 'video' | 'audio';
  duration: number;
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
}

export interface TimelineState {
  // Timeline data
  tracks: Track[];
  sources: SourceFile[];
  
  // Playback state
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  
  // Selection state
  selectedClipIds: string[];
  selectedTrackId: string | null;
  
  // Zoom/scroll
  zoom: number; // Pixels per second
  scrollX: number;
  
  // Actions
  addTrack: (type: ClipType, name?: string) => string;
  removeTrack: (trackId: string) => void;
  addClip: (clip: Omit<Clip, 'id'>) => string;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  
  addSource: (source: Omit<SourceFile, 'id'>) => string;
  removeSource: (sourceId: string) => void;
  
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  
  selectClip: (clipId: string, multi?: boolean) => void;
  deselectAll: () => void;
  
  setZoom: (zoom: number) => void;
  setScrollX: (scrollX: number) => void;
  
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
}

const generateId = () => crypto.randomUUID();

export const useTimelineStore = create<TimelineState>()(
  immer((set, get) => ({
    // Initial state
    tracks: [],
    sources: [],
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    selectedClipIds: [],
    selectedTrackId: null,
    zoom: 100, // 100 pixels per second
    scrollX: 0,

    // Track actions
    addTrack: (type, name) => {
      const id = generateId();
      const defaultNames = { video: 'Video', audio: 'Audio', text: 'Text' };
      const trackCount = get().tracks.filter(t => t.type === type).length;
      
      set(state => {
        state.tracks.push({
          id,
          type,
          name: name || `${defaultNames[type]} ${trackCount + 1}`,
          clips: [],
          muted: false,
          locked: false,
          height: type === 'text' ? 40 : 60,
        });
      });
      
      return id;
    },

    removeTrack: (trackId) => {
      set(state => {
        state.tracks = state.tracks.filter(t => t.id !== trackId);
      });
    },

    // Clip actions
    addClip: (clip) => {
      const id = generateId();
      
      set(state => {
        const track = state.tracks.find(t => t.id === clip.trackId);
        if (track) {
          track.clips.push({ ...clip, id });
        }
      });
      
      // Update duration if needed
      const endTime = clip.startTime + clip.duration;
      if (endTime > get().duration) {
        set(state => { state.duration = endTime; });
      }
      
      return id;
    },

    updateClip: (clipId, updates) => {
      set(state => {
        for (const track of state.tracks) {
          const clip = track.clips.find(c => c.id === clipId);
          if (clip) {
            Object.assign(clip, updates);
            break;
          }
        }
      });
    },

    removeClip: (clipId) => {
      set(state => {
        for (const track of state.tracks) {
          track.clips = track.clips.filter(c => c.id !== clipId);
        }
        state.selectedClipIds = state.selectedClipIds.filter(id => id !== clipId);
      });
    },

    moveClip: (clipId, newTrackId, newStartTime) => {
      set(state => {
        let clipToMove: Clip | undefined;
        
        // Find and remove from current track
        for (const track of state.tracks) {
          const clipIndex = track.clips.findIndex(c => c.id === clipId);
          if (clipIndex !== -1) {
            clipToMove = track.clips[clipIndex];
            track.clips.splice(clipIndex, 1);
            break;
          }
        }
        
        // Add to new track
        if (clipToMove) {
          const newTrack = state.tracks.find(t => t.id === newTrackId);
          if (newTrack && newTrack.type === clipToMove.type) {
            clipToMove.trackId = newTrackId;
            clipToMove.startTime = Math.max(0, newStartTime);
            newTrack.clips.push(clipToMove);
          }
        }
      });
    },

    splitClip: (clipId, splitTime) => {
      set(state => {
        for (const track of state.tracks) {
          const clipIndex = track.clips.findIndex(c => c.id === clipId);
          if (clipIndex !== -1) {
            const clip = track.clips[clipIndex];
            const relativeTime = splitTime - clip.startTime;
            
            if (relativeTime > 0 && relativeTime < clip.duration) {
              // Create second clip
              const newClip: Clip = {
                ...clip,
                id: generateId(),
                startTime: splitTime,
                duration: clip.duration - relativeTime,
                inPoint: clip.inPoint + relativeTime,
              };
              
              // Modify first clip
              clip.duration = relativeTime;
              clip.outPoint = clip.inPoint + relativeTime;
              
              // Insert new clip
              track.clips.splice(clipIndex + 1, 0, newClip);
            }
            break;
          }
        }
      });
    },

    // Source actions
    addSource: (source) => {
      const id = generateId();
      set(state => {
        state.sources.push({ ...source, id });
      });
      return id;
    },

    removeSource: (sourceId) => {
      set(state => {
        state.sources = state.sources.filter(s => s.id !== sourceId);
        // Remove all clips using this source
        for (const track of state.tracks) {
          track.clips = track.clips.filter(c => c.sourceId !== sourceId);
        }
      });
    },

    // Playback actions
    setCurrentTime: (time) => {
      set(state => { state.currentTime = Math.max(0, time); });
    },

    setIsPlaying: (playing) => {
      set(state => { state.isPlaying = playing; });
    },

    setDuration: (duration) => {
      set(state => { state.duration = duration; });
    },

    // Selection actions
    selectClip: (clipId, multi = false) => {
      set(state => {
        if (multi) {
          if (state.selectedClipIds.includes(clipId)) {
            state.selectedClipIds = state.selectedClipIds.filter(id => id !== clipId);
          } else {
            state.selectedClipIds.push(clipId);
          }
        } else {
          state.selectedClipIds = [clipId];
        }
      });
    },

    deselectAll: () => {
      set(state => {
        state.selectedClipIds = [];
        state.selectedTrackId = null;
      });
    },

    // Zoom/scroll actions
    setZoom: (zoom) => {
      set(state => { state.zoom = Math.max(10, Math.min(500, zoom)); });
    },

    setScrollX: (scrollX) => {
      set(state => { state.scrollX = Math.max(0, scrollX); });
    },

    // Track toggle actions
    toggleTrackMute: (trackId) => {
      set(state => {
        const track = state.tracks.find(t => t.id === trackId);
        if (track) track.muted = !track.muted;
      });
    },

    toggleTrackLock: (trackId) => {
      set(state => {
        const track = state.tracks.find(t => t.id === trackId);
        if (track) track.locked = !track.locked;
      });
    },
  }))
);

