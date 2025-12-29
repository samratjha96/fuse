# Fuse Roadmap

This document outlines what needs to be completed to make Fuse a fully functional, deployable video editor.

## Current Status: MVP Foundation ✅

The core architecture is in place with working UI components, state management, and WASM modules compiled. However, several critical features need implementation before the app can actually edit and export videos.

---

## Phase 1: Core Functionality (Critical)

These items are required for basic video editing to work.

### 1.1 Video Playback 🔴 HIGH PRIORITY

**Status:** Partially implemented (decoder worker exists but not wired up)

- [ ] Connect `decode.worker.ts` to Preview component
- [ ] Implement frame-accurate seeking
- [ ] Add frame caching for smooth scrubbing
- [ ] Handle audio playback synchronized with video
- [ ] Support playback at different speeds (0.5x, 1x, 2x)

**Files to modify:**
- `src/components/Preview/index.tsx`
- `src/hooks/useVideoPlayer.ts`
- `src/workers/decode.worker.ts`

### 1.2 MP4 Muxer Implementation 🔴 HIGH PRIORITY

**Status:** Placeholder only (`finalize()` returns empty array)

- [ ] Implement actual MP4 box writing in Rust
- [ ] Write ftyp, moov, mdat boxes
- [ ] Handle video track (avc1/hvc1)
- [ ] Handle audio track (mp4a)
- [ ] Support common codecs: H.264, H.265, AAC
- [ ] Write proper sample tables (stts, stsc, stsz, stco)

**Files to modify:**
- `wasm/muxer/src/lib.rs`
- Add `mp4` crate integration for box writing

### 1.3 Export Pipeline 🔴 HIGH PRIORITY

**Status:** UI exists but export produces nothing

- [ ] Render timeline frame-by-frame
- [ ] Composite video layers in correct order
- [ ] Render text overlays onto frames
- [ ] Encode frames using WebCodecs `VideoEncoder`
- [ ] Mix audio tracks using WASM AudioMixer
- [ ] Encode audio using WebCodecs `AudioEncoder`
- [ ] Feed encoded chunks to WASM Muxer
- [ ] Provide download of final MP4

**Files to modify:**
- `src/components/ExportDialog/index.tsx`
- New: `src/lib/exporter.ts`
- New: `src/workers/export.worker.ts`

---

## Phase 2: Essential Features

### 2.1 Clip Trimming

**Status:** Data model supports it, UI doesn't

- [ ] In/out point handles on clips
- [ ] Drag to trim start/end
- [ ] Ripple trim option
- [ ] Keyboard shortcuts (I, O for in/out)

### 2.2 Audio Waveform Display

**Status:** Not implemented

- [ ] Extract audio samples from video
- [ ] Generate waveform visualization
- [ ] Display in timeline clips
- [ ] Sync with zoom level

### 2.3 Video Thumbnails

**Status:** Not implemented

- [ ] Generate thumbnails on import
- [ ] Display in MediaBin
- [ ] Display in timeline clips
- [ ] Store in IndexedDB for caching

### 2.4 Undo/Redo

**Status:** Not implemented

- [ ] Track state history
- [ ] Keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
- [ ] Undo stack with reasonable limit (50 states)

### 2.5 Keyboard Shortcuts

**Status:** Minimal

- [ ] Space: Play/Pause
- [ ] J/K/L: Reverse/Stop/Forward
- [ ] Arrow keys: Frame step
- [ ] Delete/Backspace: Delete clip
- [ ] S: Split at playhead
- [ ] Cmd+A: Select all
- [ ] Cmd+D: Deselect

---

## Phase 3: Polish & UX

### 3.1 Snap to Playhead/Clips

- [ ] Magnetic snapping when dragging clips
- [ ] Snap to playhead position
- [ ] Snap to other clip edges
- [ ] Toggle snap on/off

### 3.2 Multi-select Operations

- [ ] Drag to select multiple clips
- [ ] Shift+click range selection
- [ ] Move multiple clips together
- [ ] Delete multiple clips

### 3.3 Transitions (Stretch Goal)

- [ ] Crossfade transition between clips
- [ ] Fade in/out
- [ ] Wipe transitions

### 3.4 Audio Volume Keyframes

- [ ] Volume envelope per clip
- [ ] Keyframe editing
- [ ] Fade in/out presets

### 3.5 Text Overlay Improvements

- [ ] Draggable positioning in preview
- [ ] Multiple text layers
- [ ] Animation presets (fade, slide)
- [ ] More font options

---

## Phase 4: Deployment

### 4.1 Build & Optimization

- [ ] Production build optimization
- [ ] WASM lazy loading
- [ ] Code splitting
- [ ] Asset optimization

### 4.2 Progressive Web App (PWA)

- [ ] Service worker for offline support
- [ ] Manifest file
- [ ] Install prompt
- [ ] Offline-first storage

### 4.3 Hosting

- [ ] Deploy to Vercel/Netlify/Cloudflare Pages
- [ ] Custom domain setup
- [ ] HTTPS (required for WebCodecs)

### 4.4 Error Handling & Recovery

- [ ] Graceful error boundaries
- [ ] Auto-save project state
- [ ] Crash recovery
- [ ] User-friendly error messages

---

## Phase 5: Advanced Features (Future)

### 5.1 Project Files

- [ ] Save/load project as JSON
- [ ] Export project file
- [ ] Recent projects list

### 5.2 Format Support

- [ ] WebM import/export
- [ ] MOV import
- [ ] ProRes export (if browser supports)
- [ ] GIF export

### 5.3 Effects

- [ ] Color correction (brightness, contrast, saturation)
- [ ] Filters (blur, sharpen)
- [ ] Chroma key (green screen)
- [ ] Picture-in-picture

### 5.4 Performance

- [ ] GPU-accelerated compositing (WebGPU)
- [ ] Background rendering
- [ ] Proxy editing for large files
- [ ] Multi-threaded encoding

---

## Priority Matrix

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 🔴 P0 | Video Playback | Medium | Critical |
| 🔴 P0 | MP4 Muxer | High | Critical |
| 🔴 P0 | Export Pipeline | High | Critical |
| 🟠 P1 | Clip Trimming | Medium | High |
| 🟠 P1 | Undo/Redo | Medium | High |
| 🟠 P1 | Keyboard Shortcuts | Low | High |
| 🟡 P2 | Audio Waveforms | Medium | Medium |
| 🟡 P2 | Video Thumbnails | Medium | Medium |
| 🟡 P2 | Snap to Grid | Low | Medium |
| 🟢 P3 | PWA | Medium | Low |
| 🟢 P3 | Transitions | High | Low |

---

## Technical Debt

Items to address for maintainability:

- [ ] Add error boundaries around main components
- [ ] Improve TypeScript strictness (enable `strictNullChecks`)
- [ ] Add integration tests for core workflows
- [ ] Document component APIs with JSDoc
- [ ] Performance profiling and optimization
- [ ] Accessibility audit (a11y)
- [ ] Mobile/tablet responsive design

---

## Estimated Timeline

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Phase 1 | 2-3 weeks | Can edit and export a video |
| Phase 2 | 2-3 weeks | Professional editing experience |
| Phase 3 | 1-2 weeks | Polished UX |
| Phase 4 | 1 week | Deployed and usable |
| Phase 5 | Ongoing | Feature parity with basic editors |

---

## Contributing

To work on any of these items:

1. Check if there's an existing issue/PR
2. Create a branch: `feature/item-name`
3. Implement with tests where applicable
4. Run `npm run ci` before submitting
5. Open a PR with description of changes

