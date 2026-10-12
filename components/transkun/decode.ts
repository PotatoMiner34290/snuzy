// Note assembly, segment stitching and overlap resolution, ported from
// TransKun.transcribeFrames / TransKun.transcribe in
// Yujia-Yan/Transkun transkun/ModelTransformer.py (MIT) and
// resolveOverlapping in transkun/Data.py (MIT).
//
// Pitch symbols: track 0 = sustain pedal (-64), track 1 = soft pedal (-67),
// tracks 2..89 = MIDI 21..108.

import { viterbiBackward } from './viterbi';
import { makeFrames } from './frontend';

export const TK_SYMBOLS: number[] = [-64, -67, ...Array.from({ length: 88 }, (_, i) => 21 + i)];
export const TK_N_SYMBOLS = 90;
export const TK_SEGMENT_SEC = 16;
export const TK_HOP_SEC = 8;

export interface TkNote {
  pitch: number;
  start: number;
  end: number;
  velocity: number;
  hasOnset: boolean;
  hasOffset: boolean;
}

// Mean of torch.distributions.ContinuousBernoulli(logits). Closed form:
// lam/(2*lam-1) + 1/(2*atanh(1-2*lam)), 0.5 at lam == 0.5.
export function continuousBernoulliMean(logit: number): number {
  const lam = 1 / (1 + Math.exp(-logit));
  if (Math.abs(lam - 0.5) < 1e-6) return 0.5;
  return lam / (2 * lam - 1) + 1 / (2 * Math.atanh(1 - 2 * lam));
}

// Assemble notes for one segment from Viterbi paths + attribute heads.
// velLogits/ofRaw are flat over all path intervals in track order
// (track 0 intervals, then track 1, …), matching the gather order.
export function assembleSegmentNotes(
  trackPaths: Array<Array<[number, number]>>,
  symbols: ArrayLike<number>,
  velLogits: Float32Array,
  ofRaw: Float32Array,
  frameDur: number,
  lastFrameIdx: number,
): { notes: TkNote[]; lastP: number[] } {
  const notes: TkNote[] = [];
  const lastP: number[] = [];
  let n = 0;
  for (let j = 0; j < trackPaths.length; j++) {
    const eventType = symbols[j];
    let lastEnd = 0;
    let curLastP = 0;
    for (let k = 0; k < trackPaths[j].length; k++) {
      const [b, e] = trackPaths[j][k];
      let vel = 0;
      for (let v = 1; v < 128; v++) {
        if (velLogits[n * 128 + v] > velLogits[n * 128 + vel]) vel = v;
      }
      const off0 = Math.max(-0.5, Math.min(0.5, (continuousBernoulliMean(ofRaw[n * 4 + 0]) - 0.5) / 0.99));
      const off1 = Math.max(-0.5, Math.min(0.5, (continuousBernoulliMean(ofRaw[n * 4 + 1]) - 0.5) / 0.99));
      const pres0 = ofRaw[n * 4 + 2] > 0;
      const pres1 = ofRaw[n * 4 + 3] > 0;
      const start = Math.max((b + off0) * frameDur, lastEnd);
      const end = Math.max((e + off1) * frameDur, start + 1e-8);
      lastEnd = end;
      const hasOnset = b > 0 || pres0;
      const hasOffset = e < lastFrameIdx || pres1;
      notes.push({ pitch: eventType, start, end, velocity: vel, hasOnset, hasOffset });
      if (hasOffset) curLastP = e;
      n++;
    }
    lastP.push(curLastP);
  }
  notes.sort((a, b) => a.start - b.start || a.end - b.end || a.pitch - b.pitch);
  return { notes, lastP };
}

// resolveOverlapping from Data.py: per pitch, clip a note's end to the next
// note's start; drop degenerate notes; re-sort.
export function resolveOverlapping(notes: TkNote[]): TkNote[] {
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.end - b.end || a.pitch - b.pitch);
  const out: TkNote[] = [];
  const lastIdxByPitch = new Map<number, number>();
  for (const n of sorted) {
    const prev = lastIdxByPitch.get(n.pitch);
    if (prev !== undefined && out[prev].end > n.start) out[prev].end = n.start;
    lastIdxByPitch.set(n.pitch, out.length);
    out.push({ ...n });
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end || a.pitch - b.pitch);
  return out.filter(n => n.start < n.end);
}

export interface SegmentModel {
  // Features [T, 229, 6] → interval scores S[T,T,90] + backbone ctx[90,T,256].
  inferSegment(features: Float32Array, T: number): Promise<{ S: Float32Array; ctx: Float32Array }>;
  // Attribute rows [N,768] → velocity logits [N,128] + onset/offset raw [N,4].
  runHeads(attr: Float32Array, n: number): Promise<{ velLogits: Float32Array; ofRaw: Float32Array }>;
}

export interface Transcription {
  notes: TkNote[]; // pitch > 0 only
  pedal: Array<{ start: number; end: number }>; // sustain track (-64)
}

// Full transcribe() loop: 8s-padded signal, 16s segments every 8s,
// forced-start carry between segments, incomplete-event merging.
export async function transcribeSegments(
  samples: Float32Array,
  fs: number,
  featurize: (frames: Float64Array, T: number) => Float32Array,
  model: SegmentModel,
  symbols: ArrayLike<number>,
  onProgress?: (done: number, total: number) => void,
): Promise<Transcription> {
  const SEG = TK_SEGMENT_SEC;
  const HOP = TK_HOP_SEC;
  const HOP_SAMPLES = 1024;
  const pad = Math.ceil(HOP * fs);
  const stepSamples = Math.ceil((HOP * fs) / HOP_SAMPLES) * HOP_SAMPLES;
  const segmentSamples = Math.ceil(SEG * fs);
  const frameDur = HOP_SAMPLES / fs;
  const lastFrameIdx = Math.round(segmentSamples / HOP_SAMPLES);
  const stepFrames = Math.round(stepSamples / HOP_SAMPLES);

  const nSample = samples.length;
  const padded = new Float32Array(nSample + pad * 2);
  padded.set(samples, pad);

  const nPadded = padded.length;
  const startFrameIdx = Math.floor((HOP * fs) / HOP_SAMPLES);
  const startPos = new Int32Array(TK_N_SYMBOLS).fill(startFrameIdx);
  const eventsByType = new Map<number, TkNote[]>();

  for (let i = 0; i < nPadded; i += stepSamples) {
    const j = Math.min(i + segmentSamples, nPadded);
    const slice = new Float32Array(segmentSamples);
    slice.set(padded.subarray(i, j));
    const { frames, nFrame } = makeFrames(slice);
    const T = nFrame;
    const features = featurize(frames, T);
    const { S, ctx } = await model.inferSegment(features, T);
    const path = viterbiBackward(S, T, TK_N_SYMBOLS, startPos);

    // Gather [ctx_a, ctx_b, ctx_a*ctx_b] per interval, track order.
    let total = 0;
    for (let k = 0; k < TK_N_SYMBOLS; k++) total += path[k].length;
    const attr = new Float32Array(total * 768);
    let r = 0;
    for (let k = 0; k < TK_N_SYMBOLS; k++) {
      for (const [b, e] of path[k]) {
        const bc = Math.max(0, Math.min(T - 1, b));
        const ec = Math.max(0, Math.min(T - 1, e));
        for (let d = 0; d < 256; d++) {
          const a = ctx[(k * T + bc) * 256 + d];
          const c = ctx[(k * T + ec) * 256 + d];
          attr[(r * 768) + d] = a;
          attr[(r * 768) + 256 + d] = c;
          attr[(r * 768) + 512 + d] = a * c;
        }
        r++;
      }
    }
    const { velLogits, ofRaw } = await model.runHeads(attr, total);
    const { notes: curNotes, lastP } = assembleSegmentNotes(path, symbols, velLogits, ofRaw, frameDur, lastFrameIdx);

    const beginTime = i / fs - HOP;
    for (const e of curNotes) {
      e.start += beginTime;
      e.end += beginTime;
      e.start = Math.max(e.start, 0);
      e.end = Math.max(e.end, e.start);
    }

    for (const e of curNotes) {
      const list = eventsByType.get(e.pitch);
      if (list && list.length > 0) {
        const last = list[list.length - 1];
        if (e.start < last.end) {
          if (e.hasOnset) list[list.length - 1] = e;
          else {
            last.hasOffset = e.hasOffset;
            last.end = Math.max(e.end, last.end);
          }
          continue;
        }
      }
      if (e.hasOnset) {
        const target = list ?? [];
        target.push(e);
        eventsByType.set(e.pitch, target);
      }
    }

    for (let k = 0; k < TK_N_SYMBOLS; k++) {
      startPos[k] = Math.max(lastP[k] - stepFrames, 0);
    }
    onProgress?.(Math.min(i + stepSamples, nPadded), nPadded);
    await new Promise(res => setTimeout(res, 0));
  }

  for (const list of eventsByType.values()) {
    if (list.length > 0) list[list.length - 1].hasOffset = true;
  }
  let events: TkNote[] = [];
  for (const list of eventsByType.values()) events = events.concat(list);
  events = events.filter(e => e.hasOffset);
  events = resolveOverlapping(events);

  const notes = events.filter(e => e.pitch > 0);
  const pedal = events
    .filter(e => e.pitch === -64)
    .map(e => ({ start: e.start, end: e.end }));
  return { notes, pedal };
}
