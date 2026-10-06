'use client';

import React, { memo, useMemo, useRef, useState } from 'react';
import type { TrackDef } from './SequencerWorkstation';
import type { InstrumentClip } from './ArrangementView';

interface Props {
  tracks: TrackDef[];
  clips: InstrumentClip[];
  stepCount: number;
  bpm: number;
  isPlaying: boolean;
  stepRef: React.MutableRefObject<number>;
  onTogglePlay: () => void;
  onExit: () => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const isBlack = (pitch: number) => NOTE_NAMES[pitch % 12].includes('#');
// How many steps of song are visible falling above the keys.
const AHEAD = 32;

interface FlatNote {
  key: string;
  pitch: number;
  absStep: number;
  color: string;
  trackName: string;
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
const NoteHighway = memo(function NoteHighway({ notes, pos, geom, nowStep }: {
  notes: FlatNote[];
  pos: number;
  geom: Record<number, { leftPct: number; widthPct: number; black: boolean }>;
  nowStep: number;
}) {
  const from = Math.floor(pos - 1);
  const start = lowerBound(notes, from);
  const out = [];
  for (let i = start; i < notes.length; i++) {
    const n = notes[i];
    if (n.absStep > pos + AHEAD) break;
    const g = geom[n.pitch];
    if (!g) continue;
    const yPct = Math.max(0, Math.min(1, 1 - (n.absStep - pos) / AHEAD)) * 100;
    const hitting = n.absStep === nowStep;
    out.push(
      <div
        key={n.key}
        style={{
          position: 'absolute',
          left: `${g.leftPct}%`,
          width: `${g.widthPct}%`,
          top: `${yPct}%`,
          height: 14,
          transform: 'translateY(-100%)',
          borderRadius: 3,
          background: n.color,
          opacity: hitting ? 1 : 0.85,
          boxShadow: hitting ? `0 0 12px ${n.color}` : 'none',
        }}
      />
    );
  }
  return <>{out}</>;
});

// Keys only change on step boundaries (~7/sec), not every animation frame.
const PianoKeys = memo(function PianoKeys({ geom, whites, notes, nowStep }: {
  geom: Record<number, { leftPct: number; widthPct: number; black: boolean }>;
  whites: number[];
  notes: FlatNote[];
  nowStep: number;
}) {
  const active: Record<number, string> = {};
  const start = lowerBound(notes, nowStep);
  for (let i = start; i < notes.length && notes[i].absStep === nowStep; i++) {
    if (active[notes[i].pitch] === undefined) active[notes[i].pitch] = notes[i].color;
  }
  return (
    <div style={{ position: 'relative', height: 148, background: '#05070b', borderTop: '1px solid #242b3c', display: 'flex', userSelect: 'none' }}>
      {whites.map(p => {
        const glow = active[p];
        return (
          <div
            key={p}
            style={{
              flex: 1, borderRight: '1px solid #2a3348', borderRadius: '0 0 4px 4px',
              background: glow || '#e8edf2',
              boxShadow: glow ? `inset 0 -8px 16px #0006, 0 0 18px ${glow}` : 'inset 0 -6px 10px #0002',
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
        return (
          <div
            key={p}
            style={{
              position: 'absolute', top: 0, height: '58%',
              left: `${g.leftPct}%`, width: `${g.widthPct}%`, transform: 'translateX(-50%)',
              background: glow || '#141a26', borderRadius: '0 0 4px 4px',
              border: '1px solid #000', boxShadow: glow ? `0 0 16px ${glow}` : 'none',
              zIndex: 2,
            }}
          />
        );
      })}
    </div>
  );
});

export default function SecretPiano({ tracks, clips, stepCount, bpm, isPlaying, stepRef, onTogglePlay, onExit }: Props) {
  const [pos, setPos] = useState(() => stepRef.current);
  const lastRef = useRef({ step: stepRef.current, t: 0 });

  // Smooth playhead: interpolate between steps from wall-clock time.
  React.useEffect(() => {
    let raf = 0;
    const stepDurMs = 60000 / Math.max(20, bpm) / 4;
    const loop = () => {
      const s = stepRef.current;
      const now = performance.now();
      const last = lastRef.current;
      if (s !== last.step) {
        last.step = s;
        last.t = now;
      }
      const frac = isPlaying ? Math.min(0.999, (now - last.t) / stepDurMs) : 0;
      setPos(s + frac);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bpm, isPlaying, stepRef]);

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
    const map: Record<number, { leftPct: number; widthPct: number; black: boolean }> = {};
    pitches.forEach(p => {
      const w = 100 / total;
      if (isBlack(p)) {
        map[p] = { leftPct: whitesSoFar * w, widthPct: w * 0.62, black: true };
      } else {
        map[p] = { leftPct: whiteIdx[p] * w + w * 0.09, widthPct: w * 0.82, black: false };
        whitesSoFar++;
      }
    });
    return { map, whites };
  }, [lo, hi]);

  const nowStep = Math.floor(pos);
  const bar = Math.floor(nowStep / 16) + 1;
  const totalBars = Math.ceil(stepCount / 16);

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
      </div>

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', background: 'linear-gradient(180deg, #0b0e14 0%, #101623 100%)' }}>
        <NoteHighway notes={notes} pos={pos} geom={geom.map} nowStep={nowStep} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: '#00e5ff88', boxShadow: '0 0 10px #00e5ff' }} />
      </div>

      <PianoKeys geom={geom.map} whites={geom.whites} notes={notes} nowStep={nowStep} />
    </div>
  );
}
