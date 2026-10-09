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
  // Live latch of continuous-mode pedals (mutated in playback, read per
  // frame — passed as a ref so the lamp never lags a render behind).
  armedRef?: React.MutableRefObject<Record<string, boolean>>;
  stepCount: number;
  bpm: number;
  isPlaying: boolean;
  stepRef: React.MutableRefObject<number>;
  onTogglePlay: () => void;
  onExit: () => void;
  onSeekStep?: (step: number) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const isBlack = (pitch: number) => NOTE_NAMES[pitch % 12].includes('#');
const pitchName = (pitch: number) => `${NOTE_NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;

// Horizontal piano-roll view (onlinesequencer style): the song stands
// still on a gridded background while the playhead line travels across it,
// paging forward every 64 steps. Notes sound exactly as the line touches
// their left edge.
const PAGE = 128;
const PX_PER_STEP = 14;
const ROW_H = 16;
const KEYS_W = 110;

const SYNC_KEY = 'snuzy_piano_sync_ms';

interface FlatNote {
  key: string;
  pitch: number;
  absStep: number;
  duration: number;
  color: string;
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

export default function SecretPiano({ tracks, clips, sustain, armedRef, stepCount, bpm, isPlaying, stepRef, onTogglePlay, onExit, onSeekStep }: Props) {
  const [pos, setPos] = useState(() => stepRef.current);
  const lastRef = useRef({ step: stepRef.current, t: 0 });
  const anchorRef = useRef({ ok: false, sec: 0, step: 0, lastFix: 0 });
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

  // Same clock as before: smooth wall interpolation with slow audio trim,
  // display compensated by the calibrated sync offset.
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

  const notes = useMemo(() => {
    const out: FlatNote[] = [];
    clips.forEach(c => {
      c.notes.forEach(n => {
        out.push({
          key: `${c.id}:${n.id}`,
          pitch: n.pitch,
          absStep: c.start + n.start,
          duration: Math.max(1, n.duration),
          color: colorOf[c.trackId] || '#00e5ff',
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
    return { lo: Math.max(0, lo - 1), hi: Math.min(127, hi + 1) };
  }, [notes]);

  const nowStep = Math.floor(pos);
  const bar = Math.floor(nowStep / 16) + 1;
  const totalBars = Math.ceil(stepCount / 16);
  // A region still holding at the song's end never lifts (endless sustain);
  // a gap anywhere drops the pedal there. A continuous-mode track stays lit
  // through the loop wrap — the region's own span sits behind the playhead.
  const armed = armedRef?.current;
  const pedalDown = (!!armed && Object.values(armed).some(Boolean))
    || Object.values(sustain).some(regs =>
      regs.some(r => nowStep >= r.down && (r.up < 0 || r.up >= stepCount || nowStep < r.up)));

  // Keys glow on onset + while sustained.
  const keyGlow = useMemo(() => {
    const glow: Record<number, { color: string; soft: boolean }> = {};
    const s0 = lowerBound(notes, nowStep);
    for (let i = s0; i < notes.length && notes[i].absStep === nowStep; i++) {
      if (glow[notes[i].pitch] === undefined) glow[notes[i].pitch] = { color: notes[i].color, soft: false };
    }
    Object.entries(sustain).forEach(([trackId, regs]) => {
      const latched = !!armed?.[trackId];
      regs.forEach(r => {
        const held = latched
          || (nowStep >= r.down && (r.up < 0 || r.up >= stepCount || nowStep < r.up));
        if (!held) return;
        const s1 = lowerBound(notes, latched ? 0 : r.down);
        for (let i = s1; i < notes.length && notes[i].absStep <= nowStep; i++) {
          const n = notes[i];
          if (n.trackId !== trackId || glow[n.pitch] !== undefined) continue;
          glow[n.pitch] = { color: n.color, soft: true };
        }
      });
    });
    return glow;
  }, [notes, nowStep, sustain, armed, stepCount]);

  const rows = hi - lo + 1;
  const maxPage = Math.max(0, Math.ceil(stepCount / PAGE) - 1);
  const page = Math.max(0, Math.min(maxPage, Math.floor(pos / PAGE)));
  const winStart = page * PAGE;
  const winEnd = winStart + PAGE;
  const winW = KEYS_W + PAGE * PX_PER_STEP;
  const playX = KEYS_W + (pos - winStart) * PX_PER_STEP;

  const startIdx = lowerBound(notes, winStart);
  const bars: React.ReactNode[] = [];
  for (let i = startIdx; i < notes.length; i++) {
    const n = notes[i];
    if (n.absStep >= winEnd) break;
    if (n.pitch < lo || n.pitch > hi) continue;
    const x = KEYS_W + (n.absStep - winStart) * PX_PER_STEP;
    const y = 24 + (hi - n.pitch) * ROW_H + 2;
    const w = Math.max(8, n.duration * PX_PER_STEP - 3);
    const sounding = pos >= n.absStep && pos < n.absStep + n.duration;
    bars.push(
      <div
        key={n.key}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: ROW_H - 4,
          borderRadius: 3,
          background: n.color,
          opacity: sounding ? 1 : 0.85,
          boxShadow: sounding ? `0 0 10px ${n.color}` : 'none',
        }}
      />
    );
  }

  const rulerBars = [];
  for (let b = 0; b < PAGE / 16; b++) {
    const barNo = Math.floor(winStart / 16) + b + 1;
    const atStep = winStart + b * 16;
    if (atStep >= stepCount) break;
    rulerBars.push(
      <button
        key={b}
        onClick={() => onSeekStep?.(atStep)}
        title={onSeekStep ? `Play from bar ${barNo}` : undefined}
        style={{
          position: 'absolute',
          left: KEYS_W + b * 16 * PX_PER_STEP,
          top: 0,
          border: 'none',
          background: 'transparent',
          color: '#738096',
          fontSize: 9,
          fontWeight: 800,
          cursor: onSeekStep ? 'pointer' : 'default',
          padding: '5px 4px',
        }}
      >
        BAR {barNo}
      </button>
    );
  }

  const keyRows = [];
  for (let p = hi; p >= lo; p--) {
    const black = isBlack(p);
    const g = keyGlow[p];
    keyRows.push(
      <div
        key={p}
        title={pitchName(p)}
        style={{
          height: ROW_H,
          display: 'flex',
          alignItems: 'center',
          background: g ? g.color : black ? '#141a26' : '#e8edf2',
          borderBottom: '1px solid #2a3348',
          borderRight: '1px solid #364055',
          boxShadow: g && !g.soft ? `inset 0 0 12px #0008, 0 0 14px ${g.color}` : g ? `inset 0 0 0 2px ${g.color}` : 'none',
          color: g ? '#000' : black ? '#d2d9e0' : '#607d8b',
          fontSize: black ? 0 : 9,
          paddingLeft: black ? 0 : 6,
          fontWeight: 700,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {black ? '' : pitchName(p)}
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#0b0e14', display: 'flex', flexDirection: 'column', color: '#dbe2e9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #242b3c', background: '#11151f', flexWrap: 'wrap' }}>
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
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#78909c' }} title="Calibrate at 40 BPM: flash lands AFTER the tone? press +. BEFORE it? press −. Saved, works at every tempo.">
          SYNC
          <button onClick={() => setSyncMs(v => Math.max(-50, v - 10))} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #3b475d', background: '#252e40', color: '#00e5ff', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>−</button>
          <span style={{ minWidth: 52, textAlign: 'center', color: '#cfd8dc', fontWeight: 700 }}>{syncMs}ms</span>
          <button onClick={() => setSyncMs(v => Math.min(250, v + 10))} style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #3b475d', background: '#252e40', color: '#00e5ff', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>+</button>
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <div
          style={{
            position: 'relative',
            width: winW,
            height: rows * ROW_H + 24,
            background: '#0d1119',
            backgroundImage:
              `repeating-linear-gradient(to right, transparent 0, transparent ${PX_PER_STEP * 4 - 1}px, #1c2333 ${PX_PER_STEP * 4 - 1}px, #1c2333 ${PX_PER_STEP * 4}px),` +
              `repeating-linear-gradient(to right, transparent 0, transparent ${PX_PER_STEP * 16 - 1}px, #2e3a52 ${PX_PER_STEP * 16 - 1}px, #2e3a52 ${PX_PER_STEP * 16}px),` +
              `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_H - 1}px, #161c29 ${ROW_H - 1}px, #161c29 ${ROW_H}px)`,
            backgroundPosition: `${KEYS_W}px 24px, ${KEYS_W}px 24px, 0 24px`,
            backgroundRepeat: 'repeat, repeat, repeat',
          }}
        >
          <div style={{ position: 'sticky', top: 0, zIndex: 4, height: 24, background: '#11151f', borderBottom: '1px solid #242b3c', marginLeft: KEYS_W }}>
            {rulerBars}
          </div>
          <div style={{ position: 'sticky', left: 0, top: 24, zIndex: 3, width: KEYS_W, height: rows * ROW_H, background: '#05070b', borderRight: '1px solid #364055' }}>
            {keyRows}
          </div>
          {bars}
          <div style={{ position: 'absolute', top: 24, bottom: 0, left: playX, width: 2, background: '#fff', boxShadow: '0 0 10px #fff', zIndex: 2, pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  );
}
