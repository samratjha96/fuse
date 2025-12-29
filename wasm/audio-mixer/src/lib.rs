use wasm_bindgen::prelude::*;
use js_sys::Float32Array;

/// Audio track for mixing
#[wasm_bindgen]
pub struct AudioTrack {
    samples: Vec<f32>,
    gain: f32,
    pan: f32, // -1.0 (left) to 1.0 (right)
    start_sample: usize,
}

#[wasm_bindgen]
impl AudioTrack {
    #[wasm_bindgen(constructor)]
    pub fn new(samples: &Float32Array, gain: f32, pan: f32, start_sample: usize) -> Self {
        Self {
            samples: samples.to_vec(),
            gain,
            pan,
            start_sample,
        }
    }
}

/// Audio Mixer for combining multiple audio tracks
#[wasm_bindgen]
pub struct AudioMixer {
    tracks: Vec<AudioTrack>,
    sample_rate: u32,
    channels: u32,
}

#[wasm_bindgen]
impl AudioMixer {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: u32, channels: u32) -> Self {
        Self {
            tracks: Vec::new(),
            sample_rate,
            channels,
        }
    }

    /// Add a track to the mixer
    #[wasm_bindgen]
    pub fn add_track(&mut self, track: AudioTrack) {
        self.tracks.push(track);
    }

    /// Clear all tracks
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.tracks.clear();
    }

    /// Mix all tracks and return interleaved stereo output
    #[wasm_bindgen]
    pub fn mix(&self, duration_samples: usize) -> Float32Array {
        let output_len = duration_samples * self.channels as usize;
        let mut output = vec![0.0f32; output_len];

        for track in &self.tracks {
            let track_start = track.start_sample * self.channels as usize;
            
            for (i, &sample) in track.samples.iter().enumerate() {
                let output_idx = track_start + i;
                if output_idx >= output_len {
                    break;
                }

                // Apply gain
                let gained_sample = sample * track.gain;

                if self.channels == 2 {
                    // Stereo panning
                    let left_gain = ((1.0 - track.pan) / 2.0).sqrt();
                    let right_gain = ((1.0 + track.pan) / 2.0).sqrt();
                    
                    let stereo_idx = (track.start_sample + i / 2) * 2;
                    if stereo_idx + 1 < output_len {
                        if i % 2 == 0 {
                            output[stereo_idx] += gained_sample * left_gain;
                        } else {
                            output[stereo_idx + 1] += gained_sample * right_gain;
                        }
                    }
                } else {
                    output[output_idx] += gained_sample;
                }
            }
        }

        // Normalize to prevent clipping
        let max_sample = output.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
        if max_sample > 1.0 {
            for sample in &mut output {
                *sample /= max_sample;
            }
        }

        Float32Array::from(&output[..])
    }

    /// Apply gain to a single buffer (utility function)
    #[wasm_bindgen]
    pub fn apply_gain(samples: &Float32Array, gain: f32) -> Float32Array {
        let input = samples.to_vec();
        let output: Vec<f32> = input.iter().map(|s| s * gain).collect();
        Float32Array::from(&output[..])
    }

    /// Crossfade between two buffers
    #[wasm_bindgen]
    pub fn crossfade(
        buffer_a: &Float32Array,
        buffer_b: &Float32Array,
        fade_samples: usize,
    ) -> Float32Array {
        let a = buffer_a.to_vec();
        let b = buffer_b.to_vec();
        let total_len = a.len() + b.len() - fade_samples;
        let mut output = vec![0.0f32; total_len];

        // Copy first buffer
        for (i, &sample) in a.iter().enumerate() {
            if i < a.len() - fade_samples {
                output[i] = sample;
            } else {
                // Fade out region
                let fade_pos = i - (a.len() - fade_samples);
                let fade_factor = 1.0 - (fade_pos as f32 / fade_samples as f32);
                output[i] = sample * fade_factor;
            }
        }

        // Mix in second buffer with fade in
        for (i, &sample) in b.iter().enumerate() {
            let output_idx = a.len() - fade_samples + i;
            if i < fade_samples {
                // Fade in region
                let fade_factor = i as f32 / fade_samples as f32;
                output[output_idx] += sample * fade_factor;
            } else if output_idx < output.len() {
                output[output_idx] = sample;
            }
        }

        Float32Array::from(&output[..])
    }
}

