# Fuse - Browser-Based Video Editor

A performant, browser-based video editor using the WebCodecs API for hardware-accelerated codec operations and Rust/WASM for audio mixing and MP4 muxing.

![Fuse Video Editor](https://placehold.co/1200x630/0d0d0f/f97316?text=Fuse+Video+Editor)

## Features

- 🎬 **Multi-track Timeline** - Video, audio, and text tracks with drag-and-drop editing
- ⚡ **Hardware Accelerated** - Uses WebCodecs for native codec performance
- 🔊 **Audio Mixing** - Rust/WASM audio mixer with gain and panning
- 📝 **Text Overlays** - Customizable text with positioning and styling
- 📦 **Lightweight** - ~500KB WASM binaries vs 25MB+ for FFmpeg.wasm
- 💾 **IndexedDB Storage** - Large files without memory pressure

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI Framework | React 18 + TypeScript |
| Styling | Tailwind CSS v4 |
| Video Processing | WebCodecs API |
| Demuxing | mp4box.js |
| Audio Processing | Rust/WASM |
| MP4 Muxing | Rust/WASM |
| State Management | Zustand |
| Storage | IndexedDB + OPFS |

## Browser Support

Fuse requires a browser with WebCodecs support:

- ✅ Chrome 94+
- ✅ Edge 94+
- ✅ Opera 80+
- ❌ Firefox (coming soon)
- ❌ Safari (coming soon)

## Getting Started

### Prerequisites

- Node.js 18+
- Rust + wasm-pack (for WASM modules)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Building WASM Modules

```bash
# Install wasm-pack if not already installed
cargo install wasm-pack

# Build audio mixer
cd wasm/audio-mixer
wasm-pack build --target web --release

# Build muxer
cd ../muxer
wasm-pack build --target web --release
```

## Project Structure

```
fuse/
├── src/
│   ├── components/         # React UI components
│   │   ├── Timeline/       # Multi-track timeline
│   │   ├── Preview/        # Video preview player
│   │   ├── MediaBin/       # Media import panel
│   │   └── ExportDialog/   # Export settings
│   ├── lib/                # Core libraries
│   │   ├── demuxer.ts      # mp4box.js wrapper
│   │   ├── webcodecs.ts    # WebCodecs utilities
│   │   └── storage.ts      # IndexedDB helpers
│   ├── store/              # Zustand state
│   └── types/              # TypeScript definitions
├── wasm/                   # Rust WASM modules
│   ├── muxer/              # MP4 muxer
│   └── audio-mixer/        # Audio mixing
└── public/
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` / `→` | Frame step |
| `Shift + ←/→` | 1 second step |
| `Home` | Go to start |
| `End` | Go to end |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + S` | Save project |

## Supported Formats

| Format | Import | Export |
|--------|--------|--------|
| MP4 (H.264/AAC) | ✅ | ✅ |
| WebM (VP8/VP9) | ✅ | ❌ |
| MOV (H.264/AAC) | ✅ | ❌ |

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     React UI Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Timeline │  │ Preview  │  │ MediaBin │  │  Export  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
┌───────┴─────────────┴─────────────┴─────────────┴──────────┐
│                   Zustand State Store                       │
└───────┬─────────────┬─────────────┬─────────────┬──────────┘
        │             │             │             │
┌───────┴───┐  ┌──────┴───┐  ┌──────┴───┐  ┌──────┴──────┐
│ WebCodecs │  │ mp4box.js│  │ WASM     │  │ IndexedDB   │
│ Decode/   │  │ Demuxer  │  │ Muxer +  │  │ + OPFS      │
│ Encode    │  │          │  │ Mixer    │  │ Storage     │
└───────────┘  └──────────┘  └──────────┘  └─────────────┘
```

## Development

```bash
# Run development server
npm run dev

# Type check
npm run build

# Lint
npm run lint
```

## License

MIT
