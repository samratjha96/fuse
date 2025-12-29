import { describe, expect, it, vi } from 'vitest';
import { getEncoderPreset, isWebCodecsSupported } from '../webcodecs';

describe('WebCodecs Utilities', () => {
  describe('isWebCodecsSupported', () => {
    it('should return false when WebCodecs is not available', () => {
      // In jsdom, WebCodecs is not available
      const result = isWebCodecsSupported();
      expect(result).toBe(false);
    });

    it('should return true when all WebCodecs APIs are available', () => {
      // Mock WebCodecs APIs
      const originalVideoEncoder = globalThis.VideoEncoder;
      const originalVideoDecoder = globalThis.VideoDecoder;
      const originalAudioEncoder = globalThis.AudioEncoder;
      const originalAudioDecoder = globalThis.AudioDecoder;

      globalThis.VideoEncoder = vi.fn() as unknown as typeof VideoEncoder;
      globalThis.VideoDecoder = vi.fn() as unknown as typeof VideoDecoder;
      globalThis.AudioEncoder = vi.fn() as unknown as typeof AudioEncoder;
      globalThis.AudioDecoder = vi.fn() as unknown as typeof AudioDecoder;

      const result = isWebCodecsSupported();
      expect(result).toBe(true);

      // Restore
      globalThis.VideoEncoder = originalVideoEncoder;
      globalThis.VideoDecoder = originalVideoDecoder;
      globalThis.AudioEncoder = originalAudioEncoder;
      globalThis.AudioDecoder = originalAudioDecoder;
    });
  });

  describe('getEncoderPreset', () => {
    it('should return correct bitrates for low preset', () => {
      const preset = getEncoderPreset('low');
      expect(preset).toEqual({
        videoBitrate: 2_000_000,
        audioBitrate: 128_000,
      });
    });

    it('should return correct bitrates for medium preset', () => {
      const preset = getEncoderPreset('medium');
      expect(preset).toEqual({
        videoBitrate: 5_000_000,
        audioBitrate: 192_000,
      });
    });

    it('should return correct bitrates for high preset', () => {
      const preset = getEncoderPreset('high');
      expect(preset).toEqual({
        videoBitrate: 10_000_000,
        audioBitrate: 256_000,
      });
    });

    it('should return correct bitrates for ultra preset', () => {
      const preset = getEncoderPreset('ultra');
      expect(preset).toEqual({
        videoBitrate: 20_000_000,
        audioBitrate: 320_000,
      });
    });
  });
});
