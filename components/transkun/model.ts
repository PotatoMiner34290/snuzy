// OnnxRuntime loader + Transkun ONNX inference (browser only).
//
// Model + decode spec: TuesdayCrowd/transkun-onnx (MIT) — an export of
// Yujia-Yan/Transkun (MIT). Weights stay on Hugging Face and download once
// (~56 MB, then browser HTTP cache); inference runs locally via WASM.

import { hannWindow, melFrontend, sparsifyBank, TK_EPS, type SparseMelBank } from './frontend';
import { transcribeSegments, type TkNote } from './decode';

declare const ort: any;

const ORT_VERSION = '1.22.0';
const ORT_URL = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.all.min.js`;
const ORT_WASM_PATH = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const TK_BASE = 'https://huggingface.co/TuesdayCrowd/transkun-onnx/resolve/main/';

export interface TranskunBuffers {
  freq2mels: Float32Array; // [2049, 229]
  windows: Float32Array; // [6, 4096], row 0 = Hann
  symbols: Int32Array; // [90]
}

export interface TranskunModel {
  // Log-mel features [T, 229, 6] → interval scores S[T,T,90] + ctx[90,T,256].
  inferSegment(features: Float32Array, T: number): Promise<{ S: Float32Array; ctx: Float32Array }>;
  // Attribute rows [N,768] → velocity logits [N,128] + onset/offset raw [N,4].
  runHeads(attr: Float32Array, n: number): Promise<{ velLogits: Float32Array; ofRaw: Float32Array }>;
  buffers: TranskunBuffers;
}

export interface TranskunResult {
  notes: TkNote[]; // piano pitches 21..108, seconds, velocity 0..127
  pedal: Array<{ start: number; end: number }>; // sustain-pedal intervals, seconds
}

// Full transcription: 16s segments every 8s through the session.
export async function transcribeAudio(
  model: TranskunModel,
  mono44k: Float32Array,
  onProgress?: (pct: number, msg: string) => void,
): Promise<TranskunResult> {
  const hann = hannWindow(4096);
  const gauss = new Float64Array(5 * 4096);
  for (let k = 0; k < 5; k++) {
    for (let i = 0; i < 4096; i++) gauss[k * 4096 + i] = model.buffers.windows[(k + 1) * 4096 + i];
  }
  const bank: SparseMelBank = sparsifyBank(Float64Array.from(model.buffers.freq2mels), 2049, 229);
  const featurize = (frames: Float64Array, T: number) => melFrontend(frames, T, hann, gauss, bank, TK_EPS);
  const { notes, pedal } = await transcribeSegments(
    mono44k,
    44100,
    featurize,
    {
      inferSegment: (features, T) => model.inferSegment(features, T),
      runHeads: (attr, n) => model.runHeads(attr, n),
    },
    model.buffers.symbols,
    (done, total) => {
      try { onProgress?.(Math.round((done / total) * 100), 'Transcribing piano…'); } catch {}
    },
  );
  return { notes, pedal };
}

function loadScriptOnce(src: string): Promise<void> {
  const known = document.querySelector(`script[src="${src}"]`);
  if (known) {
    const done = known.getAttribute('data-loaded') === '1';
    if (done) return Promise.resolve();
    return new Promise((resolve, reject) => {
      known.addEventListener('load', () => resolve());
      known.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.setAttribute('data-loaded', '1');
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function fetchF32(url: string, count: number): Promise<Float32Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < count * 4) throw new Error(`Truncated download: ${url}`);
  const view = new DataView(buf);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

async function fetchI32(url: string, count: number): Promise<Int32Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength < count * 4) throw new Error(`Truncated download: ${url}`);
  const view = new DataView(buf);
  const out = new Int32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt32(i * 4, true);
  return out;
}

export async function loadTranskun(onProgress?: (pct: number, msg: string) => void): Promise<TranskunModel> {
  const say = (pct: number, msg: string) => {
    try { onProgress?.(pct, msg); } catch {}
  };
  say(2, 'Loading inference engine…');
  await loadScriptOnce(ORT_URL);
  if (typeof ort === 'undefined' || !ort?.InferenceSession) {
    throw new Error('Inference engine failed to initialise.');
  }
  try {
    ort.env.wasm.wasmPaths = ORT_WASM_PATH;
    ort.env.wasm.numThreads = 1;
  } catch {}
  say(6, 'Downloading piano model (~56 MB, one time)…');
  const session = await ort.InferenceSession.create(`${TK_BASE}transkun.onnx`, { executionProviders: ['wasm'] });
  say(70, 'Downloading attribute heads…');
  const heads = await ort.InferenceSession.create(`${TK_BASE}transkun-heads.onnx`, { executionProviders: ['wasm'] });
  say(78, 'Downloading mel tables…');
  const [freq2mels, windows, symbols] = await Promise.all([
    fetchF32(`${TK_BASE}freq2mels.f32`, 2049 * 229),
    fetchF32(`${TK_BASE}windows.f32`, 6 * 4096),
    fetchI32(`${TK_BASE}symbols.i32`, 90),
  ]);
  say(88, 'Warming up…');

  const inName: string = session.inputNames[0];
  const outNames: string[] = session.outputNames.slice();
  const headsIn: string = heads.inputNames[0];
  const headsOut: string[] = heads.outputNames.slice();

  const pick = (tensors: Record<string, any>, rows: number, cols: number, depth: number): Float32Array | null => {
    for (const name of outNames) {
      const t = tensors[name];
      if (!t) continue;
      const dims: number[] = Array.from(t.dims || []);
      if (dims.length === 3 && dims[0] === rows && dims[1] === cols && dims[2] === depth) {
        const data = t.data;
        return data instanceof Float32Array ? data : Float32Array.from(data as ArrayLike<number>);
      }
    }
    return null;
  };

  return {
    buffers: { freq2mels, windows, symbols },
    async inferSegment(features: Float32Array, T: number) {
      const input = new ort.Tensor('float32', features, [1, T, 229, 6]);
      const out = await session.run({ [inName]: input });
      const S = pick(out, T, T, 90);
      const ctx = pick(out, 90, T, 256);
      if (!S || !ctx) {
        throw new Error(`Unexpected model outputs: ${outNames.map(n => `${n}[${(out[n]?.dims || []).join('x')}]`).join(', ')}`);
      }
      return { S, ctx };
    },
    async runHeads(attr: Float32Array, n: number) {
      if (n === 0) return { velLogits: new Float32Array(0), ofRaw: new Float32Array(0) };
      const input = new ort.Tensor('float32', attr, [n, 768]);
      const out = await heads.run({ [headsIn]: input });
      let velLogits: Float32Array | null = null;
      let ofRaw: Float32Array | null = null;
      for (const name of headsOut) {
        const t = out[name];
        if (!t) continue;
        const dims: number[] = Array.from(t.dims || []);
        const data = t.data instanceof Float32Array ? t.data : Float32Array.from(t.data as ArrayLike<number>);
        if (dims.length === 2 && dims[0] === n && dims[1] === 128) velLogits = data;
        else if (dims.length === 2 && dims[0] === n && dims[1] === 4) ofRaw = data;
      }
      if (!velLogits || !ofRaw) {
        throw new Error(`Unexpected heads outputs: ${headsOut.map(nm => `${nm}[${(out[nm]?.dims || []).join('x')}]`).join(', ')}`);
      }
      return { velLogits, ofRaw };
    },
  };
}
