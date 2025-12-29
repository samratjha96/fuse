/**
 * Type definitions for mp4box.js
 */

declare module 'mp4box' {
  export interface MP4Track {
    id: number;
    type: 'video' | 'audio';
    codec: string;
    language: string;
    created: Date;
    modified: Date;
    movie_duration: number;
    movie_timescale: number;
    duration: number;
    timescale: number;
    track_width: number;
    track_height: number;
    nb_samples: number;
    // Video specific
    video?: {
      width: number;
      height: number;
    };
    // Audio specific
    audio?: {
      sample_rate: number;
      channel_count: number;
      sample_size: number;
    };
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    isFragmented: boolean;
    isProgressive: boolean;
    hasIOD: boolean;
    brands: string[];
    created: Date;
    modified: Date;
    tracks: MP4Track[];
    videoTracks: MP4Track[];
    audioTracks: MP4Track[];
  }

  export interface MP4Sample {
    number: number;
    track_id: number;
    description_index: number;
    description: {
      avcC?: ArrayBuffer;
      hvcC?: ArrayBuffer;
      esds?: ArrayBuffer;
    };
    data: ArrayBuffer;
    size: number;
    duration: number;
    cts: number;
    dts: number;
    is_sync: boolean;
    degradation_priority: number;
    offset: number;
    timescale: number;
  }

  export interface MP4ArrayBuffer extends ArrayBuffer {
    fileStart: number;
  }

  export interface MP4File {
    onReady: (info: MP4Info) => void;
    onError: (error: Error) => void;
    onSamples: (trackId: number, user: unknown, samples: MP4Sample[]) => void;
    
    appendBuffer: (buffer: MP4ArrayBuffer) => number;
    start: () => void;
    stop: () => void;
    flush: () => void;
    seek: (time: number, useRap?: boolean) => { offset: number; time: number };
    
    setExtractionOptions: (
      trackId: number,
      user?: unknown,
      options?: { nbSamples?: number; rapAlignment?: boolean }
    ) => void;
    
    getTrackById: (trackId: number) => MP4Track | undefined;
    getInfo: () => MP4Info;
    
    releaseUsedSamples: (trackId: number, sampleNumber: number) => void;
  }

  export function createFile(): MP4File;
  
  export class DataStream {
    static BIG_ENDIAN: boolean;
    static LITTLE_ENDIAN: boolean;
    
    constructor(
      arrayBuffer?: ArrayBuffer,
      byteOffset?: number,
      endianness?: boolean
    );
    
    getPosition(): number;
    setPosition(pos: number): void;
    readUint8(): number;
    readUint16(): number;
    readUint32(): number;
    readString(length: number): string;
  }
}

