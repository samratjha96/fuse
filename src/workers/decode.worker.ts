/**
 * Video/Audio Decode Worker
 * Handles demuxing and decoding video files using mp4box.js and WebCodecs
 *
 * Architecture Notes:
 * - Uses FrameReorderBuffer to handle B-frame decode ordering
 * - VideoDecoder outputs frames in DTS (decode) order, but we need PTS (presentation) order
 * - The reorder buffer collects frames, sorts by PTS, and emits in display order
 */

import type { MP4ArrayBuffer, MP4File, MP4Info, MP4Sample, MP4Track } from 'mp4box';
import * as MP4Box from 'mp4box';

// =============================================================================
// FRAME REORDER BUFFER
// =============================================================================
// Handles B-frame reordering: collects decoded frames, sorts by PTS, emits in order
// Typical H.264 content needs 4-16 frame buffer depending on profile

interface BufferedFrame {
  pts: number; // Presentation timestamp in microseconds
  frame: VideoFrame;
}

class FrameReorderBuffer {
  private buffer: Map<number, VideoFrame> = new Map();
  private readonly maxBufferSize: number;
  private emittedPts: Set<number> = new Set();

  constructor(maxBufferSize = 16) {
    this.maxBufferSize = maxBufferSize;
  }

  /**
   * Add a decoded frame to the buffer
   * Returns frames that are ready to be emitted in PTS order
   */
  add(frame: VideoFrame): BufferedFrame[] {
    const pts = frame.timestamp ?? 0;

    // Don't add duplicate PTS
    if (this.buffer.has(pts) || this.emittedPts.has(pts)) {
      frame.close();
      return [];
    }

    this.buffer.set(pts, frame);
    return this.tryEmit();
  }

  /**
   * Try to emit frames in order
   * Emits when buffer is full enough to ensure ordering
   */
  private tryEmit(): BufferedFrame[] {
    if (this.buffer.size === 0) return [];

    const toEmit: BufferedFrame[] = [];

    // Sort all PTS values
    const sortedPts = [...this.buffer.keys()].sort((a, b) => a - b);

    // Emit frames when we have enough buffered to be confident about order
    // Keep at least some frames in buffer to handle late arrivals
    const emitCount = Math.max(0, this.buffer.size - Math.floor(this.maxBufferSize / 2));

    for (let i = 0; i < emitCount && i < sortedPts.length; i++) {
      const pts = sortedPts[i];
      const frame = this.buffer.get(pts);
      if (frame) {
        toEmit.push({ pts, frame });
        this.buffer.delete(pts);
        this.emittedPts.add(pts);

        // Limit emitted PTS tracking to prevent memory growth
        if (this.emittedPts.size > 1000) {
          const oldPts = [...this.emittedPts].slice(0, 500);
          for (const p of oldPts) {
            this.emittedPts.delete(p);
          }
        }
      }
    }

    return toEmit;
  }

  /**
   * Flush all remaining frames (call on seek or stop)
   * Returns all buffered frames in PTS order
   */
  flush(): BufferedFrame[] {
    const sortedPts = [...this.buffer.keys()].sort((a, b) => a - b);
    const frames: BufferedFrame[] = [];

    for (const pts of sortedPts) {
      const frame = this.buffer.get(pts);
      if (frame) {
        frames.push({ pts, frame });
      }
    }

    this.buffer.clear();
    return frames;
  }

  /**
   * Clear buffer and close all frames (call on reset)
   */
  clear(): void {
    for (const frame of this.buffer.values()) {
      frame.close();
    }
    this.buffer.clear();
    this.emittedPts.clear();
  }

  get size(): number {
    return this.buffer.size;
  }
}

// =============================================================================
// SAMPLE METADATA & KEYFRAME INDEX
// =============================================================================
// Stores sample info after demux for efficient seeking

interface SampleMetadata {
  index: number;
  pts: number; // Presentation timestamp in microseconds
  dts: number; // Decode timestamp in microseconds
  duration: number; // Duration in microseconds
  isSync: boolean; // Is this a keyframe?
  size: number; // Sample size in bytes
}

/**
 * Keyframe index for efficient seeking
 * Allows O(log n) lookup of the keyframe needed to decode a specific time
 */
class KeyframeIndex {
  // Array of keyframe sample indices, sorted by PTS
  private keyframeIndices: number[] = [];
  // Map from sample index to PTS for quick lookup
  private samplePts: Map<number, number> = new Map();
  // All sample metadata
  private samples: SampleMetadata[] = [];

  /**
   * Build index from MP4 samples
   */
  buildFromSamples(mp4Samples: MP4Sample[]): void {
    this.samples = [];
    this.keyframeIndices = [];
    this.samplePts.clear();

    for (let i = 0; i < mp4Samples.length; i++) {
      const sample = mp4Samples[i];
      const pts = (sample.cts / sample.timescale) * 1_000_000; // Convert to microseconds
      const dts = (sample.dts / sample.timescale) * 1_000_000;
      const duration = (sample.duration / sample.timescale) * 1_000_000;

      const metadata: SampleMetadata = {
        index: i,
        pts,
        dts,
        duration,
        isSync: sample.is_sync,
        size: sample.size,
      };

      this.samples.push(metadata);
      this.samplePts.set(i, pts);

      if (sample.is_sync) {
        this.keyframeIndices.push(i);
      }
    }
  }

  /**
   * Find the keyframe index that should be used to seek to targetTimeUs
   * Returns the largest keyframe PTS that is <= targetTimeUs
   */
  findKeyframeBefore(targetTimeUs: number): { sampleIndex: number; pts: number } | null {
    if (this.keyframeIndices.length === 0) return null;

    // Binary search for the largest keyframe <= targetTimeUs
    let lo = 0;
    let hi = this.keyframeIndices.length - 1;
    let result = this.keyframeIndices[0];

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const sampleIdx = this.keyframeIndices[mid];
      const pts = this.samplePts.get(sampleIdx) ?? 0;

      if (pts <= targetTimeUs) {
        result = sampleIdx;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return {
      sampleIndex: result,
      pts: this.samplePts.get(result) ?? 0,
    };
  }

  /**
   * Get sample metadata by index
   */
  getSample(index: number): SampleMetadata | null {
    return this.samples[index] ?? null;
  }

  /**
   * Get all keyframe times in seconds (for sending to main thread)
   */
  getKeyframeTimes(): number[] {
    return this.keyframeIndices.map((idx) => {
      const pts = this.samplePts.get(idx) ?? 0;
      return pts / 1_000_000; // Convert to seconds
    });
  }

  /**
   * Get total sample count
   */
  get sampleCount(): number {
    return this.samples.length;
  }

  /**
   * Get keyframe count
   */
  get keyframeCount(): number {
    return this.keyframeIndices.length;
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.samples = [];
    this.keyframeIndices = [];
    this.samplePts.clear();
  }
}

// =============================================================================
// MESSAGE TYPES
// =============================================================================

interface WorkerMessage {
  type: 'decode' | 'seek' | 'stop' | 'extractThumbnail';
  id: string;
  data?: ArrayBuffer;
  time?: number;
}

interface DecodedFrameMessage {
  type: 'frame';
  id: string;
  frame: ImageBitmap;
  timestamp: number;
  duration: number;
}

interface VideoInfoMessage {
  type: 'info';
  id: string;
  info: {
    duration: number;
    width: number;
    height: number;
    frameRate: number;
    videoCodec: string;
    audioCodec: string | null;
    // New: Keyframe times for seeking (in seconds)
    keyframeTimes?: number[];
    // New: Total sample count
    sampleCount?: number;
  };
}

interface ThumbnailMessage {
  type: 'thumbnail';
  id: string;
  thumbnail: ImageBitmap;
}

interface ErrorMessage {
  type: 'error';
  id: string;
  error: string;
}

// Union type for all outgoing messages
export type OutgoingMessage =
  | DecodedFrameMessage
  | VideoInfoMessage
  | ThumbnailMessage
  | ErrorMessage;

// Decode mode for the session
type DecodeMode = 'idle' | 'continuous' | 'seeking';

// Session state for active decode sessions
interface DecodeSession {
  mp4File: MP4File;
  videoDecoder: VideoDecoder | null;
  audioDecoder: AudioDecoder | null;
  videoTrack: MP4Track | null;
  audioTrack: MP4Track | null;
  offset: number;
  keyframeReceived: boolean;
  // Frame reorder buffer for B-frame handling
  reorderBuffer: FrameReorderBuffer;
  // Decode mode
  mode: DecodeMode;
  // Frame rate for timing calculations
  frameRate: number;
  // Keyframe index for efficient seeking
  keyframeIndex: KeyframeIndex;
  // Store all samples for re-extraction after seek
  allSamplesReceived: boolean;
  // Codec config for decoder reconfiguration
  codecConfig: VideoDecoderConfig | null;
}

const decodeSessions = new Map<string, DecodeSession>();

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, id, data, time } = e.data;

  switch (type) {
    case 'decode':
      if (data) await handleDecode(id, data);
      break;
    case 'seek':
      if (time !== undefined) await handleSeek(id, time);
      break;
    case 'stop':
      handleStop(id);
      break;
    case 'extractThumbnail':
      if (data) await handleExtractThumbnail(id, data);
      break;
  }
};

async function handleDecode(id: string, data: ArrayBuffer): Promise<void> {
  try {
    const mp4File = MP4Box.createFile();
    let videoTrack: MP4Track | null = null;
    let audioTrack: MP4Track | null = null;
    let videoDecoder: VideoDecoder | null = null;

    // Create session with reorder buffer and keyframe index
    const session: DecodeSession = {
      mp4File,
      videoDecoder: null,
      audioDecoder: null,
      videoTrack: null,
      audioTrack: null,
      offset: 0,
      keyframeReceived: false,
      reorderBuffer: new FrameReorderBuffer(16), // 16 frame buffer for B-frames
      mode: 'idle',
      frameRate: 30, // Default, updated when info available
      keyframeIndex: new KeyframeIndex(),
      allSamplesReceived: false,
      codecConfig: null,
    };
    decodeSessions.set(id, session);

    mp4File.onReady = async (info: MP4Info) => {
      videoTrack = info.videoTracks[0] || null;
      audioTrack = info.audioTracks[0] || null;
      session.videoTrack = videoTrack;
      session.audioTrack = audioTrack;

      if (!videoTrack) {
        postError(id, 'No video track found');
        return;
      }

      // Calculate frame rate
      const frameRate = videoTrack.nb_samples / (videoTrack.duration / videoTrack.timescale);
      session.frameRate = frameRate;

      // Send video info
      const videoInfo: VideoInfoMessage = {
        type: 'info',
        id,
        info: {
          duration: info.duration / info.timescale,
          width: videoTrack.video?.width || videoTrack.track_width,
          height: videoTrack.video?.height || videoTrack.track_height,
          frameRate,
          videoCodec: videoTrack.codec,
          audioCodec: audioTrack?.codec || null,
        },
      };
      self.postMessage(videoInfo);

      // Create video decoder with reorder buffer integration
      videoDecoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          // Add frame to reorder buffer - it handles B-frame ordering
          const readyFrames = session.reorderBuffer.add(frame);

          // Process frames that are ready to emit (in correct PTS order)
          emitFrames(id, readyFrames);
        },
        error: (err: Error) => postError(id, err.message),
      });

      session.videoDecoder = videoDecoder;
      session.mode = 'continuous';

      // Set up extraction - request a generous batch so short fixtures fully decode
      // Use rapAlignment to ensure we start from a keyframe
      mp4File.setExtractionOptions(videoTrack.id, 'video', { nbSamples: 2000, rapAlignment: true });
      mp4File.start();
    };

    mp4File.onSamples = (trackId: number, _user: unknown, samples: MP4Sample[]) => {
      if (!videoDecoder || !videoTrack) return;
      if (trackId !== videoTrack.id) return;

      // Build keyframe index from samples (accumulates across batches)
      // Note: This builds incrementally as samples arrive
      if (!session.allSamplesReceived && samples.length > 0) {
        session.keyframeIndex.buildFromSamples(samples);
      }

      // Configure decoder on first keyframe sample
      if (videoDecoder.state === 'unconfigured') {
        // Find first keyframe in samples
        const firstKeyframe = samples.find((s) => s.is_sync);
        if (!firstKeyframe) {
          return; // Wait for a keyframe
        }

        const codecConfig: VideoDecoderConfig = {
          codec: videoTrack.codec,
          codedWidth: videoTrack.video?.width || videoTrack.track_width,
          codedHeight: videoTrack.video?.height || videoTrack.track_height,
        };

        // Get codec description from sample description entry
        // mp4box.js stores description data as the full box - we need to write it to get bytes
        const description = firstKeyframe.description;
        if (description) {
          // The description is the Sample Entry (avc1, hvc1, etc.)
          // We need to find the avcC or hvcC box inside it
          const avcC = description.avcC;
          const hvcC = description.hvcC;
          
          if (avcC) {
            // Write the avcC box to get raw bytes
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN) as any;
            (avcC as any).write(stream);
            codecConfig.description = new Uint8Array(stream.buffer, 8); // Skip box header (size + type = 8 bytes)
          } else if (hvcC) {
            // Write the hvcC box to get raw bytes
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN) as any;
            (hvcC as any).write(stream);
            codecConfig.description = new Uint8Array(stream.buffer, 8);
          }
        }

        // Store codec config for potential reconfiguration after seek
        session.codecConfig = codecConfig;

        try {
          videoDecoder.configure(codecConfig);
        } catch (err) {
          postError(id, `Failed to configure decoder: ${err}`);
          return;
        }
      }

      for (const sample of samples) {
        // Skip samples until we see the first keyframe (required after decoder reset)
        if (!session.keyframeReceived) {
          if (!sample.is_sync) continue;
          session.keyframeReceived = true;
        }

        const chunk = new EncodedVideoChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: (sample.cts / sample.timescale) * 1_000_000, // Convert to microseconds
          duration: (sample.duration / sample.timescale) * 1_000_000,
          data: sample.data,
        });

        try {
          videoDecoder.decode(chunk);
        } catch (err) {
          console.error('Decode error:', err);
        }
      }

      // Allow mp4box.js to continue extracting more samples
      const lastSample = samples[samples.length - 1];
      if (lastSample?.number !== undefined) {
        mp4File.releaseUsedSamples(trackId, lastSample.number);
      }
    };

    mp4File.onError = (error: Error) => {
      postError(id, error.message);
    };

    // Feed data to demuxer
    const buffer = data as MP4ArrayBuffer;
    buffer.fileStart = 0;
    mp4File.appendBuffer(buffer);
    mp4File.flush();
  } catch (err) {
    postError(id, `Decode error: ${err}`);
  }
}

async function handleSeek(id: string, time: number): Promise<void> {
  const session = decodeSessions.get(id);
  if (!session) {
    postError(id, 'No active session');
    return;
  }

  const { mp4File, videoDecoder, reorderBuffer, keyframeIndex } = session;

  // Set mode to seeking
  session.mode = 'seeking';

  // Flush reorder buffer first - emit any remaining frames in order
  const remainingFrames = reorderBuffer.flush();
  if (remainingFrames.length > 0) {
    await emitFrames(id, remainingFrames);
  }

  if (videoDecoder && videoDecoder.state !== 'closed') {
    // Reset decoder for seek
    await videoDecoder.flush();
    // After flush, decoder needs a keyframe to restart
    session.keyframeReceived = false;
  }

  // Use keyframe index for efficient seeking if available
  const targetTimeUs = time * 1_000_000; // Convert to microseconds
  const keyframeInfo = keyframeIndex.findKeyframeBefore(targetTimeUs);

  if (keyframeInfo) {
    // We have keyframe index - seek to the keyframe position
    const keyframeTimeSec = keyframeInfo.pts / 1_000_000;
    mp4File.seek(keyframeTimeSec, true);
  } else {
    // Fallback to demuxer's seek (useRap=true ensures we seek to a keyframe)
    mp4File.seek(time, true);
  }

  mp4File.start();

  // Back to continuous mode after seek starts
  session.mode = 'continuous';
}

function handleStop(id: string): void {
  const session = decodeSessions.get(id);
  if (!session) return;

  const { mp4File, videoDecoder, audioDecoder, reorderBuffer, keyframeIndex } = session;

  // Set mode to idle
  session.mode = 'idle';

  // Stop demuxer
  mp4File.stop();

  // Clear reorder buffer (closes all pending VideoFrames)
  reorderBuffer.clear();

  // Clear keyframe index
  keyframeIndex.clear();

  // Close decoders
  if (videoDecoder && videoDecoder.state !== 'closed') {
    videoDecoder.close();
  }

  if (audioDecoder && audioDecoder.state !== 'closed') {
    audioDecoder.close();
  }

  decodeSessions.delete(id);
}

async function handleExtractThumbnail(id: string, data: ArrayBuffer): Promise<void> {
  try {
    const mp4File = MP4Box.createFile();
    let videoDecoder: VideoDecoder | null = null;
    let thumbnailExtracted = false;

    mp4File.onReady = async (info: MP4Info) => {
      const videoTrack = info.videoTracks[0];
      if (!videoTrack) {
        postError(id, 'No video track found');
        return;
      }

      videoDecoder = new VideoDecoder({
        output: async (frame: VideoFrame) => {
          if (thumbnailExtracted) {
            frame.close();
            return;
          }
          thumbnailExtracted = true;

          try {
            const bitmap = await createImageBitmap(frame, {
              resizeWidth: 160,
              resizeHeight: 90,
            });
            const msg: ThumbnailMessage = {
              type: 'thumbnail',
              id,
              thumbnail: bitmap,
            };
            self.postMessage(msg, { transfer: [bitmap] });
          } finally {
            frame.close();
            if (videoDecoder) videoDecoder.close();
            mp4File.stop();
          }
        },
        error: (err: Error) => postError(id, err.message),
      });

      mp4File.setExtractionOptions(videoTrack.id, 'video', {
        nbSamples: 1,
        rapAlignment: true, // Get keyframe only
      });
      mp4File.start();
    };

    mp4File.onSamples = (_trackId: number, _user: unknown, samples: MP4Sample[]) => {
      if (!videoDecoder || thumbnailExtracted) return;

      const sample = samples[0];
      if (sample?.is_sync) {
        // Configure decoder on first sample using its description
        if (videoDecoder.state === 'unconfigured') {
          const videoTrack = mp4File.getInfo().videoTracks[0];
          if (!videoTrack) return;

          const codecConfig: VideoDecoderConfig = {
            codec: videoTrack.codec,
            codedWidth: videoTrack.video?.width || videoTrack.track_width,
            codedHeight: videoTrack.video?.height || videoTrack.track_height,
          };

          // Get codec description from sample description entry
          const description = sample.description;
          if (description) {
            const avcC = description.avcC;
            const hvcC = description.hvcC;
            
            if (avcC) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN) as any;
              (avcC as any).write(stream);
              codecConfig.description = new Uint8Array(stream.buffer, 8);
            } else if (hvcC) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN) as any;
              (hvcC as any).write(stream);
              codecConfig.description = new Uint8Array(stream.buffer, 8);
            }
          }

          try {
            videoDecoder.configure(codecConfig);
          } catch (err) {
            postError(id, `Failed to configure decoder: ${err}`);
            return;
          }
        }

        const chunk = new EncodedVideoChunk({
          type: 'key',
          timestamp: (sample.cts / sample.timescale) * 1_000_000,
          duration: (sample.duration / sample.timescale) * 1_000_000,
          data: sample.data,
        });
        videoDecoder.decode(chunk);
      }
    };

    mp4File.onError = (error: Error) => {
      postError(id, error.message);
    };

    const buffer = data as MP4ArrayBuffer;
    buffer.fileStart = 0;
    mp4File.appendBuffer(buffer);
    mp4File.flush();
  } catch (err) {
    postError(id, `Thumbnail extraction error: ${err}`);
  }
}

/**
 * Emit frames to main thread after converting to ImageBitmap
 * Frames are already in correct PTS order from the reorder buffer
 */
async function emitFrames(id: string, frames: BufferedFrame[]): Promise<void> {
  for (const { pts, frame } of frames) {
    try {
      const bitmap = await createImageBitmap(frame);
      const msg: DecodedFrameMessage = {
        type: 'frame',
        id,
        frame: bitmap,
        timestamp: pts / 1_000_000, // Convert microseconds to seconds
        duration: (frame.duration || 0) / 1_000_000,
      };
      self.postMessage(msg, { transfer: [bitmap] });
    } catch (err) {
      console.error('Failed to create ImageBitmap:', err);
    } finally {
      frame.close();
    }
  }
}

function postError(id: string, error: string): void {
  const msg: ErrorMessage = { type: 'error', id, error };
  self.postMessage(msg);
}
