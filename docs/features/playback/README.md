# Video Playback Architecture Rewrite

## Problem Statement

The current video playback implementation has several critical issues causing flashing and poor playback:

1. **Seek called on every frame** - The playback loop calls `seekTo()` every animation frame, causing constant decoder resets
2. **No frame reordering** - B-frames arrive in decode order, not display order, causing visual glitches
3. **Single global frame cache** - Frames from different video sources get mixed together
4. **No jump detection** - Can't distinguish between scrubbing (needs seek) and playback (continuous decode)

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MAIN THREAD                              │
│                                                                  │
│  FrameBufferService (per-source caching, jump detection)        │
│  PlaybackController (continuous vs scrub mode)                  │
│  Preview (render from cache, never wait for decode)             │
└─────────────────────────────────────────────────────────────────┘
                              │ postMessage
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DECODE WORKER                             │
│                                                                  │
│  SourceSession (per-source demux state + keyframe index)        │
│  FrameReorderBuffer (collect frames, sort by PTS, emit ordered) │
│  Decode modes: CONTINUOUS (playback) vs SEEK (scrubbing)        │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Tasks

### Task 1: Frame Reorder Buffer in Worker
- [x] **Status: COMPLETE**
- File: `src/workers/decode.worker.ts`
- Added FrameReorderBuffer class that collects decoded frames, sorts by PTS, emits in display order
- Integrated with VideoDecoder output callback
- Updated handleSeek to flush buffer before seeking
- Updated handleStop to clear buffer

### Task 2: Keyframe Index and Sample Metadata
- [x] **Status: COMPLETE**
- File: `src/workers/decode.worker.ts`
- Added SampleMetadata interface for storing sample info
- Added KeyframeIndex class with binary search for O(log n) seek lookups
- Integrated keyframe index building into onSamples callback
- Updated DecodeSession to include keyframeIndex and codecConfig

### Task 3: Decode Modes (CONTINUOUS vs SEEK)
- [x] **Status: COMPLETE**
- File: `src/workers/decode.worker.ts`
- Added mode: 'idle' | 'continuous' | 'seeking' to DecodeSession
- Updated handleSeek to use keyframe index for efficient seeking
- Seek now uses binary search O(log n) to find nearest keyframe
- Mode transitions: idle → continuous (on decode) → seeking (on seek) → continuous

### Task 4: Per-Source Frame Cache
- [x] **Status: COMPLETE**
- File: `src/hooks/useVideoPlayer.ts`
- Added FrameCacheManager class with per-source caching
- Each source has its own Map<timestamp, ImageBitmap> with sorted timestamps
- Binary search for O(log n) frame lookup: getFrame(sourceId, time) returns closest frame ≤ time
- LRU eviction: max 300 frames per source, max 10 sources cached
- renderFrame now uses per-source getFrame with clip.sourceId

### Task 5: Jump Detection and Playback Controller
- [x] **Status: COMPLETE**
- File: `src/hooks/useVideoPlayer.ts`
- Added PlaybackController class that tracks lastRequestedTime per source
- detectTimeChange() returns 'seek' or 'continuous' based on 100ms threshold
- Added requestFrame(sourceId, time) that uses jump detection
- Only sends seek command when delta > 100ms (actual scrub/click)
- During continuous playback, frames come from cache without decoder reset

### Task 6: Update Preview Component
- [x] **Status: COMPLETE**
- File: `src/components/Preview/index.tsx`
- Replaced seekTo() with requestFrame() which has jump detection
- Removed duplicate seek in playback loop (was causing flashing!)
- Playback loop now just updates time, frame request effect handles seeking
- Jump detection ensures seeks only happen on scrub/click, not during continuous playback

### Task 7: Integration Testing
- [x] **Status: COMPLETE**
- TypeScript compilation: ✅ Passes
- Vite build: ✅ Successful
- Playwright automated testing: ✅ All tests passed
  - Video import: ✅ Works correctly
  - Video display in preview: ✅ Frames render properly
  - Playback (Play/Pause): ✅ Smooth, no flashing
  - Scrubbing (timeline click): ✅ Instant frame updates
  - Console errors: ✅ None

## Progress Log

| Date | Task | Status | Notes |
|------|------|--------|-------|
| 2024-12-29 | Task 1 | ✅ Complete | Added FrameReorderBuffer class to decode.worker.ts |
| 2024-12-29 | Task 2 | ✅ Complete | Added KeyframeIndex with O(log n) binary search |
| 2024-12-29 | Task 3 | ✅ Complete | Added decode modes and keyframe-based seeking |
| 2024-12-29 | Task 4 | ✅ Complete | Replaced global cache with per-source FrameCacheManager |
| 2024-12-29 | Task 5 | ✅ Complete | Added PlaybackController with 100ms jump threshold |
| 2024-12-29 | Task 6 | ✅ Complete | Updated Preview to use requestFrame with jump detection |
| 2024-12-29 | Task 7 | ✅ Complete | Build passes, ready for manual testing |

## Files Modified

- `src/workers/decode.worker.ts` - Decode worker with reordering and modes
- `src/hooks/useVideoPlayer.ts` - Per-source caching and jump detection
- `src/components/Preview/index.tsx` - Cleaner playback loop

