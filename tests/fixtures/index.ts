/**
 * Test Fixtures Helper
 *
 * Provides paths to test media files for e2e and integration tests.
 * Run `./tests/fixtures/download.sh` to fetch the fixtures first.
 */

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURES_DIR = resolve(__dirname);

export const fixtures = {
  /** Big Buck Bunny 720p, ~10s, H.264 (~1MB) */
  bigBuckBunny720p: resolve(FIXTURES_DIR, 'big-buck-bunny-720p-5s.mp4'),

  /** Sintel 480p short clip, H.264 (~12KB) */
  sintel480p: resolve(FIXTURES_DIR, 'sintel-trailer-480p.mp4'),

  /** Small test video 360p, very short (~770KB) */
  testVideo360p: resolve(FIXTURES_DIR, 'test-video-360p-1s.mp4'),

  /** Test audio MP3 (~8.5MB) */
  testAudio: resolve(FIXTURES_DIR, 'test-audio.mp3'),
} as const;

export type FixtureName = keyof typeof fixtures;

/**
 * Get fixture file path and verify it exists
 */
export function getFixture(name: FixtureName): string {
  const path = fixtures[name];
  if (!existsSync(path)) {
    throw new Error(
      `Fixture "${name}" not found at ${path}. Run ./tests/fixtures/download.sh first.`,
    );
  }
  return path;
}

/**
 * Get fixture file size in bytes
 */
export function getFixtureSize(name: FixtureName): number {
  const path = getFixture(name);
  return statSync(path).size;
}

/**
 * Read fixture as ArrayBuffer (for testing file import)
 */
export async function readFixtureAsArrayBuffer(name: FixtureName): Promise<ArrayBuffer> {
  const path = getFixture(name);
  const { readFile } = await import('node:fs/promises');
  const buffer = await readFile(path);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Read fixture as File object (for testing file input)
 */
export async function readFixtureAsFile(name: FixtureName): Promise<File> {
  const path = getFixture(name);
  const { readFile } = await import('node:fs/promises');
  const { basename } = await import('node:path');

  const buffer = await readFile(path);
  const fileName = basename(path);
  const mimeType = path.endsWith('.mp4')
    ? 'video/mp4'
    : path.endsWith('.mp3')
      ? 'audio/mpeg'
      : 'application/octet-stream';

  return new File([buffer], fileName, { type: mimeType });
}

/**
 * Check if all fixtures are available
 */
export function checkFixtures(): { available: FixtureName[]; missing: FixtureName[] } {
  const available: FixtureName[] = [];
  const missing: FixtureName[] = [];

  for (const [name, path] of Object.entries(fixtures)) {
    if (existsSync(path)) {
      available.push(name as FixtureName);
    } else {
      missing.push(name as FixtureName);
    }
  }

  return { available, missing };
}
