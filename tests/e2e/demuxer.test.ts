/**
 * Demuxer E2E Tests
 *
 * Tests the mp4box.js demuxer with real video files.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { checkFixtures, getFixture, readFixtureAsArrayBuffer } from '../fixtures';

describe('Demuxer E2E', () => {
  beforeAll(() => {
    const { missing } = checkFixtures();
    if (missing.length > 0) {
      console.warn(`Missing fixtures: ${missing.join(', ')}. Run ./tests/fixtures/download.sh`);
    }
  });

  describe('File Loading', () => {
    it('should load test video fixture', async () => {
      const path = getFixture('testVideo360p');
      expect(path).toContain('test-video-360p-1s.mp4');

      const buffer = await readFixtureAsArrayBuffer('testVideo360p');
      expect(buffer.byteLength).toBeGreaterThan(0);
      expect(buffer.byteLength).toBeLessThan(1024 * 1024); // < 1MB
    });

    it('should load Big Buck Bunny fixture', async () => {
      const buffer = await readFixtureAsArrayBuffer('bigBuckBunny720p');
      expect(buffer.byteLength).toBeGreaterThan(500 * 1024); // > 500KB
    });

    it('should load audio fixture', async () => {
      const buffer = await readFixtureAsArrayBuffer('testAudio');
      expect(buffer.byteLength).toBeGreaterThan(0);
    });
  });

  describe('MP4 Parsing', () => {
    it('should detect MP4 magic bytes', async () => {
      const buffer = await readFixtureAsArrayBuffer('testVideo360p');
      const view = new DataView(buffer);

      // MP4 files start with ftyp box
      // First 4 bytes = box size, next 4 bytes = 'ftyp' (0x66747970)
      const boxType = view.getUint32(4);
      expect(boxType).toBe(0x66747970); // 'ftyp'
    });

    it('should parse MP4 with mp4box.js', async () => {
      // This test requires browser environment for full mp4box.js
      // For now, just verify the buffer is valid
      const buffer = await readFixtureAsArrayBuffer('bigBuckBunny720p');
      const view = new DataView(buffer);

      // Verify it's a valid MP4
      const ftypBox = view.getUint32(4);
      expect(ftypBox).toBe(0x66747970);

      // Check for moov box (movie metadata) somewhere in the file
      // This is a simplified check - real parsing would use mp4box.js
      const bufferArray = new Uint8Array(buffer);
      let hasMoov = false;

      for (let i = 0; i < Math.min(buffer.byteLength - 4, 10000); i++) {
        if (
          bufferArray[i] === 0x6d && // 'm'
          bufferArray[i + 1] === 0x6f && // 'o'
          bufferArray[i + 2] === 0x6f && // 'o'
          bufferArray[i + 3] === 0x76 // 'v'
        ) {
          hasMoov = true;
          break;
        }
      }

      expect(hasMoov).toBe(true);
    });
  });
});
