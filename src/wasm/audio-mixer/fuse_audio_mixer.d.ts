/* tslint:disable */
/* eslint-disable */

export class AudioMixer {
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Apply gain to a single buffer (utility function)
   */
  static apply_gain(samples: Float32Array, gain: number): Float32Array;
  /**
   * Mix all tracks and return interleaved stereo output
   */
  mix(duration_samples: number): Float32Array;
  constructor(sample_rate: number, channels: number);
  /**
   * Clear all tracks
   */
  clear(): void;
  /**
   * Add a track to the mixer
   */
  add_track(track: AudioTrack): void;
  /**
   * Crossfade between two buffers
   */
  static crossfade(buffer_a: Float32Array, buffer_b: Float32Array, fade_samples: number): Float32Array;
}

export class AudioTrack {
  free(): void;
  [Symbol.dispose](): void;
  constructor(samples: Float32Array, gain: number, pan: number, start_sample: number);
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_audiomixer_free: (a: number, b: number) => void;
  readonly __wbg_audiotrack_free: (a: number, b: number) => void;
  readonly audiomixer_add_track: (a: number, b: number) => void;
  readonly audiomixer_apply_gain: (a: any, b: number) => any;
  readonly audiomixer_clear: (a: number) => void;
  readonly audiomixer_crossfade: (a: any, b: any, c: number) => any;
  readonly audiomixer_mix: (a: number, b: number) => any;
  readonly audiomixer_new: (a: number, b: number) => number;
  readonly audiotrack_new: (a: any, b: number, c: number, d: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
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
