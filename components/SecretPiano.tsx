'use client';

import React, { memo, useMemo, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { TrackDef } from './SequencerWorkstation';
import type { InstrumentClip } from './ArrangementView';

export interface SustainRegion {
  down: number;
  up: number;
}

interface Props {
  tracks: TrackDef[];
  clips: InstrumentClip[];
  sustain: Record<string, SustainRegion[]>;
  stepCount: number;
  bpm: number;
  isPlaying: boolean;
  stepRef: React.MutableRefObject<number>;
  onTogglePlay: () => void;
  onExit: () => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const isBlack = (pitch: number) => NOTE_NAMES[pitch % 12].includes('#');
// Fall speed follows the tempo: ~2.2s of fall at 105 BPM, stretching at
// slow tempos and tightening at fast ones (square-root so extremes stay
// sane — pure proportional would float for 6s at 40 or blink past at 300).
const FALL_MS_AT_105 = 2200;

interface FlatNote {
  key: string;
  pitch: number;
  absStep: number;
  color: string;
  trackName: string;
  trackId: string;
}

const lowerBound = (arr: FlatNote[], v: number) => {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m].absStep < v) lo = m + 1;
    else hi = m;
  }
  return lo;
};

// Falling notes re-render every frame, but only over the visible window
// (binary-searched out of the pre-sorted song, not re-scanned).
// Notes and keys share center-based geometry so every block lands dead
// center on its key.
const NoteHighway = memo(function NoteHighway({ notes, pos, geom, nowStep, ahead }: {
  notes: FlatNote[];
  pos: number;
  geom: Record<number, { centerPct: number; widthPct: number; black: boolean }>;
  nowStep: number;
  ahead: number;
}) {
  const from = Math.floor(pos - 1);
  const start = lowerBound(notes, from);
  const out = [];
  for (let i = start; i < notes.length; i++) {
    const n = notes[i];
    if (n.absStep > pos + ahead) break;
    const g = geom[n.pitch];
    if (!g) continue;
    const yPct = Math.max(0, Math.min(1, 1 - (n.absStep - pos) / ahead)) * 100;
    const hitting = n.absStep === nowStep;
    // Dissolve into the key: shrink + fade across the last 1.5 steps so the
    // block literally melts into the tangent instead of landing on it.
    const closeness = Math.max(0, Math.min(1, 1 - (n.absStep - pos) / 1.5));
    const opacity = hitting ? 0.95 : Math.max(0.3, 0.85 - 0.55 * closeness);
    const ty = -100 + 30 * closeness;
    const scale = (1 - 0.3 * closeness).toFixed(3);
    out.push(
      <div
        key={n.key}
        style={{
          position: 'absolute',
          left: `${g.centerPct}%`,
          width: `${g.widthPct}%`,
          top: `${yPct}%`,
          height: 14,
          transform: `translateX(-50%) translateY(${ty}%) scale(${scale})`,
          borderRadius: 3,
          background: n.color,
          opacity,
          boxShadow: hitting ? `0 0 12px ${n.color}` : 'none',
        }}
      />
    );
  }
  return <>{out}</>;
});

// Keys only change on step boundaries (~7/sec), not every animation frame.
// Sustained pitches (damper down, note started but not yet released) keep a
// softer glow so held harmony stays visible.
const PianoKeys = memo(function PianoKeys({ geom, whites, notes, nowStep, sustain }: {
  geom: Record<number, { centerPct: number; widthPct: number; black: boolean }>;
  whites: number[];
  notes: FlatNote[];
  nowStep: number;
  sustain: Record<string, SustainRegion[]>;
}) {
  const active: Record<number, string> = {};
  const held: Record<number, string> = {};
  const start = lowerBound(notes, nowStep);
  for (let i = start; i < notes.length && notes[i].absStep === nowStep; i++) {
    if (active[notes[i].pitch] === undefined) active[notes[i].pitch] = notes[i].color;
  }
  Object.entries(sustain).forEach(([trackId, regs]) => {
    regs.forEach(r => {
      if (!(nowStep >= r.down && nowStep < r.up)) return;
      const s0 = lowerBound(notes, r.down);
      for (let i = s0; i < notes.length && notes[i].absStep <= nowStep; i++) {
        const n = notes[i];
        if (n.trackId !== trackId) continue;
        if (active[n.pitch] === undefined && held[n.pitch] === undefined) held[n.pitch] = n.color;
      }
    });
  });
  return (
    <div style={{ position: 'relative', height: 148, background: '#05070b', borderTop: '1px solid #242b3c', display: 'flex', userSelect: 'none' }}>
      {whites.map(p => {
        const glow = active[p];
        const hold = !glow ? held[p] : undefined;
        return (
          <div
            key={p}
            style={{
              flex: 1, borderRight: '1px solid #2a3348', borderRadius: '0 0 4px 4px',
              background: glow || hold || '#e8edf2',
              boxShadow: glow ? `inset 0 -8px 16px #0006, 0 0 18px ${glow}` : hold ? `inset 0 0 0 3px ${hold}` : 'inset 0 -6px 10px #0002',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              color: '#607d8b', fontSize: 9, paddingBottom: 6,
            }}
          >
            {NOTE_NAMES[p % 12]}{Math.floor(p / 12) - 1}
          </div>
        );
      })}
      {Object.keys(geom).map(k => {
        const p = Number(k);
          const g = geom[p];
          if (!g.black) return null;
          const glow = active[p];
          const hold = !glow ? held[p] : undefined;
          return (
            <div
              key={p}
              style={{
                position: 'absolute', top: 0, height: '58%',
                left: `${g.centerPct}%`, width: `${g.widthPct}%`, transform: 'translateX(-50%)',
                background: glow || hold || '#141a26', borderRadius: '0 0 4px 4px',
                border: '1px solid #000', boxShadow: glow ? `0 0 16px ${glow}` : hold ? `inset 0 0 0 2px ${hold}` : 'none',
                zIndex: 2,
              }}
            />
          );
      })}
    </div>
  );
});

const SYNC_KEY = 'snuzy_piano_sync_ms';

export default function SecretPiano({ tracks, clips, sustain, stepCount, bpm, isPlaying, stepRef, onTogglePlay, onExit }: Props) {
  const [pos, setPos] = useState(() => stepRef.current);
  const lastRef = useRef({ step: stepRef.current, t: 0 });
  const anchorRef = useRef({ ok: false, sec: 0, step: 0, lastFix: 0 });
  // Visual-audio offset in ms, calibrated by ear: set BPM 40, tap −/+ until
  // the flash lands exactly on the tone. Milliseconds are tempo-independent,
  // so one calibration holds from 40 to 300. Saved automatically.
  const [syncMs, setSyncMs] = useState(() => {
    try {
      const v = Number(localStorage.getItem(SYNC_KEY));
      if (Number.isFinite(v)) return Math.max(-50, Math.min(250, v));
    } catch {}
    return 100;
  });
  React.useEffect(() => {
    try { localStorage.setItem(SYNC_KEY, String(syncMs)); } catch {}
  }, [syncMs]);

  // Smooth wall-clock interpolation (15ms ahead of the audible hits),
  // plus a slow audio-clock trim: at most every 2s the wall clock is
  // nudged ≤30ms toward Tone.Transport.seconds, so drift can never
  // accumulate yet motion never stutters from per-frame tugging.
  React.useEffect(() => {
    let raf = 0;
    const stepDurMs = 60000 / Math.max(20, bpm) / 4;
    const stepDurSec = stepDurMs / 1000;
    const compSteps = syncMs / stepDurMs;
    const loop = () => {
      const s = stepRef.current;
      const now = performance.now();
      const last = lastRef.current;
      if (s !== last.step) {
        last.step = s;
        last.t = now;
      }
      let frac = isPlaying ? Math.min(0.999, (now - last.t) / stepDurMs) : 0;
      if (isPlaying) {
        try {
          const a = anchorRef.current;
          const nowSec = Tone.Transport.seconds;
          if (!a.ok) {
            a.ok = true;
            a.sec = nowSec;
            a.step = s;
            a.lastFix = now;
          }
          const audioPos = a.step + (nowSec - a.sec) / stepDurSec;
          if (Math.abs(s - audioPos) > 1.5) {
            // Seek/loop jump or stale anchor: hard resync.
            a.sec = nowSec;
            a.step = s;
            a.lastFix = now;
            last.t = now;
            last.step = s;
            frac = 0;
          } else if (now - a.lastFix > 2000) {
            a.lastFix = now;
            const errMs = (audioPos - (s + frac)) * stepDurMs;
            if (Math.abs(errMs) > 75) {
              last.t -= Math.max(-30, Math.min(30, errMs * 0.25));
              frac = Math.min(0.999, Math.max(0, (now - last.t) / stepDurMs));
            }
          }
        } catch {}
      } else {
        anchorRef.current.ok = false;
      }
      setPos(Math.max(0, s + frac - (isPlaying ? compSteps : 0)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bpm, isPlaying, stepRef, syncMs]);

  const colorOf = useMemo(() => {
    const color: Record<string, string> = {};
    tracks.forEach(t => { color[t.id] = t.color; });
    return color;
  }, [tracks]);

  // One flat time-sorted array per song edit — frames binary-search it.
  const notes = useMemo(() => {
    const out: FlatNote[] = [];
    clips.forEach(c => {
      c.notes.forEach(n => {
        out.push({
          key: `${c.id}:${n.id}`,
          pitch: n.pitch,
          absStep: c.start + n.start,
          color: colorOf[c.trackId] || '#00e5ff',
          trackName: '',
          trackId: c.trackId,
        });
      });
    });
    out.sort((a, b) => a.absStep - b.absStep || a.pitch - b.pitch);
    return out;
  }, [clips, colorOf]);

  const { lo, hi } = useMemo(() => {
    let lo = 127;
    let hi = 0;
    for (const n of notes) {
      if (n.pitch < lo) lo = n.pitch;
      if (n.pitch > hi) hi = n.pitch;
    }
    if (hi < lo) { lo = 48; hi = 72; }
    return { lo: Math.max(0, lo - 2), hi: Math.min(127, hi + 2) };
  }, [notes]);

  const geom = useMemo(() => {
    const pitches: number[] = [];
    for (let p = lo; p <= hi; p++) pitches.push(p);
    const whites = pitches.filter(p => !isBlack(p));
    const whiteIdx: Record<number, number> = {};
    whites.forEach((p, i) => { whiteIdx[p] = i; });
    const total = Math.max(1, whites.length);
    let whitesSoFar = 0;
    const map: Record<number, { centerPct: number; widthPct: number; black: boolean }> = {};
    pitches.forEach(p => {
      const w = 100 / total;
      if (isBlack(p)) {
        map[p] = { centerPct: whitesSoFar * w, widthPct: w * 0.62, black: true };
      } else {
        map[p] = { centerPct: (whiteIdx[p] + 0.5) * w, widthPct: w * 0.82, black: false };
        whitesSoFar++;
      }
    });
    return { map, whites };
  }, [lo, hi]);

  const nowStep = Math.floor(pos);
  const stepDurMs = 60000 / Math.max(20, bpm) / 4;
  const ahead = Math.max(6, Math.round((FALL_MS_AT_105 * Math.sqrt(105 / Math.max(20, bpm))) / stepDurMs));
  const bar = Math.floor(nowStep / 16) + 1;
  const totalBars = Math.ceil(stepCount / 16);
  const pedalDown = Object.values(sustain).some(regs => regs.some(r => nowStep >= r.down && nowStep < r.up));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#0b0e14', display: 'flex', flexDirection: 'column', color: '#dbe2e9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #242b3c', background: '#11151f' }}>
        <button
          onClick={onExit}
          style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #3b475d', background: '#252e40', color: '#00e5ff', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}
        >
          ← Back to studio
        </button>
        <button
          onClick={onTogglePlay}
          className="btn-playback"
          style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: isPlaying ? '#ffd600' : '#00e676', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}
        >
          {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
        </button>
        <span style={{ color: '#78909c', fontSize: 12 }}>Bar {Math.min(bar, totalBars)} / {totalBars} · {tracks.length} instruments</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#78909c' }} title="Calibrate at 40 BPM: flash lands AFTER the tone? press +. BEFORE it? press −. Saved, works at every tempo.">
          SYNC
          <button onClick={() => setSyncMs(v => Math.max(-50, v - 10))} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #3b475d', background: '#252e40', color: '#00e5ff', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>−</button>
          <span style={{ minWidth: 52, textAlign: 'center', color: '#cfd8dc', fontWeight: 700 }}>{syncMs}ms</span>
          <button onClick={() => setSyncMs(v => Math.min(250, v + 10))} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #3b475d', background: '#252e40', color: '#00e5ff', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>+</button>
        </span>
        <span
          title="Damper pedal (from the MIDI file)"
          style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 1,
            color: pedalDown ? '#00e676' : '#3b475d',
            border: `1px solid ${pedalDown ? '#00e676' : '#3b475d'}`,
            borderRadius: 4, padding: '3px 8px',
            boxShadow: pedalDown ? '0 0 10px #00e67688' : 'none',
          }}
        >
          {pedalDown ? 'SUSTAIN ●' : 'SUSTAIN ○'}
        </span>
      </div>

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', background: 'linear-gradient(180deg, #0b0e14 0%, #101623 100%)' }}>
        <NoteHighway notes={notes} pos={pos} geom={geom.map} nowStep={nowStep} ahead={ahead} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: '#00e5ff88', boxShadow: '0 0 10px #00e5ff' }} />
      </div>

      <PianoKeys geom={geom.map} whites={geom.whites} notes={notes} nowStep={nowStep} sustain={sustain} />
    </div>
  );
}
