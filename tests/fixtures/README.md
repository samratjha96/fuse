# Test Fixtures

This folder contains media files for e2e and regression testing. The actual media files are git-ignored.

## Setup

Run the download script to fetch the test fixtures:

```bash
./tests/fixtures/download.sh
```

Or manually download:

### Video Files

| File | Source | Duration | Resolution | Size |
|------|--------|----------|------------|------|
| `big-buck-bunny-720p-5s.mp4` | Blender Foundation | 5s | 1280x720 | ~1MB |
| `sintel-trailer-480p.mp4` | Blender Foundation | 52s | 854x480 | ~5MB |

### Audio Files

| File | Source | Duration | Format | Size |
|------|--------|----------|--------|------|
| `piano-melody.mp3` | Pixabay | 10s | MP3 128kbps | ~150KB |

## Sources

All files are from public domain or Creative Commons sources:

- **Big Buck Bunny**: https://peach.blender.org/ (CC-BY 3.0)
- **Sintel**: https://durian.blender.org/ (CC-BY 3.0)
- **Audio**: https://pixabay.com/music/ (Pixabay License)

## Usage in Tests

```typescript
import { resolve } from 'path';

const FIXTURES_DIR = resolve(__dirname, '../fixtures');
const testVideo = resolve(FIXTURES_DIR, 'big-buck-bunny-720p-5s.mp4');
```

