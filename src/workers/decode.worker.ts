/**
 * Video/Audio Decode Worker
 * Handles demuxing and decoding video files using mp4box.js and WebCodecs
 */

import type { MP4ArrayBuffer, MP4File, MP4Info, MP4Sample, MP4Track } from 'mp4box';
import * as MP4Box from 'mp4box';

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

// State for active decode sessions
const decodeSessions = new Map<
  string,
  {
    mp4File: MP4File;
    videoDecoder: VideoDecoder | null;
    audioDecoder: AudioDecoder | null;
    videoTrack: MP4Track | null;
    audioTrack: MP4Track | null;
    offset: number;
    pendingFrames: Map<number, VideoFrame>;
  }
>();

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

    const session = {
      mp4File,
      videoDecoder: null as VideoDecoder | null,
      audioDecoder: null as AudioDecoder | null,
      videoTrack: null as MP4Track | null,
      audioTrack: null as MP4Track | null,
      offset: 0,
      pendingFrames: new Map<number, VideoFrame>(),
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

      // Send video info
      const videoInfo: VideoInfoMessage = {
        type: 'info',
        id,
        info: {
          duration: info.duration / info.timescale,
          width: videoTrack.video?.width || videoTrack.track_width,
          height: videoTrack.video?.height || videoTrack.track_height,
          frameRate: videoTrack.nb_samples / (videoTrack.duration / videoTrack.timescale),
          videoCodec: videoTrack.codec,
          audioCodec: audioTrack?.codec || null,
        },
      };
      self.postMessage(videoInfo);

      // Create video decoder
      videoDecoder = new VideoDecoder({
        output: async (frame: VideoFrame) => {
          try {
            const bitmap = await createImageBitmap(frame);
            const msg: DecodedFrameMessage = {
              type: 'frame',
              id,
              frame: bitmap,
              timestamp: (frame.timestamp || 0) / 1_000_000, // Convert to seconds
              duration: (frame.duration || 0) / 1_000_000,
            };
            self.postMessage(msg, { transfer: [bitmap] });
          } finally {
            frame.close();
          }
        },
        error: (err: Error) => postError(id, err.message),
      });

      session.videoDecoder = videoDecoder;

      // Configure decoder based on codec
      const codecConfig: VideoDecoderConfig = {
        codec: videoTrack.codec,
        codedWidth: videoTrack.video?.width || videoTrack.track_width,
        codedHeight: videoTrack.video?.height || videoTrack.track_height,
      };

      try {
        videoDecoder.configure(codecConfig);
      } catch (err) {
        postError(id, `Failed to configure decoder: ${err}`);
        return;
      }

      // Set up extraction
      mp4File.setExtractionOptions(videoTrack.id, 'video', { nbSamples: 10 });
      mp4File.start();
    };

    mp4File.onSamples = (trackId: number, _user: unknown, samples: MP4Sample[]) => {
      if (!videoDecoder || !videoTrack) return;
      if (trackId !== videoTrack.id) return;

      for (const sample of samples) {
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

  const { mp4File, videoDecoder } = session;

  if (videoDecoder) {
    // Reset decoder for seek
    await videoDecoder.flush();
  }

  // Seek in demuxer
  mp4File.seek(time, true);
}

function handleStop(id: string): void {
  const session = decodeSessions.get(id);
  if (!session) return;

  const { mp4File, videoDecoder, audioDecoder } = session;

  mp4File.stop();

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

      videoDecoder.configure({
        codec: videoTrack.codec,
        codedWidth: videoTrack.video?.width || videoTrack.track_width,
        codedHeight: videoTrack.video?.height || videoTrack.track_height,
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

function postError(id: string, error: string): void {
  const msg: ErrorMessage = { type: 'error', id, error };
  self.postMessage(msg);
}
