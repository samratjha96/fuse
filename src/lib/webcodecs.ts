/**
 * WebCodecs wrapper for video/audio decoding and encoding
 */

export interface DecodedFrame {
  frame: VideoFrame;
  timestamp: number;
  duration: number;
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  frameRate: number;
  codec: string;
}

export interface AudioMetadata {
  sampleRate: number;
  channels: number;
  duration: number;
  codec: string;
}

/**
 * Check if WebCodecs is supported
 */
export function isWebCodecsSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof AudioDecoder !== 'undefined'
  );
}

/**
 * Check if a specific video codec is supported
 */
export async function isVideoCodecSupported(codec: string): Promise<boolean> {
  try {
    const support = await VideoEncoder.isConfigSupported({
      codec,
      width: 1920,
      height: 1080,
    });
    return support.supported === true;
  } catch {
    return false;
  }
}

/**
 * Check if a specific audio codec is supported
 */
export async function isAudioCodecSupported(codec: string): Promise<boolean> {
  try {
    const support = await AudioEncoder.isConfigSupported({
      codec,
      sampleRate: 48000,
      numberOfChannels: 2,
    });
    return support.supported === true;
  } catch {
    return false;
  }
}

/**
 * Create a video decoder
 */
export function createVideoDecoder(
  onFrame: (frame: VideoFrame, metadata: { timestamp: number }) => void,
  onError: (error: Error) => void
): VideoDecoder {
  return new VideoDecoder({
    output: (frame) => {
      onFrame(frame, { timestamp: frame.timestamp || 0 });
    },
    error: onError,
  });
}

/**
 * Create an audio decoder
 */
export function createAudioDecoder(
  onData: (data: AudioData) => void,
  onError: (error: Error) => void
): AudioDecoder {
  return new AudioDecoder({
    output: onData,
    error: onError,
  });
}

/**
 * Create a video encoder with H.264 codec
 */
export async function createVideoEncoder(
  width: number,
  height: number,
  frameRate: number,
  bitrate: number,
  onChunk: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void,
  onError: (error: Error) => void
): Promise<VideoEncoder> {
  const encoder = new VideoEncoder({
    output: onChunk,
    error: onError,
  });

  const config: VideoEncoderConfig = {
    codec: 'avc1.640028', // H.264 High Profile Level 4.0
    width,
    height,
    bitrate,
    framerate: frameRate,
    latencyMode: 'quality',
    avc: { format: 'annexb' },
  };

  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) {
    throw new Error('Video encoder configuration not supported');
  }

  encoder.configure(config);
  return encoder;
}

/**
 * Create an audio encoder with AAC codec
 */
export async function createAudioEncoder(
  sampleRate: number,
  channels: number,
  bitrate: number,
  onChunk: (chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void,
  onError: (error: Error) => void
): Promise<AudioEncoder> {
  const encoder = new AudioEncoder({
    output: onChunk,
    error: onError,
  });

  const config: AudioEncoderConfig = {
    codec: 'mp4a.40.2', // AAC-LC
    sampleRate,
    numberOfChannels: channels,
    bitrate,
  };

  const support = await AudioEncoder.isConfigSupported(config);
  if (!support.supported) {
    throw new Error('Audio encoder configuration not supported');
  }

  encoder.configure(config);
  return encoder;
}

/**
 * Extract a frame at a specific timestamp
 */
export async function extractFrameAtTime(
  _decoder: VideoDecoder,
  timestamp: number
): Promise<VideoFrame | null> {
  // This is a placeholder - actual implementation requires seeking in the demuxer
  console.log('Extracting frame at', timestamp);
  return null;
}

/**
 * Convert VideoFrame to ImageBitmap for canvas rendering
 */
export async function frameToImageBitmap(frame: VideoFrame): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(frame);
  return bitmap;
}

/**
 * Get video encoder configurations for common presets
 */
export function getEncoderPreset(
  preset: 'low' | 'medium' | 'high' | 'ultra'
): { videoBitrate: number; audioBitrate: number } {
  const presets = {
    low: { videoBitrate: 2_000_000, audioBitrate: 128_000 },
    medium: { videoBitrate: 5_000_000, audioBitrate: 192_000 },
    high: { videoBitrate: 10_000_000, audioBitrate: 256_000 },
    ultra: { videoBitrate: 20_000_000, audioBitrate: 320_000 },
  };
  return presets[preset];
}

