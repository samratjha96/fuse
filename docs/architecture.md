# Fuse Architecture

Fuse is a browser-based video editor built with modern web technologies. It leverages WebCodecs for hardware-accelerated video processing and WebAssembly for performance-critical operations.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Browser                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  MediaBin   │  │   Preview   │  │  Timeline   │  │ Properties  │   │
│  │  (Import)   │  │  (Playback) │  │  (Editing)  │  │   (Edit)    │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │          │
│         └────────────────┴────────────────┴────────────────┘          │
│                                   │                                    │
│                    ┌──────────────┴──────────────┐                    │
│                    │     Zustand Store           │                    │
│                    │   (Timeline State)          │                    │
│                    └──────────────┬──────────────┘                    │
│                                   │                                    │
│    ┌──────────────────────────────┼──────────────────────────────┐    │
│    │                              │                              │    │
│    ▼                              ▼                              ▼    │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐   │
│  │  mp4box.js  │          │  WebCodecs  │          │    WASM     │   │
│  │  (Demuxer)  │          │  (Decode/   │          │  (Muxer/    │   │
│  │             │          │   Encode)   │          │   Mixer)    │   │
│  └─────────────┘          └─────────────┘          └─────────────┘   │
│         │                        │                        │          │
│         └────────────────────────┼────────────────────────┘          │
│                                  ▼                                    │
│                         ┌─────────────┐                              │
│                         │  IndexedDB  │                              │
│                         │  (Storage)  │                              │
│                         └─────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── App.tsx                 # Main application layout
├── main.tsx               # React entry point
├── index.css              # Global styles (Tailwind)
│
├── components/            # UI Components
│   ├── MediaBin/          # Media import and library
│   ├── Preview/           # Video preview player
│   ├── Timeline/          # Multi-track timeline editor
│   ├── TextOverlay/       # Text overlay editor
│   └── ExportDialog/      # Export settings and progress
│
├── store/                 # State Management
│   └── timeline.ts        # Zustand store with Immer
│
├── lib/                   # Core Libraries
│   ├── demuxer.ts         # mp4box.js wrapper for MP4 parsing
│   ├── webcodecs.ts       # WebCodecs utilities
│   └── storage.ts         # IndexedDB operations
│
├── hooks/                 # React Hooks
│   └── useVideoPlayer.ts  # Video playback with frame caching
│
├── workers/               # Web Workers
│   └── decode.worker.ts   # Background video decoding
│
├── wasm/                  # Compiled WebAssembly
│   ├── audio-mixer/       # Audio mixing (Rust → WASM)
│   └── muxer/             # MP4 muxing (Rust → WASM)
│
└── types/                 # TypeScript Definitions
    └── mp4box.d.ts        # Types for mp4box.js
```

## Core Components

### 1. MediaBin (`src/components/MediaBin/`)

Handles media import via drag-and-drop or file picker.

**Responsibilities:**
- Accept video/audio files (MP4, WebM, MOV, MP3, WAV)
- Demux files using mp4box.js to extract metadata
- Store raw file data in IndexedDB
- Display imported media with thumbnails
- Allow dragging media to timeline

### 2. Timeline (`src/components/Timeline/`)

Multi-track non-linear editor interface.

**Responsibilities:**
- Display video, audio, and text tracks
- Handle clip placement, moving, and resizing
- Support clip splitting at playhead
- Zoom and scroll controls
- Track mute/lock toggles
- Playhead scrubbing

**Track Types:**
- `video` - Video clips with visual frames
- `audio` - Audio clips with waveform display
- `text` - Text overlay clips

### 3. Preview (`src/components/Preview/`)

Real-time video preview with playback controls.

**Responsibilities:**
- Render current frame from timeline
- Composite video, text overlays
- Play/pause/seek controls
- Frame-accurate seeking
- Display timecode

### 4. TextOverlay (`src/components/TextOverlay/`)

Text annotation editor.

**Responsibilities:**
- Add text overlays to timeline
- Edit font, size, color
- Position text on video canvas
- Preview text in real-time

### 5. ExportDialog (`src/components/ExportDialog/`)

Video export interface.

**Responsibilities:**
- Configure output settings (resolution, codec, quality)
- Show export progress
- Encode video using WebCodecs
- Mux using WASM muxer
- Download final MP4

## State Management

### Zustand Store (`src/store/timeline.ts`)

Centralized state with Immer for immutable updates.

```typescript
interface TimelineState {
  // Data
  tracks: Track[];           // All tracks with clips
  sources: SourceFile[];     // Imported media files
  
  // Playback
  currentTime: number;       // Playhead position (seconds)
  duration: number;          // Total timeline duration
  isPlaying: boolean;        // Playback state
  
  // Selection
  selectedClipIds: string[]; // Currently selected clips
  selectedTrackId: string;   // Currently selected track
  
  // View
  zoom: number;              // Pixels per second
  scrollX: number;           // Horizontal scroll offset
}
```

### Data Models

**Track:**
```typescript
interface Track {
  id: string;
  type: 'video' | 'audio' | 'text';
  name: string;
  clips: Clip[];
  muted: boolean;
  locked: boolean;
  height: number;
}
```

**Clip:**
```typescript
interface Clip {
  id: string;
  type: ClipType;
  trackId: string;
  sourceId: string;      // Reference to SourceFile
  startTime: number;     // Position on timeline
  duration: number;      // Duration on timeline
  inPoint: number;       // Trim start in source
  outPoint: number;      // Trim end in source
  // Text-specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  position?: { x: number; y: number };
}
```

## Media Pipeline

### Import Flow

```
User drops file
      │
      ▼
┌─────────────┐
│  MediaBin   │ ─── Reads file as ArrayBuffer
└─────────────┘
      │
      ▼
┌─────────────┐
│  Demuxer    │ ─── mp4box.js parses container
└─────────────┘     extracts: codec info, duration, tracks
      │
      ▼
┌─────────────┐
│  IndexedDB  │ ─── Stores raw file + metadata
└─────────────┘
      │
      ▼
┌─────────────┐
│  Store      │ ─── Adds SourceFile to state
└─────────────┘
```

### Playback Flow

```
currentTime changes
      │
      ▼
┌─────────────┐
│  Preview    │ ─── Requests frame at currentTime
└─────────────┘
      │
      ▼
┌─────────────┐
│  Worker     │ ─── Demuxes encoded samples
└─────────────┘
      │
      ▼
┌─────────────┐
│ VideoDecoder│ ─── Hardware-accelerated decode
└─────────────┘
      │
      ▼
┌─────────────┐
│  Canvas     │ ─── Composites frame + overlays
└─────────────┘
```

### Export Flow

```
User clicks Export
      │
      ▼
┌─────────────┐
│ ExportDialog│ ─── Configure settings
└─────────────┘
      │
      ▼
┌─────────────┐
│  Renderer   │ ─── Walk timeline, render each frame
└─────────────┘
      │
      ▼
┌─────────────────────────────────┐
│  For each frame:                │
│  1. Decode source frames        │
│  2. Composite video layers      │
│  3. Render text overlays        │
│  4. Encode with VideoEncoder    │
│  5. Send to WASM muxer          │
└─────────────────────────────────┘
      │
      ▼
┌─────────────┐
│ WASM Muxer  │ ─── Creates MP4 container
└─────────────┘
      │
      ▼
┌─────────────┐
│  Download   │ ─── User saves file
└─────────────┘
```

## WebAssembly Modules

### Audio Mixer (`wasm/audio-mixer/`)

Written in Rust, handles audio operations.

**API:**
```typescript
class AudioMixer {
  constructor(sampleRate: number, channels: number);
  add_track(track: AudioTrack): void;
  mix(durationSamples: number): Float32Array;
  static apply_gain(samples: Float32Array, gain: number): Float32Array;
  static crossfade(a: Float32Array, b: Float32Array, fadeSamples: number): Float32Array;
}

class AudioTrack {
  constructor(samples: Float32Array, gain: number, pan: number, startSample: number);
}
```

### Muxer (`wasm/muxer/`)

Written in Rust, creates MP4 containers.

**API:**
```typescript
class Muxer {
  constructor();
  configure_video(width: number, height: number, codec: string): void;
  configure_audio(sampleRate: number, channels: number, codec: string): void;
  add_video_chunk(data: Uint8Array, timestamp: number, isKey: boolean): void;
  add_audio_chunk(data: Uint8Array, timestamp: number): void;
  finalize(): Uint8Array;  // Returns MP4 file bytes
  reset(): void;
}
```

## Storage Layer

### IndexedDB Schema (`src/lib/storage.ts`)

**Database:** `fuse-media-db`

**Object Stores:**
- `media-files` - Raw file blobs
- `thumbnails` - Generated video thumbnails
- `project-state` - Serialized timeline state (future)

## Technology Stack

| Layer | Technology |
|-------|------------|
| UI Framework | React 19 |
| Styling | Tailwind CSS 4 |
| State | Zustand + Immer |
| Build | Vite 7 |
| Language | TypeScript 5.9 |
| Demuxing | mp4box.js |
| Decoding/Encoding | WebCodecs API |
| Audio Processing | WASM (Rust) |
| Video Muxing | WASM (Rust) |
| Storage | IndexedDB |
| Linting | Biome |
| Testing | Vitest |

## Browser Requirements

- **Chrome 94+** / **Edge 94+** / **Opera 80+**
- WebCodecs API support
- IndexedDB support
- WebAssembly support
- Recommended: 8GB+ RAM for HD video editing

