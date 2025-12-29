/* tslint:disable */
/* eslint-disable */

export class Muxer {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Add encoded audio chunk
   */
  add_audio_chunk(data: Uint8Array, _timestamp: number): void;
  /**
   * Add encoded video chunk
   */
  add_video_chunk(data: Uint8Array, _timestamp: number, _is_key: boolean): void;
  /**
   * Configure audio track parameters
   */
  configure_audio(sample_rate: number, channels: number, codec: string): void;
  /**
   * Configure video track parameters
   */
  configure_video(width: number, height: number, codec: string): void;
  constructor();
  /**
   * Reset muxer state for reuse
   */
  reset(): void;
  /**
   * Finalize and return the muxed MP4 data
   */
  finalize(): Uint8Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_muxer_free: (a: number, b: number) => void;
  readonly muxer_add_audio_chunk: (a: number, b: any, c: number) => void;
  readonly muxer_add_video_chunk: (a: number, b: any, c: number, d: number) => void;
  readonly muxer_configure_audio: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly muxer_configure_video: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly muxer_finalize: (a: number) => any;
  readonly muxer_new: () => number;
  readonly muxer_reset: (a: number) => void;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
