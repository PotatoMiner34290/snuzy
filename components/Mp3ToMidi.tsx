'use client';

import React, { useRef, useState } from 'react';
import { Midi } from '@tonejs/midi';

interface Props {
  bpm: number;
  onImport: (midi: Midi, fileName: string) => void;
  onExit: () => void;
}

interface DetectedNote {
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
}

// Downsampled mono for analysis (4x cheaper, still fine for pitch).
const DS = 4;
const WIN = 1024;
const HOP = 512;

function rms(buf: Float32Array, start: number, len: number): number {
  let sum = 0;
  const end = Math.min(buf.length, start + len);
  for (let i = start; i < end; i += 2) sum += buf[i] * buf[i];
  const n = Math.max(1, Math.floor((end - start) / 2));
  return Math.sqrt(sum / n);
}

function detectFreq(buf: Float32Array, sr: number, start: number, len: number): number {
  const minLag = Math.max(2, Math.floor(sr / 1200));
  const maxLag = Math.min(len - 2, Math.ceil(sr / 50));
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < len; i += 4) sum += buf[start + i] * buf[start + i + lag];
    if (sum > bestCorr) {
      bestCorr = sum;
      bestLag = lag;
    }
  }
  if (bestLag <= 0) return 0;
  return sr / bestLag;
}

const freqToMidi = (f: number) => 69 + 12 * Math.log2(f / 440);

interface RawNote {
  pitch: number;
  startSec: number;
  endSec: number;
  velocity: number;
}

// Find the recording's own tempo + downbeat phase by grid-fitting note
// onsets: without this, transcription quantized at the project's tempo
// drifts further off-grid every bar.
function fitTempo(raw: RawNote[]): { bpm: number; shift: number } {
  if (raw.length === 0) return { bpm: 120, shift: 0 };
  const times = raw.map(r => r.startSec).sort((a, b) => a - b);
  let bestBpm = 120;
  let bestPhase = 0;
  let bestErr = Infinity;
  for (let bpm = 50; bpm <= 200; bpm += 1) {
    const beat = 60 / bpm;
    const grid = beat / 4;
    const bias = bpm < 80 || bpm > 170 ? 1.15 : 1; // prefer sane tempos
    // 16 phase steps (quarter-grid): coarser steps cannot represent an
    // arbitrary downbeat offset and make every tempo score the same.
    for (let o = 0; o < 16; o++) {
      const phase = (o / 16) * beat;
      let err = 0;
      let n = 0;
      for (let i = 0; i < times.length; i++) {
        const rel = (times[i] - phase) / grid;
        const d = Math.abs(rel - Math.round(rel));
        err += d * d;
        n = i + 1;
        // Prune on the RUNNING mean: comparing a partial sum against the
        // full-length best under-scores pruned tempos and picks garbage.
        if ((err / n) * bias > bestErr) break;
      }
      const mean = (err / n) * bias;
      if (mean < bestErr) {
        bestErr = mean;
        bestBpm = bpm;
        bestPhase = phase;
      }
    }
  }
  const beat = 60 / bestBpm;
  // Pull whole beats so the first note lands inside bar one.
  const k = Math.floor((Math.min(...times) - bestPhase) / beat);
  return { bpm: bestBpm, shift: bestPhase + k * beat };
}

function quantizeRaw(raw: RawNote[], bpm: number, shift: number): DetectedNote[] {
  const stepDur = 60 / Math.max(20, bpm) / 4;
  const found: DetectedNote[] = [];
  raw.forEach(r => {
    const s = (r.startSec - shift) / stepDur;
    const e = (r.endSec - shift) / stepDur;
    if (e < 0.25 || found.length >= 8000) return;
    found.push({
      pitch: Math.max(21, Math.min(108, Math.round(r.pitch))),
      start: Math.max(0, Math.floor(s)),
      duration: Math.max(1, Math.round(e - Math.max(0, s))),
      velocity: Math.max(1, Math.min(127, Math.round(r.velocity > 1.5 ? r.velocity : r.velocity * 127))),
    });
  });
  const byKey = new Map<string, DetectedNote>();
  found.forEach(n => {
    const k = `${n.start}:${n.pitch}`;
    const prev = byKey.get(k);
    if (!prev || prev.velocity < n.velocity) byKey.set(k, n);
  });
  return [...byKey.values()].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}

export default function Mp3ToMidi({ bpm, onImport, onExit }: Props) {
  const [fileName, setFileName] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'decoding' | 'analyzing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [sensitivity, setSensitivity] = useState(8);
  const [notes, setNotes] = useState<DetectedNote[]>([]);
  const [error, setError] = useState('');
  const monoRef = useRef<{ data: Float32Array; sr: number } | null>(null);
  const decodedRef = useRef<AudioBuffer | null>(null);
  const rawRef = useRef<RawNote[]>([]);
  const [detectedBpm, setDetectedBpm] = useState(bpm);
  const analysingRef = useRef(false);
  const magentaRef = useRef<{ model: unknown } | null>(null);
  const magentaLoadingRef = useRef<Promise<void> | null>(null);
  const [aiPhase, setAiPhase] = useState<'idle' | 'loading' | 'ready' | 'working' | 'done' | 'error'>('idle');
  const [aiMsg, setAiMsg] = useState('');

  // Public piano-transcription stack (Magenta Onsets & Frames, trained on
  // piano) loaded lazily from CDN — nothing added to the app bundle.
  const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js';
  const MAGENTA_URL = 'https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/es6/transcription.js';
  const PIANO_CKPT = 'https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni_q2';

  const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

  const ensurePianoAi = async () => {
    if (magentaRef.current) return;
    if (!magentaLoadingRef.current) {
      magentaLoadingRef.current = (async () => {
        setAiPhase('loading');
        setAiMsg('Downloading AI engine (~2MB, one time)…');
        await loadScript(TF_URL);
        await loadScript(MAGENTA_URL);
        const g = window as unknown as Record<string, { OnsetsAndFrames: new (url: string) => {
          initialize: () => Promise<void>;
          isInitialized: () => boolean;
          transcribeFromAudioBuffer: (buf: AudioBuffer) => Promise<{ notes?: { pitch: number; startTime: number; endTime: number; velocity: number }[] }>;
        } } | undefined>;
        const ns = g.transcription || g.onsets_frames || g.mm;
        if (!ns?.OnsetsAndFrames) throw new Error('Piano AI library failed to initialise.');
        setAiMsg('Downloading piano model (~30MB, one time)…');
        const model = new ns.OnsetsAndFrames(PIANO_CKPT);
        await model.initialize();
        magentaRef.current = { model };
        setAiPhase('ready');
        setAiMsg('');
      })().catch((err: unknown) => {
        magentaLoadingRef.current = null;
        throw err;
      });
    }
    await magentaLoadingRef.current;
  };

  const to16kMono = async (decoded: AudioBuffer): Promise<AudioBuffer> => {
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * 16000)), 16000);
    const mono = off.createBuffer(1, decoded.length, decoded.sampleRate);
    const d = mono.getChannelData(0);
    const ch0 = decoded.getChannelData(0);
    const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null;
    for (let i = 0; i < decoded.length; i++) d[i] = ch1 ? (ch0[i] + ch1[i]) / 2 : ch0[i];
    const src = off.createBufferSource();
    src.buffer = mono;
    src.connect(off.destination);
    src.start();
    return off.startRendering();
  };

  const sliceBuffer = (buf: AudioBuffer, startSec: number, lenSec: number): AudioBuffer => {
    const sr = buf.sampleRate;
    const start = Math.max(0, Math.floor(startSec * sr));
    const len = Math.max(1, Math.min(Math.floor(lenSec * sr), buf.length - start));
    const out = new OfflineAudioContext(1, len, sr).createBuffer(1, len, sr);
    out.getChannelData(0).set(buf.getChannelData(0).subarray(start, start + len));
    return out;
  };

  const transcribePianoAi = async () => {
    const decoded = decodedRef.current;
    if (!decoded || aiPhase === 'working' || aiPhase === 'loading') return;
    setError('');
    try {
      await ensurePianoAi();
    } catch (err: unknown) {
      setAiPhase('error');
      setAiMsg(err instanceof Error ? err.message : 'Could not load the piano AI.');
      return;
    }
    const holder = magentaRef.current as unknown as { model: {
      transcribeFromAudioBuffer: (buf: AudioBuffer) => Promise<{ notes?: { pitch: number; startTime: number; endTime: number; velocity: number }[] }>;
    } } | null;
    if (!holder) {
      setAiPhase('error');
      setAiMsg('Piano AI library failed to initialise.');
      return;
    }
    setAiPhase('working');
    try {
      setAiMsg('Converting to piano format…');
      setProgress(2);
      const buf16 = await to16kMono(decoded);
      // 60s chunks with 2s overlap (memory safety on long pieces).
      const CHUNK = 60;
      const OVERLAP = 2;
      const chunks: { buf: AudioBuffer; start: number }[] = [];
      for (let s = 0; s < buf16.duration; s += CHUNK - OVERLAP) {
        chunks.push({ buf: sliceBuffer(buf16, s, CHUNK), start: s });
      }
      const raw: RawNote[] = [];
      let cutoff = 0;
      for (let c = 0; c < chunks.length; c++) {
        const { buf, start } = chunks[c];
        setAiMsg(`Hearing piano… chunk ${c + 1}/${chunks.length}`);
        const seq = await holder.model.transcribeFromAudioBuffer(buf);
        (seq.notes || []).forEach(n => {
          const t0 = start + n.startTime;
          if (t0 < cutoff) return;
          const vel = n.velocity > 1.5 ? n.velocity : n.velocity * 127;
          raw.push({
            pitch: Math.max(21, Math.min(108, Math.round(n.pitch))),
            startSec: t0,
            endSec: start + n.endTime,
            velocity: Math.max(1, Math.min(127, Math.round(vel))),
          });
        });
        cutoff = start + CHUNK;
        setProgress(Math.round(((c + 1) / chunks.length) * 100));
        await new Promise(res => setTimeout(res, 0));
      }
      rawRef.current = raw;
      const fit = fitTempo(raw);
      setDetectedBpm(fit.bpm);
      const merged = quantizeRaw(raw, fit.bpm, fit.shift);
      setNotes(merged);
      setProgress(100);
      setPhase('done');
      setAiPhase('done');
      setAiMsg(merged.length ? '' : 'The AI heard no piano notes — is this a piano recording?');
    } catch (err: unknown) {
      setAiPhase('error');
      setAiMsg(err instanceof Error ? err.message : 'Transcription failed.');
    }
  };

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setPhase('decoding');
    setError('');
    setNotes([]);
    setProgress(0);
    try {
      const raw = await f.arrayBuffer();
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const decoded = await ctx.decodeAudioData(raw);
      try { ctx.close(); } catch {}
      decodedRef.current = decoded;
      rawRef.current = [];
      setDetectedBpm(bpm);
      setAiPhase('idle');
      setAiMsg('');
      const ch0 = decoded.getChannelData(0);
      const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null;
      const mono = new Float32Array(Math.ceil(ch0.length / DS));
      for (let i = 0; i < mono.length; i++) {
        const a = ch0[i * DS] || 0;
        mono[i] = ch1 ? (a + (ch1[i * DS] || 0)) / 2 : a;
      }
      monoRef.current = { data: mono, sr: decoded.sampleRate / DS };
      setDurationSec(decoded.duration);
      setFileName(f.name);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(f));
      await analyse(mono, decoded.sampleRate / DS, sensitivity);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not decode that audio file.');
      setPhase('error');
    }
  };

  const analyse = async (mono: Float32Array, sr: number, gate100: number) => {
    if (analysingRef.current) return;
    analysingRef.current = true;
    setPhase('analyzing');
    try {
      const gate = gate100 / 1000; // slider 1..20 -> RMS 0.001..0.02
      const windows = Math.floor((mono.length - WIN) / HOP);
      const voiced: { midi: number; rms: number }[] = new Array(windows);
      for (let w = 0; w < windows; w++) {
        const start = w * HOP;
        const r = rms(mono, start, WIN);
        if (r < gate) {
          voiced[w] = { midi: 0, rms: r };
        } else {
          const f = detectFreq(mono, sr, start, WIN);
          voiced[w] = { midi: f > 0 ? freqToMidi(f) : 0, rms: r };
        }
        if (w % 400 === 0) {
          setProgress(Math.round((w / Math.max(1, windows)) * 100));
          await new Promise(res => setTimeout(res, 0));
        }
      }
      // Median-smooth the pitch track to kill jitter.
      const smooth = voiced.map((v, i) => {
        if (!v.midi) return 0;
        const near = [voiced[i - 1]?.midi || 0, v.midi, voiced[i + 1]?.midi || 0].filter(Boolean).sort((a, b) => a - b);
        return near.length ? near[Math.floor(near.length / 2)] : 0;
      });
      // Segment into notes (times kept in seconds; tempo fit later).
      type Raw = { pitch: number; startW: number; endW: number; peak: number };
      const raws: Raw[] = [];
      let cur: Raw | null = null;
      smooth.forEach((m, w) => {
        const pitch = m ? Math.max(21, Math.min(108, Math.round(m))) : 0;
        if (!pitch) {
          if (cur) { raws.push(cur); cur = null; }
          return;
        }
        if (!cur) {
          cur = { pitch, startW: w, endW: w, peak: voiced[w].rms };
        } else if (pitch === cur.pitch) {
          cur.endW = w;
          cur.peak = Math.max(cur.peak, voiced[w].rms);
        } else {
          raws.push(cur);
          cur = { pitch, startW: w, endW: w, peak: voiced[w].rms };
        }
      });
      if (cur) raws.push(cur);
      const raw: RawNote[] = [];
      raws.forEach(r => {
        if (r.endW - r.startW + 1 < 2) return;
        raw.push({
          pitch: r.pitch,
          startSec: (r.startW * HOP) / sr,
          endSec: ((r.endW + 1) * HOP) / sr,
          velocity: Math.max(30, Math.min(120, Math.round(30 + Math.min(1, r.peak * 4) * 90))),
        });
      });
      rawRef.current = raw;
      const fit = fitTempo(raw);
      setDetectedBpm(fit.bpm);
      setNotes(quantizeRaw(raw, fit.bpm, fit.shift));
      setProgress(100);
      setPhase('done');
    } finally {
      analysingRef.current = false;
    }
  };

  const reAnalyse = () => {
    const m = monoRef.current;
    if (m) analyse(m.data, m.sr, sensitivity);
  };

  const doImport = () => {
    const raw = rawRef.current;
    if (raw.length === 0) return;
    try {
      // Re-quantize from raw times at the detected tempo so import matches
      // the summary, then hand the project its new tempo via the header.
      const fit = fitTempo(raw);
      const useBpm = fit.bpm;
      const final = quantizeRaw(raw, useBpm, fit.shift);
      if (final.length === 0) return;
      const midi = new Midi();
      midi.header.tempos = [{ bpm: useBpm, ticks: 0 }];
      const track = midi.addTrack();
      track.name = fileName.replace(/\.[^.]+$/, '') || 'MP3 melody';
      track.channel = 0;
      track.instrument.number = 0;
      const ppq = midi.header.ppq || 480;
      const t16 = ppq / 4;
      final.forEach(n => {
        track.addNote({
          midi: n.pitch,
          ticks: n.start * t16,
          durationTicks: Math.max(1, n.duration * t16),
          velocity: n.velocity / 127,
        });
      });
      onImport(midi, `${track.name} (from MP3 @${useBpm} BPM)`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const lo = notes.length ? Math.min(...notes.map(n => n.pitch)) : 0;
  const hi = notes.length ? Math.max(...notes.map(n => n.pitch)) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#0b0e14f2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 520, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', background: '#141926', border: '1px solid #3b475d', borderRadius: 14, padding: 22, color: '#dbe2e9' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#00e5ff' }}>MP3 → MIDI</div>
        <div style={{ fontSize: 12, color: '#90a4ae', marginTop: 4, lineHeight: 1.5 }}>
          Two engines: <strong style={{ color: '#cfd8dc' }}>Fast detect</strong> grabs the lead melody instantly (voice, hum, riff).
          For <strong style={{ color: '#cfd8dc' }}>piano recordings</strong>, use the Piano AI below — real polyphonic transcription, chords and all.
        </div>

        <label
          style={{ display: 'block', marginTop: 16, padding: '12px 16px', borderRadius: 8, border: '1px dashed #465268', background: '#161c29', color: '#00e5ff', cursor: 'pointer', fontSize: 13, fontWeight: 700, textAlign: 'center' }}
        >
          {fileName || 'Choose an MP3 / WAV / OGG file…'}
          <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" onChange={e => pickFile(e.target.files?.[0] ?? undefined)} style={{ display: 'none' }} />
        </label>

        {audioUrl && (
          <audio controls src={audioUrl} style={{ width: '100%', marginTop: 12 }} />
        )}

        {(phase === 'decoding' || phase === 'analyzing') && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: '#90a4ae' }}>{phase === 'decoding' ? 'Decoding audio…' : `Detecting melody… ${progress}%`}</div>
            <div style={{ height: 8, borderRadius: 999, background: '#1b2230', border: '1px solid #2c3547', marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: phase === 'decoding' ? '12%' : `${progress}%`, borderRadius: 999, background: 'linear-gradient(90deg, #00e5ff, #00e676)', transition: 'width 0.15s' }} />
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: '#b0bec5', lineHeight: 1.6 }}>
            <div><strong style={{ color: '#00e676' }}>{notes.length}</strong> notes detected{durationSec ? ` from ${Math.round(durationSec)}s of audio` : ''}{lo ? ` · range MIDI ${lo}–${hi}` : ''}</div>
            <div style={{ fontSize: 12, color: '#f9a825', marginTop: 2 }}>Tempo ~{detectedBpm} BPM detected — the project takes this tempo on import</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: '#90a4ae' }}>
              Sensitivity
              <input type="range" min={2} max={20} value={sensitivity} onChange={e => setSensitivity(Number(e.target.value))} style={{ flex: 1, accentColor: '#00e5ff' }} />
              <button onClick={reAnalyse} style={{ padding: '5px 12px', borderRadius: 5, border: '1px solid #3b475d', background: '#252e40', color: '#00e5ff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Re-detect</button>
            </label>
            <div style={{ fontSize: 11, color: '#607d8b' }}>Lower catches quieter notes (more noise), higher keeps only strong ones.</div>
            <button
              onClick={transcribePianoAi}
              disabled={!decodedRef.current || aiPhase === 'working' || aiPhase === 'loading'}
              title="Magenta piano AI: full polyphonic transcription, best on piano recordings (downloads ~30MB model once, takes a while)"
              style={{ width: '100%', marginTop: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid #651fff', background: '#1c1440', color: '#c4b5fd', cursor: decodedRef.current ? 'pointer' : 'default', fontSize: 13, fontWeight: 800, opacity: !decodedRef.current || aiPhase === 'working' || aiPhase === 'loading' ? 0.55 : 1 }}
            >
              {aiPhase === 'working' ? 'Hearing piano…' : aiPhase === 'done' ? '↻ Re-run piano AI' : 'Piano AI transcribe (chords + all notes)'}
            </button>
            {(aiPhase === 'loading' || aiPhase === 'working') && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: '#90a4ae' }}>{aiMsg || `Working… ${progress}%`}</div>
                <div style={{ height: 8, borderRadius: 999, background: '#1b2230', border: '1px solid #2c3547', marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: aiPhase === 'loading' ? '18%' : `${progress}%`, borderRadius: 999, background: 'linear-gradient(90deg, #651fff, #c4b5fd)', transition: 'width 0.2s' }} />
                </div>
              </div>
            )}
            {(aiPhase === 'done' || aiPhase === 'error') && aiMsg && (
              <div style={{ marginTop: 8, fontSize: 12, color: aiPhase === 'error' ? '#ff8a80' : '#90a4ae' }}>{aiMsg}</div>
            )}
          </div>
        )}

        {error && <div style={{ marginTop: 12, fontSize: 12, color: '#ff8a80' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            onClick={onExit}
            style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #3b475d', background: '#222a3b', color: '#dbe2e9', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
          >
            ← Back
          </button>
          <button
            onClick={doImport}
            disabled={phase !== 'done' || notes.length === 0}
            title="Build endless blocks from these notes and return to the studio"
            style={{ flex: 1, padding: '10px 18px', borderRadius: 8, border: 'none', background: notes.length ? '#00e676' : '#2a3144', color: notes.length ? '#000' : '#546e7a', cursor: notes.length ? 'pointer' : 'default', fontSize: 13, fontWeight: 800 }}
          >
            Import to project →
          </button>
        </div>
      </div>
    </div>
  );
}
