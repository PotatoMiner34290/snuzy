// Transkun mel frontend, ported from Yujia-Yan/Transkun (MIT):
// makeFrame framing + per-batch gain normalization (processFramesBatch),
// Hann + learned-Gaussian analysis windows and log-mel filterbank
// (MelSpectrum/Spectrum in transkun/Util.py).
//
// Constants mirror the transkun-onnx params.json:
// fs 44100, window 4096, hop 1024, 229 mels (30–8000 Hz), eps 1e-5.

import { rfftOrthoPower } from './fft';

export const TK_FS = 44100;
export const TK_WIN = 4096;
export const TK_HOP = 1024;
export const TK_MELS = 229;
export const TK_EPS = 1e-5;
export const TK_FRAME_DUR = TK_HOP / TK_FS;

export function frameCount(nSample: number): number {
  return Math.ceil(nSample / TK_HOP) + 1;
}

// Framing with left half-frame zero padding (makeFrame, leftPaddingHalfFrame).
// Output is flat row-major [nFrame * TK_WIN].
export function makeFrames(x: ArrayLike<number>): { frames: Float64Array; nFrame: number } {
  const n = x.length;
  const nFrame = frameCount(n);
  const lPad = TK_WIN / 2;
  const total = (nFrame - 1) * TK_HOP + TK_WIN;
  const buf = new Float64Array(total);
  for (let i = 0; i < n; i++) buf[lPad + i] = x[i];
  const frames = new Float64Array(nFrame * TK_WIN);
  for (let t = 0; t < nFrame; t++) {
    frames.set(buf.subarray(t * TK_HOP, t * TK_HOP + TK_WIN), t * TK_WIN);
  }
  return { frames, nFrame };
}

// Per-signal gain normalization: (x - mean) / (std + 1e-8), population std.
export function gainNormalize(frames: Float64Array): void {
  const n = frames.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += frames[i];
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    const d = frames[i] - mean;
    variance += d * d;
  }
  const inv = 1 / (Math.sqrt(variance / n) + 1e-8);
  for (let i = 0; i < n; i++) frames[i] = (frames[i] - mean) * inv;
}

// Periodic Hann (torch.hann_window default).
export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

export interface SparseMelBank {
  start: Int32Array; // per mel: offset into bins/weights
  count: Int32Array; // per mel: number of nonzero taps
  bins: Int32Array;
  weights: Float64Array;
}

// The mel filterbank is triangular: densify once into per-mel tap lists so
// the 2049x229 matmul becomes a short sparse dot product (~100x faster).
export function sparsifyBank(dense: Float32Array | Float64Array, nBins: number, nMels: number): SparseMelBank {
  const start = new Int32Array(nMels);
  const count = new Int32Array(nMels);
  const bins: number[] = [];
  const weights: number[] = [];
  for (let j = 0; j < nMels; j++) {
    start[j] = bins.length;
    for (let i = 0; i < nBins; i++) {
      const w = dense[i * nMels + j];
      if (w !== 0) {
        bins.push(i);
        weights.push(w);
      }
    }
    count[j] = bins.length - start[j];
  }
  return { start, count, bins: Int32Array.from(bins), weights: Float64Array.from(weights) };
}

// Log-mel frontend. windows: [hann(4096), gauss rows...] — pass row 0 as
// `hann` and rows 1..5 packed as `gauss`. Output row-major [nFrame, 229, 6].
export function melFrontend(
  frames: ArrayLike<number>,
  nFrame: number,
  hann: Float64Array,
  gauss: Float64Array,
  bank: SparseMelBank,
  eps = TK_EPS,
): Float32Array {
  const out = new Float32Array(nFrame * TK_MELS * 6);
  const re = new Float64Array(TK_WIN);
  const im = new Float64Array(TK_WIN);
  const power = new Float64Array(TK_WIN / 2 + 1);
  const frame = new Float64Array(TK_WIN);
  const logEps = Math.log(eps);
  const invNegLogEps = 1 / -logEps;
  for (let t = 0; t < nFrame; t++) {
    const base = t * TK_WIN;
    for (let k = 0; k < 6; k++) {
      for (let i = 0; i < TK_WIN; i++) {
        frame[i] = frames[base + i] * (k === 0 ? hann[i] : gauss[(k - 1) * TK_WIN + i]);
      }
      rfftOrthoPower(frame, power, re, im);
      for (let j = 0; j < TK_MELS; j++) {
        let m = 0;
        const s = bank.start[j];
        const c = bank.count[j];
        for (let z = 0; z < c; z++) m += power[bank.bins[s + z]] * bank.weights[s + z];
        out[(t * TK_MELS + j) * 6 + k] = (Math.log(m + eps) - logEps) * invNegLogEps;
      }
    }
  }
  return out;
}
