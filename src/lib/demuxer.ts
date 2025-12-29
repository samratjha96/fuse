/**
 * Video demuxer using mp4box.js
 */

import * as MP4Box from 'mp4box';
import type { MP4File, MP4Info, MP4Sample, MP4ArrayBuffer, MP4Track } from 'mp4box';

export interface DemuxerCallbacks {
  onInfo: (info: VideoInfo) => void;
  onVideoSample: (sample: VideoSample) => void;
  onAudioSample: (sample: AudioSample) => void;
  onError: (error: Error) => void;
}

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
  videoTrackId: number;
  audioTrackId: number | null;
  frameRate: number;
  sampleRate: number | null;
  channels: number | null;
}

export interface VideoSample {
  data: ArrayBuffer;
  timestamp: number;
  duration: number;
  isKeyframe: boolean;
}

export interface AudioSample {
  data: ArrayBuffer;
  timestamp: number;
  duration: number;
}

export interface VideoDecoderConfig {
  codec: string;
  codedWidth: number;
  codedHeight: number;
  description?: Uint8Array;
}

export interface AudioDecoderConfig {
  codec: string;
  sampleRate: number;
  numberOfChannels: number;
  description?: Uint8Array;
}

/**
 * Demux a video file and extract samples
 */
export class Demuxer {
  private mp4File: MP4File;
  private callbacks: DemuxerCallbacks;
  private _info: MP4Info | null = null;
  private videoTrack: MP4Track | null = null;
  private audioTrack: MP4Track | null = null;
  private offset = 0;

  constructor(callbacks: DemuxerCallbacks) {
    this.callbacks = callbacks;
    this.mp4File = MP4Box.createFile();
    this.setupCallbacks();
  }

  private setupCallbacks(): void {
    this.mp4File.onReady = (fileInfo: MP4Info) => {
      this._info = fileInfo;
      
      // Find video track
      this.videoTrack = fileInfo.videoTracks[0] || null;
      this.audioTrack = fileInfo.audioTracks[0] || null;

      if (!this.videoTrack) {
        this.callbacks.onError(new Error('No video track found'));
        return;
      }

      const videoInfo: VideoInfo = {
        duration: fileInfo.duration / fileInfo.timescale,
        width: this.videoTrack.video?.width || this.videoTrack.track_width,
        height: this.videoTrack.video?.height || this.videoTrack.track_height,
        videoCodec: this.videoTrack.codec,
        audioCodec: this.audioTrack?.codec || null,
        videoTrackId: this.videoTrack.id,
        audioTrackId: this.audioTrack?.id || null,
        frameRate: this.videoTrack.nb_samples / (this.videoTrack.duration / this.videoTrack.timescale),
        sampleRate: this.audioTrack?.audio?.sample_rate || null,
        channels: this.audioTrack?.audio?.channel_count || null,
      };

      this.callbacks.onInfo(videoInfo);

      // Set up extraction
      this.mp4File.setExtractionOptions(this.videoTrack.id, 'video', {
        nbSamples: 100,
      });

      if (this.audioTrack) {
        this.mp4File.setExtractionOptions(this.audioTrack.id, 'audio', {
          nbSamples: 100,
        });
      }

      this.mp4File.start();
    };

    this.mp4File.onSamples = (trackId: number, _user: unknown, samples: MP4Sample[]) => {
      for (const sample of samples) {
        const timestamp = sample.cts / sample.timescale;
        const duration = sample.duration / sample.timescale;

        if (this.videoTrack && trackId === this.videoTrack.id) {
          this.callbacks.onVideoSample({
            data: sample.data,
            timestamp,
            duration,
            isKeyframe: sample.is_sync,
          });
        } else if (this.audioTrack && trackId === this.audioTrack.id) {
          this.callbacks.onAudioSample({
            data: sample.data,
            timestamp,
            duration,
          });
        }
      }
    };

    this.mp4File.onError = (error: Error) => {
      this.callbacks.onError(error);
    };
  }

  /**
   * Append data chunk to the demuxer
   */
  appendData(data: ArrayBuffer): void {
    const buffer = data as MP4ArrayBuffer;
    buffer.fileStart = this.offset;
    this.offset += data.byteLength;
    this.mp4File.appendBuffer(buffer);
  }

  /**
   * Signal end of file
   */
  flush(): void {
    this.mp4File.flush();
  }

  /**
   * Seek to a specific time
   */
  seek(timeInSeconds: number): { offset: number; time: number } {
    return this.mp4File.seek(timeInSeconds, true);
  }

  /**
   * Stop demuxing
   */
  stop(): void {
    this.mp4File.stop();
  }

  /**
   * Get the parsed file info
   */
  getInfo(): MP4Info | null {
    return this._info;
  }

  /**
   * Get video decoder configuration
   */
  getVideoDecoderConfig(): VideoDecoderConfig | null {
    if (!this.videoTrack) return null;

    const track = this.mp4File.getTrackById(this.videoTrack.id);
    if (!track) return null;

    return {
      codec: this.videoTrack.codec,
      codedWidth: this.videoTrack.video?.width || this.videoTrack.track_width,
      codedHeight: this.videoTrack.video?.height || this.videoTrack.track_height,
    };
  }

  /**
   * Get audio decoder configuration
   */
  getAudioDecoderConfig(): AudioDecoderConfig | null {
    if (!this.audioTrack) return null;

    return {
      codec: this.audioTrack.codec,
      sampleRate: this.audioTrack.audio?.sample_rate || 48000,
      numberOfChannels: this.audioTrack.audio?.channel_count || 2,
    };
  }
}

/**
 * Demux a complete file
 */
export async function demuxFile(
  file: File,
  callbacks: DemuxerCallbacks
): Promise<void> {
  const demuxer = new Demuxer(callbacks);
  
  const reader = file.stream().getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      demuxer.appendData(value.buffer);
    }
    demuxer.flush();
  } catch (error) {
    callbacks.onError(error as Error);
  }
}

