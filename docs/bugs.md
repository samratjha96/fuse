# Fuse - Known Bugs & Issues

> **Last Updated:** December 29, 2025  
> **Testing Environment:** macOS, Chrome, Playwright MCP

---

## ✅ Recently Fixed (December 29, 2025)

The following critical video editing features have been implemented and verified working via Playwright automated testing:

### ✅ Clip Splitting - FIXED
**Component:** Timeline / Core Editing

**What was fixed:**
- Added keyboard shortcuts: Press `S` or `C` to split selected clip at playhead
- Added "✂ Split" button in timeline toolbar
- Added right-click context menu with "Split at Playhead" option
- Track lock is respected - cannot split clips on locked tracks

**How to use:**
1. Import and add a video clip to the timeline
2. Click the clip to select it
3. Move playhead to desired split position (click on time ruler)
4. Press `S` or `C` key, click Split button, OR right-click → "Split at Playhead"

**Verified:** ✅ Tested with Playwright - split 10s clip into two 5s clips

---

### ✅ Clip Trimming - FIXED
**Component:** Timeline / Core Editing

**What was fixed:**
- Trim handles are now fully functional with drag support
- Dragging left edge adjusts startTime, duration, and inPoint
- Dragging right edge adjusts duration and outPoint
- 8px hot zones on clip edges for easier targeting
- Minimum clip duration enforced (0.1s)
- Visual feedback with cursor change to `ew-resize`

**How to use:**
1. Add a video clip to the timeline
2. Hover over the left or right edge of the clip (8px hot zone)
3. Cursor changes to resize indicator
4. Drag to trim the clip's in/out points

**Verified:** ✅ Tested with Playwright - trimmed 5s clip to 3s

---

### ✅ Clip Deletion - FIXED
**Component:** Timeline / Keyboard Shortcuts

**What was fixed:**
- Added keyboard shortcuts: Press `Delete` or `Backspace` to delete selected clips
- Added "🗑 Delete" button in timeline toolbar
- Added right-click context menu with "Delete" option
- Multiple selected clips can be deleted at once
- Track lock is respected - cannot delete clips on locked tracks

**How to use:**
1. Click on a clip to select it (Shift+click or Cmd/Ctrl+click for multi-select)
2. Press `Delete` or `Backspace`, click Delete button, OR right-click → "Delete"

**Verified:** ✅ Tested with Playwright - deleted clip after split

---

### ✅ Clip Drag-and-Drop - FIXED
**Component:** Timeline

**What was fixed:**
- Clips can now be dragged horizontally to reposition
- Click and drag in the center of a clip to move it
- Clips cannot be moved to negative time positions (enforced minimum 0)
- Track lock is respected - cannot move clips on locked tracks
- Visual feedback with `grab`/`grabbing` cursor states

**How to use:**
1. Add a clip to the timeline
2. Click and drag in the center of the clip (not on trim handles)
3. Release to drop at new position

**Verified:** ✅ Tested with Playwright - moved clip from 0:00 to 2:00

---

### ✅ Track Lock Protection - FIXED
**Component:** Timeline / Track Controls

**What was fixed:**
- Track lock now prevents the following operations on clips:
  - ✅ Splitting clips (S/C key, button, or context menu)
  - ✅ Deleting clips (Delete/Backspace or context menu)
  - ✅ Moving clips (drag)
  - ✅ Trimming clips (drag handles)
  - ✅ Duplicating clips (context menu)
- Visual feedback: locked clips show `not-allowed` cursor

**Still needed:**
- ⚠️ Prevent adding NEW clips to locked tracks (MediaBin double-click)

---

### ✅ Right-Click Context Menu - FIXED
**Component:** Timeline UI

**What was fixed:**
- Right-click on any clip shows context menu with:
  - "Split at Playhead" - splits clip at current playhead position
  - "Duplicate" - creates copy of clip after original
  - "Delete" - removes clip from timeline
- Menu closes when clicking elsewhere
- All operations respect track lock

---

### ✅ Visual Selection Feedback - FIXED
**Component:** Timeline UI

**What was fixed:**
- Selected clips now have a visible white ring highlight
- Ring uses offset to stand out from clip background
- Multi-select shows ring on all selected clips

---

### ✅ Toolbar Editing Buttons - ADDED
**Component:** Timeline UI

**What was added:**
- "✂ Split (S)" button - splits selected clip at playhead
- "🗑 Delete (Del)" button - deletes selected clips
- Buttons show keyboard shortcut hints
- Buttons are disabled (40% opacity) when no clip is selected
- Located between time display and zoom controls

---

## Remaining Issues

### Video Frames Not Rendering in Preview
**Severity:** High  
**Component:** Preview / WebCodecs Integration  
**Status:** Pending implementation

**Description:**  
When a video clip is added to the timeline, the preview canvas shows a placeholder "Video Frame" text instead of actual decoded video frames.

**Root Cause:**  
The decode worker (`src/workers/decode.worker.ts`) exists but is not wired up to the Preview component. The `useVideoPlayer` hook has TODO comments indicating frame decoding integration is pending.

---

### CI Build Fails Due to WASM Binding Linting
**Severity:** High  
**Component:** Build / CI  
**Status:** Configuration issue

**Description:**  
The CI pipeline fails because Biome lints auto-generated WASM binding files.

**Fix Required:**  
Add exclusion patterns to `biome.json`:
```json
{
  "files": {
    "ignore": ["src/wasm/*/fuse_*.js"]
  }
}
```

---

### Imported Video Shows Incorrect Duration
**Severity:** Medium  
**Component:** Media Bin / Demuxer  
**Status:** Bug

**Description:**  
When importing a video file, the duration shown in the Media Bin thumbnail does not match the actual video duration.

**Example:**
- Import `test-video-360p-1s.mp4` (a 1-second video)
- Shows `0:10` (10 seconds) instead of `0:01`

**Notes:**  
May be related to how `mp4box.js` reports duration or a unit conversion issue in the demuxer.

---

### Track Mute Has No Effect
**Severity:** Medium  
**Component:** Timeline / Playback  
**Status:** Pending (depends on playback implementation)

**Description:**  
The Mute button on tracks toggles visually but has no effect on playback since video/audio playback isn't fully implemented.

---

### Export MP4 Button Not Functional
**Severity:** Medium  
**Component:** Export Dialog  
**Status:** Pending implementation

**Description:**  
The Export MP4 button in the Export dialog doesn't produce an actual MP4 file. The WASM muxer exists but the full export pipeline is not connected.

---

## Low Priority / Future Enhancements

### No Undo/Redo Support
**Description:** No way to undo accidental clip deletions or property changes.  
**Solution:** Implement zustand middleware for undo/redo history.

### No Keyboard Shortcut Help
**Description:** No visible documentation or tooltip for available keyboard shortcuts.  
**Solution:** Add a help modal or tooltips.

### No Snap to Playhead/Clips
**Description:** When dragging clips, they don't snap to playhead or other clip edges.  
**Solution:** Implement snap logic in drag handlers.

### No Ripple Delete
**Description:** Deleting a clip leaves a gap; following clips don't automatically shift.  
**Solution:** Add ripple edit mode toggle.

### Add Clip at Playhead Position
**Description:** When double-clicking media in bin, clips always start at 0:00 instead of current playhead.  
**Solution:** Modify `addClip` in MediaBin to use current playhead as start time.

---

## Environment Notes

- **Browser Support:** WebCodecs requires Chrome/Edge. Firefox and Safari have limited/no support.
- **File Types:** Only MP4, WebM, MOV are listed as supported in the UI.
- **WASM:** Requires browsers that support WebAssembly.

---

## Quick Reference: Working Features

| Feature | Keyboard | Button | Context Menu |
|---------|----------|--------|--------------|
| Split clip | `S` or `C` | ✅ Split button | ✅ "Split at Playhead" |
| Delete clip | `Delete` or `Backspace` | ✅ Delete button | ✅ "Delete" |
| Duplicate clip | - | - | ✅ "Duplicate" |
| Move clip | Drag center | - | - |
| Trim clip | Drag edges | - | - |
| Select clip | Click | - | - |
| Multi-select | Shift/Cmd+Click | - | - |
| Play/Pause | `Space` | ✅ Play/Pause button | - |
| Seek | `←` / `→` / Click ruler | - | - |

---

## Related Documentation

- [Regression Test Plan](./regression-test.md) - Full QA test checklist
- [Architecture](./architecture.md) - System design overview
- [Roadmap](./roadmap.md) - Planned features and priorities
