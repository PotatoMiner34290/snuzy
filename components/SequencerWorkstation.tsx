'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import {
  GM_INSTRUMENTS,
  getInstrumentsByCategory,
  SoundFontPlayer
} from './SoundFontEngine';
import ArrangementView, { type InstrumentClip } from './ArrangementView';
import ContextMenu, { type CtxItem } from './ContextMenu';
import TourGuide, { type TourStep } from './TourGuide';
import SecretPiano from './SecretPiano';
import Mp3ToMidi from './Mp3ToMidi';
import { SHOWCASE_SONG } from './ShowcaseSong';

const SHOWCASE_TRACKS = SHOWCASE_SONG.tracks as unknown as TrackDef[];
const SHOWCASE_CLIPS = SHOWCASE_SONG.clips as unknown as InstrumentClip[];

export interface SoundPreset {
  id: string;
  name: string;
  note?: string;
  engine?: string;
}

export type TrackCategory = 'Drums' | 'Bass' | 'Synth' | 'SoundFont Instruments';
export type TrackEngine = 'synth' | 'soundfont';
export type SynthType =
  | 'membrane' | 'sub808' | 'noise' | 'synth' | 'metal' | 'metal_open'
  | 'tom' | 'rim' | 'cowbell' | 'fm' | 'acid' | 'poly' | 'pluck' | 'am'
  | 'space' | 'wobble' | 'soundfont';

export interface TrackDef {
  id: string;
  name: string;
  category: TrackCategory;
  type: SynthType;
  note: string;
  color: string;
  presets: SoundPreset[];
  defaultGmId?: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const MIDI_NOTE_PRESETS: SoundPreset[] = (() => {
  const out: SoundPreset[] = [];
  for (let oct = 1; oct <= 6; oct++) {
    for (const n of NOTE_NAMES) {
      const note = `${n}${oct}`;
      out.push({ id: note, name: note, note });
    }
  }
  return out;
})();

const CHANNEL_COLORS = [
  '#ff4b4b', '#ff8800', '#ffd000', '#00e676', '#00e5ff', '#00b0ff',
  '#651fff', '#d500f9', '#ff4081', '#f9a825', '#ab47bc', '#1de9b6'
];

export const TRACK_DEFS: TrackDef[] = [
  {
    id: 'kick',
    name: 'Punch Kick',
    category: 'Drums',
    type: 'membrane',
    note: 'C1',
    color: '#ff4b4b',
    presets: [
      { id: 'punch', name: 'Punch C1', note: 'C1' },
      { id: 'deep', name: 'Deep A0', note: 'A0' },
      { id: 'tight', name: 'Tight D1', note: 'D1' },
      { id: 'hard', name: 'Hard F1', note: 'F1' }
    ]
  },
  {
    id: 'sub_808',
    name: '808 Sub Boom',
    category: 'Drums',
    type: 'sub808',
    note: 'A#0',
    color: '#ff1744',
    presets: [
      { id: 'heavy', name: 'Boom A#0', note: 'A#0' },
      { id: 'low_c', name: 'Deep C0', note: 'C0' },
      { id: 'mid_d', name: 'Mid D#0', note: 'D#0' },
      { id: 'punch_f', name: 'Thump F0', note: 'F0' }
    ]
  },
  {
    id: 'snare',
    name: 'Snare Drum',
    category: 'Drums',
    type: 'noise',
    note: '',
    color: '#ff8800',
    presets: [
      { id: 'crisp', name: 'Crisp 16n', note: '16n' },
      { id: 'tight', name: 'Tight 32n', note: '32n' },
      { id: 'fat', name: 'Fat 8n', note: '8n' },
      { id: 'snap', name: 'Snap 24n', note: '24n' }
    ]
  },
  {
    id: 'clap',
    name: 'Stereo Clap',
    category: 'Drums',
    type: 'synth',
    note: 'D#4',
    color: '#ff9100',
    presets: [
      { id: 'standard', name: 'Studio D#4', note: 'D#4' },
      { id: 'high', name: 'Bright G#4', note: 'G#4' },
      { id: 'low', name: 'Warm C4', note: 'C4' },
      { id: 'trap', name: 'Trap F4', note: 'F4' }
    ]
  },
  {
    id: 'hihat',
    name: 'Closed Hat',
    category: 'Drums',
    type: 'metal',
    note: '32n',
    color: '#ffd000',
    presets: [
      { id: 'tite', name: 'Tight 32n', note: '32n' },
      { id: 'micro', name: 'Micro 64n', note: '64n' },
      { id: 'click', name: 'Click 16n', note: '16n' }
    ]
  },
  {
    id: 'openhat',
    name: 'Open Hat',
    category: 'Drums',
    type: 'metal_open',
    note: '8n',
    color: '#ffea00',
    presets: [
      { id: 'sizzle', name: 'Sizzle 8n', note: '8n' },
      { id: 'long', name: 'Long 4n', note: '4n' },
      { id: 'short', name: 'Short 16n', note: '16n' }
    ]
  },
  {
    id: 'tom',
    name: 'Low/Mid Tom',
    category: 'Drums',
    type: 'tom',
    note: 'G1',
    color: '#d500f9',
    presets: [
      { id: 'low', name: 'Low G1', note: 'G1' },
      { id: 'mid', name: 'Mid C2', note: 'C2' },
      { id: 'high', name: 'High E2', note: 'E2' }
    ]
  },
  {
    id: 'rimshot',
    name: 'Wood Rimshot',
    category: 'Drums',
    type: 'rim',
    note: 'F4',
    color: '#e040fb',
    presets: [
      { id: 'wood', name: 'Wood F4', note: 'F4' },
      { id: 'click', name: 'Click A4', note: 'A4' },
      { id: 'sidestick', name: 'Side C5', note: 'C5' }
    ]
  },
  {
    id: 'cowbell',
    name: '808 Cowbell',
    category: 'Drums',
    type: 'cowbell',
    note: 'G#4',
    color: '#651fff',
    presets: [
      { id: 'standard', name: 'Classic G#4', note: 'G#4' },
      { id: 'high', name: 'High C#5', note: 'C#5' },
      { id: 'low', name: 'Low E4', note: 'E4' }
    ]
  },
  {
    id: 'bass',
    name: 'Sub Bass FM',
    category: 'Bass',
    type: 'fm',
    note: 'C2',
    color: '#00e676',
    presets: [
      { id: 'c2', name: 'Root C2', note: 'C2' },
      { id: 'f1', name: 'Sub Low F1', note: 'F1' },
      { id: 'g1', name: 'Warm G1', note: 'G1' },
      { id: 'a1', name: 'Mid A1', note: 'A1' },
      { id: 'e2', name: 'High E2', note: 'E2' }
    ]
  },
  {
    id: 'acid_bass',
    name: 'Acid Reso Bass',
    category: 'Bass',
    type: 'acid',
    note: 'F1',
    color: '#76ff03',
    presets: [
      { id: 'f1', name: 'Acid F1', note: 'F1' },
      { id: 'c2', name: 'Squelch C2', note: 'C2' },
      { id: 'd1', name: 'Deep D1', note: 'D1' },
      { id: 'a1', name: 'Reso A1', note: 'A1' }
    ]
  },
  {
    id: 'synth_lead',
    name: 'Lead Saw Synth',
    category: 'Synth',
    type: 'poly',
    note: 'C4',
    color: '#ff4081',
    presets: [
      { id: 'c4', name: 'Lead C4', note: 'C4' },
      { id: 'e4', name: 'Bright E4', note: 'E4' },
      { id: 'g4', name: 'Fifth G4', note: 'G4' },
      { id: 'c5', name: 'High C5', note: 'C5' }
    ]
  },
  {
    id: 'pluck',
    name: 'Hyper Pluck',
    category: 'Synth',
    type: 'pluck',
    note: 'E4',
    color: '#f50057',
    presets: [
      { id: 'e4', name: 'Crisp E4', note: 'E4' },
      { id: 'a4', name: 'Sharp A4', note: 'A4' },
      { id: 'c4', name: 'Warm C4', note: 'C4' },
      { id: 'b4', name: 'Stab B4', note: 'B4' }
    ]
  },
  {
    id: 'chord_pad',
    name: 'Keystick / Pad',
    category: 'Synth',
    type: 'am',
    note: 'G3',
    color: '#00b0ff',
    presets: [
      { id: 'g3', name: 'Lush G3', note: 'G3' },
      { id: 'c3', name: 'Deep C3', note: 'C3' },
      { id: 'f3', name: 'Dreamy F3', note: 'F3' },
      { id: 'd4', name: 'Airy D4', note: 'D4' }
    ]
  },
  {
    id: 'space_pad',
    name: 'Ambient Cosmos',
    category: 'Synth',
    type: 'space',
    note: 'C3',
    color: '#00e5ff',
    presets: [
      { id: 'c3', name: 'Cosmos C3', note: 'C3' },
      { id: 'g2', name: 'Sub G2', note: 'G2' },
      { id: 'a3', name: 'Ether A3', note: 'A3' },
      { id: 'e3', name: 'Nebula E3', note: 'E3' }
    ]
  },
  {
    id: 'wobble',
    name: 'LFO Wobble Synth',
    category: 'Synth',
    type: 'wobble',
    note: 'D2',
    color: '#1de9b6',
    presets: [
      { id: 'd2', name: 'Heavy D2', note: 'D2' },
      { id: 'f2', name: 'Growl F2', note: 'F2' },
      { id: 'a1', name: 'Deep A1', note: 'A1' },
      { id: 'c2', name: 'Dark C2', note: 'C2' }
    ]
  },
  {
    id: 'sf_piano',
    name: 'Concert Piano',
    category: 'SoundFont Instruments',
    type: 'soundfont',
    note: 'C4',
    color: '#f9a825',
    defaultGmId: 0,
    presets: MIDI_NOTE_PRESETS
  },
  {
    id: 'sf_guitar',
    name: 'Acoustic Guitar',
    category: 'SoundFont Instruments',
    type: 'soundfont',
    note: 'E3',
    color: '#fb8c00',
    defaultGmId: 24,
    presets: MIDI_NOTE_PRESETS
  },
  {
    id: 'sf_strings',
    name: 'Orchestral Strings',
    category: 'SoundFont Instruments',
    type: 'soundfont',
    note: 'G3',
    color: '#ab47bc',
    defaultGmId: 48,
    presets: MIDI_NOTE_PRESETS
  },
  {
    id: 'sf_brass',
    name: 'Brass Section',
    category: 'SoundFont Instruments',
    type: 'soundfont',
    note: 'C4',
    color: '#ffd600',
    defaultGmId: 61,
    presets: MIDI_NOTE_PRESETS
  }
];

export const DEFAULT_STEPS = 16;
export const DEFAULT_BPM = 120;
export const STEPS_PER_BAR = 16;
export const MAX_STEPS = 8192;
export const ENDLESS_BLOCK_STEPS = 64;
const BAR_OPTIONS = [1, 2, 4, 8, 16, 32, 64, 128];


function normalizeStepCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_STEPS;
  const bars = Math.ceil(value / STEPS_PER_BAR);
  return Math.max(STEPS_PER_BAR, Math.min(MAX_STEPS, bars * STEPS_PER_BAR));
}

function defaultGmForTrack(track: TrackDef): number {
  if (track.defaultGmId !== undefined) return track.defaultGmId;
  if (track.category === 'Bass') return 33;
  if (track.category === 'Synth') return 81;
  if (track.category === 'Drums') return 116;
  return 0;
}

function emptyRow(steps: number): boolean[] {
  return Array(steps).fill(false);
}

function midiNoteName(midi: number): string {
  const n = NOTE_NAMES[((midi % 12) + 12) % 12];
  const oct = Math.floor(midi / 12) - 1;
  return `${n}${oct}`;
}

// Mixer helpers: 0-100 volume slider → gain (perceptual curve), -50..50 pan → -1..1.
function volToGain(v: number): number {
  const clamped = Math.max(0, Math.min(100, v)) / 100;
  return Math.pow(clamped, 1.5);
}

function panToPan(p: number): number {
  return Math.max(-1, Math.min(1, p / 50));
}

// Pitched Tone voices can be held by the damper pedal; drums just decay.
const SUSTAIN_SYNTH_TYPES: SynthType[] = ['fm', 'synth', 'rim', 'acid', 'wobble', 'pluck', 'poly', 'am', 'space'];

// One Tone synth instance per track (so every track owns its mixer strip).
// Settings mirror the original shared-instrument setup.
function createToneInstrument(type: SynthType): any {
  switch (type) {
    case 'membrane':
      return new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: 6, oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.35 }
      });
    case 'sub808': {
      const inst = new Tone.MembraneSynth({
        pitchDecay: 0.08, octaves: 3, oscillator: { type: 'sine' },
        envelope: { attack: 0.02, decay: 0.5, sustain: 0.2, release: 0.5 }
      });
      inst.volume.value = -1;
      return inst;
    }
    case 'noise':
      return new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
      });
    case 'synth':
      return new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.12, sustain: 0, release: 0.08 }
      });
    case 'metal': {
      const inst = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.04, release: 0.04 },
        harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5
      });
      inst.frequency.value = 250;
      inst.volume.value = -8;
      return inst;
    }
    case 'metal_open': {
      const inst = new Tone.MetalSynth({
        envelope: { attack: 0.005, decay: 0.25, release: 0.2 },
        harmonicity: 4.8, modulationIndex: 28, resonance: 3500, octaves: 1.2
      });
      inst.frequency.value = 220;
      inst.volume.value = -8;
      return inst;
    }
    case 'tom':
      return new Tone.MembraneSynth({
        pitchDecay: 0.06, octaves: 4, oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.25, sustain: 0.01, release: 0.2 }
      });
    case 'rim': {
      const inst = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.03 }
      });
      inst.volume.value = -4;
      return inst;
    }
    case 'cowbell': {
      const inst = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.1, release: 0.08 },
        harmonicity: 1.4, modulationIndex: 12, resonance: 2500, octaves: 0.5
      });
      inst.frequency.value = 540;
      inst.volume.value = -6;
      return inst;
    }
    case 'fm': {
      const inst = new Tone.FMSynth({
        harmonicity: 1, modulationIndex: 2, oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.3, release: 0.3 }
      });
      inst.volume.value = -3;
      return inst;
    }
    case 'acid': {
      const inst = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sawtooth' },
        filter: { Q: 6, type: 'lowpass' },
        envelope: { attack: 0.01, decay: 0.18, sustain: 0.2, release: 0.2 },
        filterEnvelope: { attack: 0.02, decay: 0.12, sustain: 0.1, release: 0.15, baseFrequency: 80, octaves: 4 }
      });
      inst.maxPolyphony = 8;
      inst.volume.value = -3;
      return inst;
    }
    case 'poly': {
      const inst = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.3 }
      });
      inst.maxPolyphony = 8;
      inst.volume.value = -6;
      return inst;
    }
    case 'pluck': {
      const inst = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.1 }
      });
      inst.maxPolyphony = 8;
      inst.volume.value = -3;
      return inst;
    }
    case 'am': {
      const inst = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2, oscillator: { type: 'sine' },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.4 }
      });
      inst.maxPolyphony = 8;
      inst.volume.value = -6;
      return inst;
    }
    case 'space': {
      const inst = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3, modulationIndex: 10, oscillator: { type: 'triangle' },
        envelope: { attack: 0.1, decay: 0.35, sustain: 0.5, release: 0.5 }
      });
      inst.maxPolyphony = 8;
      inst.volume.value = -8;
      return inst;
    }
    case 'wobble': {
      const inst = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'square' },
        filter: { Q: 4, type: 'lowpass' },
        envelope: { attack: 0.03, decay: 0.18, sustain: 0.4, release: 0.25 },
        filterEnvelope: { attack: 0.08, decay: 0.15, sustain: 0.2, release: 0.2, baseFrequency: 120, octaves: 3 }
      });
      inst.maxPolyphony = 8;
      inst.volume.value = -4;
      return inst;
    }
    default:
      return new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.12, sustain: 0, release: 0.08 }
      });
  }
}

// Instrument picker for the right-click menu: family boxes first, then the
// family's instruments in the same panel — everything fits, no flyouts.
function InstrumentPicker({ cats, currentGm, onPick }: {
  cats: Record<string, { id: number; name: string }[]>;
  currentGm: number;
  onPick: (gmId: number) => void;
}) {
  const [cat, setCat] = React.useState<string | null>(null);
  if (!cat) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, width: 284 }}>
        {Object.keys(cats).map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{ padding: '8px 6px', borderRadius: 6, border: '1px solid #3b475d', background: '#222a3b', color: '#dbe2e9', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
          >
            {c}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div style={{ padding: 4, width: 284 }}>
      <button
        onClick={() => setCat(null)}
        style={{ width: '100%', marginBottom: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid #3b475d', background: '#283247', color: '#00e5ff', cursor: 'pointer', fontSize: 11, fontWeight: 800, textAlign: 'left' }}
      >
        ← All families
      </button>
      {(cats[cat] || []).map(inst => (
        <button
          key={inst.id}
          onClick={() => onPick(inst.id)}
          style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderRadius: 5, padding: '7px 10px', cursor: 'pointer', color: '#dbe2e9', fontSize: 12 }}
        >
          <span style={{ width: 16, flexShrink: 0, color: '#00e676', fontWeight: 800 }}>{inst.id === currentGm ? '✓' : ''}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</span>
        </button>
      ))}
    </div>
  );
}

const EMPTY_ROW_CONST: boolean[] = [];

interface TrackRowProps {
  track: TrackDef;
  channelIndex: number;
  row: boolean[];
  winStart: number;
  winEnd: number;
  gridTemplate: string;
  trackCount: number;
  isSelected: boolean;
  isHeld: boolean;
  isMuted: boolean;
  isSolo: boolean;
  engine: TrackEngine;
  activePreset: string | undefined;
  currentGm: number;
  status: string;
  velocity: number;
  volume: number;
  pan: number;
  canUseSynth: boolean;
  groupedGm: Record<string, { id: number; name: string }[]>;
  onToggleMute: (id: string) => void;
  onToggleSolo: (id: string) => void;
  onPreview: (t: TrackDef) => void;
  onToggleSelect: (id: string) => void;
  onEngine: (t: TrackDef, e: TrackEngine) => void;
  onInstrument: (t: TrackDef, gm: number) => void;
  onPreset: (id: string, v: string) => void;
  onVelocity: (id: string, v: number) => void;
  onVolume: (id: string, v: number) => void;
  onPan: (id: string, v: number) => void;
  onRemove: (id: string) => void;
  onHold: (id: string) => void;
  onPad: (id: string, step: number) => void;
}

function TrackRowComponent(props: TrackRowProps) {
  const {
    track, channelIndex, row, winStart, winEnd, gridTemplate, trackCount,
    isSelected, isHeld, isMuted, isSolo, engine, activePreset, currentGm,
    status, velocity, volume, pan, canUseSynth, groupedGm,
    onToggleMute, onToggleSolo, onPreview, onToggleSelect, onEngine,
    onInstrument, onPreset, onVelocity, onVolume, onPan, onRemove, onHold, onPad,
  } = props;
  const panLabel = pan > 0 ? `R${pan}` : pan < 0 ? `L${Math.abs(pan)}` : 'center';
  return (
    <div
      data-ctx-track={track.id}
      style={{
        display: 'grid',
        gridTemplateColumns: gridTemplate,
        gap: 6,
        alignItems: 'center',
        opacity: isSelected && !isMuted ? 1 : 0.38,
        transition: 'opacity 0.2s'
      }}
    >
      <div
        className="sticky-track-controls"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 6px',
          backgroundColor: '#1b2030',
          borderRadius: 6,
          borderLeft: `4px solid ${track.color}`,
          minWidth: 0
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
          <button
            onClick={() => onToggleMute(track.id)}
            title="Mute channel"
            style={{
              width: 22, height: 18, fontSize: 9, fontWeight: 800, borderRadius: 3, cursor: 'pointer',
              border: 'none', background: isMuted ? '#ff5252' : '#2a3144', color: isMuted ? '#000' : '#90a4ae'
            }}
          >
            M
          </button>
          <button
            onClick={() => onToggleSolo(track.id)}
            title="Solo channel"
            style={{
              width: 22, height: 18, fontSize: 9, fontWeight: 800, borderRadius: 3, cursor: 'pointer',
              border: 'none', background: isSolo ? '#ffd600' : '#2a3144', color: isSolo ? '#000' : '#90a4ae'
            }}
          >
            S
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: '#78909c', fontWeight: 700, flexShrink: 0 }}>
              CH {channelIndex + 1}
            </span>
            <button
              onClick={() => onPreview(track)}
              className="track-label-btn"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f0f3f6',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                textAlign: 'left',
                padding: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1
              }}
              title="Preview this channel"
            >
              {track.name}
            </button>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(track.id)}
              title="Arm channel"
              style={{ accentColor: track.color, cursor: 'pointer', flexShrink: 0 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <select
              value={engine}
              onChange={e => onEngine(track, e.target.value as TrackEngine)}
              style={{ ...selectStyle, color: '#90caf9', width: 52, flexShrink: 0 }}
              title="Tone synth or SoundFont sampler"
            >
              {canUseSynth && <option value="synth">Tone</option>}
              <option value="soundfont">GM</option>
            </select>

            <select
              value={currentGm}
              onChange={e => onInstrument(track, Number(e.target.value))}
              style={{ ...selectStyle, color: track.color, flex: 1 }}
              title="General MIDI SoundFont (all 128 instruments)"
            >
              {Object.entries(groupedGm).map(([cat, insts]) => (
                <optgroup key={cat} label={cat}>
                  {insts.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>

            <select
              value={activePreset}
              onChange={e => onPreset(track.id, e.target.value)}
              style={{ ...selectStyle, color: '#b0bec5', width: 58, flexShrink: 0 }}
              title="Note / pitch"
            >
              {(engine === 'soundfont' ? MIDI_NOTE_PRESETS : track.presets).map(p => (
                <option key={p.id} value={p.id}>{p.note || p.name}</option>
              ))}
            </select>

            <select
              value={velocity}
              onChange={e => onVelocity(track.id, Number(e.target.value))}
              style={{ ...selectStyle, color: '#80cbc4', width: 52, flexShrink: 0 }}
              title="MIDI velocity"
            >
              {[127, 110, 100, 85, 70, 55, 40, 25].map(v => (
                <option key={v} value={v}>V{v}</option>
              ))}
            </select>

            {engine === 'soundfont' && (
              <span
                title={status === 'loading' ? 'Loading SoundFont samples…' : status === 'error' ? 'Load failed' : 'Sampler ready'}
                style={{ fontSize: 8, fontWeight: 700, color: status === 'loading' ? '#ffd600' : status === 'error' ? '#ff5252' : '#00e676', flexShrink: 0 }}
              >
                {status === 'loading' ? '…' : status === 'error' ? '!' : 'HD'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} title="Mixer: volume and stereo pan">
            <span style={{ fontSize: 8, fontWeight: 800, color: '#78909c', flexShrink: 0 }}>VOL</span>
            <input
              type="range" min={0} max={100} value={volume}
              onChange={e => onVolume(track.id, Number(e.target.value))}
              style={{ width: 56, accentColor: track.color, cursor: 'pointer' }}
              title={`Volume ${volume}%`}
            />
            <span style={{ fontSize: 8, fontWeight: 800, color: '#78909c', flexShrink: 0 }}>PAN</span>
            <input
              type="range" min={-50} max={50} value={pan}
              onChange={e => onPan(track.id, Number(e.target.value))}
              style={{ width: 56, accentColor: '#00e5ff', cursor: 'pointer' }}
              title={`Pan ${panLabel}`}
            />
          </div>
        </div>

        <button
          onClick={() => onRemove(track.id)}
          disabled={trackCount <= 1}
          style={{
            background: 'transparent',
            border: 'none',
            color: trackCount <= 1 ? '#37474f' : '#546e7a',
            cursor: trackCount <= 1 ? 'not-allowed' : 'pointer',
            fontSize: 16,
            padding: '0 2px',
            flexShrink: 0
          }}
          title="Remove this channel"
          onMouseEnter={e => { if (trackCount > 1) e.currentTarget.style.color = '#ff5252'; }}
          onMouseLeave={e => { e.currentTarget.style.color = trackCount <= 1 ? '#37474f' : '#546e7a'; }}
        >
          ×
        </button>
      </div>

      <button
        className="btn-hold sticky-hold-control"
        onClick={() => onHold(track.id)}
        style={{
          padding: '6px 0',
          fontSize: 10,
          fontWeight: 800,
          borderRadius: 6,
          border: isHeld ? `1px solid ${track.color}` : '1px solid #37474f',
          backgroundColor: isHeld ? track.color : '#1c2130',
          color: isHeld ? '#000' : '#b0bec5',
          cursor: 'pointer',
          textTransform: 'uppercase'
        }}
        title="Hold note on every step"
      >
        {isHeld ? 'HELD' : 'HOLD'}
      </button>

      {row.slice(winStart, winEnd).map((active, k) => {
        const stepIdx = winStart + k;
        const isGroupFour = stepIdx % 4 === 0;
        let padBackground = '#202638';
        if (active) padBackground = track.color;
        else if (isHeld) padBackground = `${track.color}44`;

        return (
          <div
            key={stepIdx}
            onClick={() => onPad(track.id, stepIdx)}
            className={`pad-cell step-col-${stepIdx}`}
            data-sequencer-step={stepIdx}
            data-track-id={track.id}
            style={{
              backgroundColor: padBackground,
              border: isGroupFour ? '1px solid #455a64' : '1px solid #283145',
              boxShadow: active ? `0 0 6px ${track.color}88` : 'none'
            }}
            title={`Step ${stepIdx + 1}`}
          />
        );
      })}
    </div>
  );
}

// Callback props are intentionally ignored: every row action closes over
// refs and stable setters only, so data props alone decide re-renders.
function trackRowEqual(a: TrackRowProps, b: TrackRowProps) {
  return a.track === b.track
    && a.channelIndex === b.channelIndex
    && a.row === b.row
    && a.winStart === b.winStart
    && a.winEnd === b.winEnd
    && a.gridTemplate === b.gridTemplate
    && a.trackCount === b.trackCount
    && a.isSelected === b.isSelected
    && a.isHeld === b.isHeld
    && a.isMuted === b.isMuted
    && a.isSolo === b.isSolo
    && a.engine === b.engine
    && a.activePreset === b.activePreset
    && a.currentGm === b.currentGm
    && a.status === b.status
    && a.velocity === b.velocity
    && a.volume === b.volume
    && a.pan === b.pan
    && a.canUseSynth === b.canUseSynth
    && a.groupedGm === b.groupedGm;
}

const TrackRow = React.memo(TrackRowComponent, trackRowEqual);

const selectStyle: React.CSSProperties = {
  background: '#131722',
  border: '1px solid #2e384d',
  borderRadius: 3,
  fontSize: 10,
  padding: '2px 4px',
  cursor: 'pointer',
  outline: 'none',
  minWidth: 0
};

export default function SequencerWorkstation() {
  // Preset startup song, baked in from public/midi/placeholder.mid via
  // `npm run showcase` — renders instantly, no fetch, no loading flash.
  const [bpm, setBpm] = useState<number>(SHOWCASE_SONG.bpm);
  const [stepCount, setStepCount] = useState<number>(SHOWCASE_SONG.stepCount);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'arrangement' | 'steps'>('arrangement');
  const [arrangementClips, setArrangementClips] = useState<InstrumentClip[]>(() => SHOWCASE_CLIPS.map(c => ({ ...c, notes: c.notes.map(n => ({ ...n })) })));
  const [tracks, setTracks] = useState<TrackDef[]>(() => SHOWCASE_TRACKS.map(t => ({ ...t, presets: MIDI_NOTE_PRESETS })));
  const [selectedTracks, setSelectedTracks] = useState<string[]>(() => [...SHOWCASE_SONG.selected]);
  const [holdTones, setHoldTones] = useState<Record<string, boolean>>({});
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({});
  const [soloTracks, setSoloTracks] = useState<Record<string, boolean>>({});
  const [midiToast, setMidiToast] = useState<{ visible: boolean; fileName: string; title: string; sub: string }>({ visible: false, fileName: '', title: 'MIDI IMPORTED', sub: 'Mapped to sequencer channels' });
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [trackPresets, setTrackPresets] = useState<Record<string, string>>(() => ({ ...(SHOWCASE_SONG.presets as Record<string, string>) }));

  const [trackEngine, setTrackEngine] = useState<Record<string, TrackEngine>>(() => ({ ...(SHOWCASE_SONG.gm ? Object.fromEntries(Object.keys(SHOWCASE_SONG.gm).map(id => [id, 'soundfont' as TrackEngine])) : {}) }));

  const [trackVelocity, setTrackVelocity] = useState<Record<string, number>>(() => ({ ...(SHOWCASE_SONG.velocity as Record<string, number>) }));

  // Mixer: per-track volume (0-100, default 100) and pan (-50..50, default 0).
  // Damper pedal regions per track (song steps), parsed from MIDI CC64.
  const [trackSustain, setTrackSustain] = useState<Record<string, { down: number; up: number }[]>>({});
  const trackSustainRef = useRef(trackSustain);
  useEffect(() => { trackSustainRef.current = trackSustain; }, [trackSustain]);

  const [trackVolume, setTrackVolume] = useState<Record<string, number>>(() => (
    Object.fromEntries([...SHOWCASE_SONG.selected, ...TRACK_DEFS.map(t => t.id)].map(id => [id, 100]))
  ));
  const [trackPan, setTrackPan] = useState<Record<string, number>>(() => (
    Object.fromEntries([...SHOWCASE_SONG.selected, ...TRACK_DEFS.map(t => t.id)].map(id => [id, 0]))
  ));

  // Boot preloader: the app reveals itself only once the audio engine and
  // every showcase sound are actually ready, so nothing stutters at startup.
  const [boot, setBoot] = useState({ done: 0, total: 1, label: 'Starting audio engine…' });
  const [bootVisible, setBootVisible] = useState(true);
  const bootedRef = useRef(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; trackId: string | null; clipId: string | null } | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [secretPiano, setSecretPiano] = useState<boolean>(false);
  const [mp3Booth, setMp3Booth] = useState<boolean>(false);

  const [applyAllGm, setApplyAllGm] = useState<number>(0);

  const trackPresetsRef = useRef(trackPresets);
  useEffect(() => { trackPresetsRef.current = trackPresets; }, [trackPresets]);

  // Unified song model: arrangement clips are the single source of truth and
  // the step grid is a live simplified projection of them — a pad lights up
  // wherever a note starts on that step. Editing pads writes through to clips.
  const prevGridRef = useRef<Record<string, boolean[]>>({});
  const grid: Record<string, boolean[]> = React.useMemo(() => {
    const projected: Record<string, boolean[]> = {};
    tracks.forEach(t => { projected[t.id] = emptyRow(stepCount); });
    arrangementClips.forEach(clip => {
      const row = projected[clip.trackId];
      if (!row) return;
      clip.notes.forEach(n => {
        const s = clip.start + n.start;
        if (s >= 0 && s < stepCount) row[s] = true;
      });
    });
    // Reuse previous row arrays when identical so memoized rows skip render.
    const prev = prevGridRef.current;
    Object.keys(projected).forEach(id => {
      const old = prev[id];
      const cur = projected[id];
      if (old && old.length === cur.length && old.every((v, i) => v === cur[i])) {
        projected[id] = old;
      }
    });
    prevGridRef.current = projected;
    return projected;
  }, [tracks, arrangementClips, stepCount]);

  const trackChainsRef = useRef<Record<string, { gain: Tone.Gain; pan: Tone.Panner }>>({});
  const trackSynthsRef = useRef<Record<string, { inst: any; type: SynthType }>>({});
  // Samplers are cached per track AND GM program, so per-block instrument
  // overrides get their own ready-to-play sampler on the track's strip.
  const trackSamplersRef = useRef<Record<string, Tone.Sampler>>({});
  const samplerKey = (trackId: string, gmId: number) => `${trackId}:${gmId}`;
  // Voice limiter: samplers (unlike synths) spawn unbounded voices, so at
  // extreme tempos dense passages would pile up hundreds of concurrent
  // voices and take down the audio thread. Past the cap we shed new notes
  // (old ones keep ringing) instead of crashing.
  const MAX_SAMPLER_VOICES = 28;
  const samplerVoicesRef = useRef<Map<Tone.Sampler, number>>(new Map());

  const samplerHasRoom = (sampler: Tone.Sampler, duration: string | number): boolean => {
    const active = samplerVoicesRef.current.get(sampler) ?? 0;
    if (active >= MAX_SAMPLER_VOICES) return false;
    samplerVoicesRef.current.set(sampler, active + 1);
    let holdMs = 400;
    try {
      holdMs = Math.max(80, Math.min(2500, Tone.Time(duration).toSeconds() * 1000 + 150));
    } catch {}
    window.setTimeout(() => {
      const left = Math.max(0, (samplerVoicesRef.current.get(sampler) ?? 1) - 1);
      if (left === 0) samplerVoicesRef.current.delete(sampler);
      else samplerVoicesRef.current.set(sampler, left);
    }, holdMs);
    return true;
  };
  const isPlayingRef = useRef<boolean>(false);
  const repeatIdRef = useRef<number | null>(null);
  const stepRef = useRef<number>(0);
  const holdTonesRef = useRef(holdTones);
  const gridRef = useRef<Record<string, boolean[]>>({});
  const selectedTracksRef = useRef(selectedTracks);
  const tracksRef = useRef(tracks);
  const trackEngineRef = useRef(trackEngine);
  const trackVelocityRef = useRef(trackVelocity);
  const trackVolumeRef = useRef(trackVolume);
  const trackPanRef = useRef(trackPan);
  const bpmRef = useRef(bpm);
  const mutedTracksRef = useRef(mutedTracks);
  const soloTracksRef = useRef(soloTracks);
  const stepCountRef = useRef(stepCount);
  const stepColCacheRef = useRef<Array<{ step: HTMLElement[] }>>([]);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  // Grid windowing: only the visible step columns (+overscan) render, so a
  // 1664-step song mounts ~1-2k pads instead of ~15k. Buckets keep scroll
  // updates infrequent.
  const WIN_BUCKET = 32;
  const WIN_OVERSCAN = 192;
  const [win, setWin] = useState({ start: 0, end: 256 });
  const winRafRef = useRef<number>(0);

  const updateWinFromScroll = () => {
    const sc = gridScrollRef.current;
    if (!sc) return;
    const steps = stepCountRef.current;
    const stepW = Math.max(8, (sc.scrollWidth - 360) / Math.max(1, steps));
    const first = Math.max(0, Math.floor((sc.scrollLeft - 360) / stepW) - WIN_OVERSCAN);
    const count = Math.ceil(sc.clientWidth / stepW) + WIN_OVERSCAN * 2;
    const start = Math.max(0, Math.min(steps, Math.floor(first / WIN_BUCKET) * WIN_BUCKET));
    const end = Math.max(Math.min(steps, start + 32), Math.min(steps, start + Math.ceil(count / WIN_BUCKET) * WIN_BUCKET));
    setWin(prev => (prev.start === start && prev.end === end ? prev : { start, end }));
  };

  const onGridScroll = () => {
    if (winRafRef.current) return;
    winRafRef.current = requestAnimationFrame(() => {
      winRafRef.current = 0;
      updateWinFromScroll();
    });
  };

  useEffect(() => {
    updateWinFromScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepCount]);

  // Fresh cells render on every window change — rebuild the highlight cache
  // and repaint the live step so the playhead never goes dark mid-scroll.
  useEffect(() => {
    refreshStepColCache();
    if (isPlayingRef.current) {
      const s = stepRef.current;
      stepColCacheRef.current[s]?.step.forEach(el => el.classList.add('step-current'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win]);
  const autoFollowRef = useRef(autoFollow);
  const arrangementClipsRef = useRef(arrangementClips);
  const activeViewRef = useRef(activeView);
  const selectedTracksSetRef = useRef<Set<string>>(new Set(selectedTracks));
  const limiterRef = useRef<Tone.Limiter | null>(null);

  const groupedGmInstruments = React.useMemo(() => getInstrumentsByCategory(), []);

  const [trackGmInstruments, setTrackGmInstruments] = useState<Record<string, number>>(() => ({ ...(SHOWCASE_SONG.gm as Record<string, number>) }));

  const trackGmInstrumentsRef = useRef(trackGmInstruments);
  useEffect(() => { trackGmInstrumentsRef.current = trackGmInstruments; }, [trackGmInstruments]);

  const [sfStatus, setSfStatus] = useState<Record<number, string>>({});
  const soundFontPlayerRef = useRef<SoundFontPlayer | null>(null);

  const loadSoundFontInstrument = async (gmId: number) => {
    const player = soundFontPlayerRef.current;
    if (!player) return;
    if (player.isLoaded(gmId)) return;
    try {
      setSfStatus(prev => ({ ...prev, [gmId]: 'loading' }));
      await player.loadInstrument(gmId);
      setSfStatus(prev => ({ ...prev, [gmId]: 'loaded' }));
    } catch {
      setSfStatus(prev => ({ ...prev, [gmId]: 'error' }));
    }
  };

  // ── Mixer: one channel strip (gain → pan → master) per track ──────────────
  const ensureTrackChain = (trackId: string) => {
    let chain = trackChainsRef.current[trackId];
    if (!chain) {
      if (!limiterRef.current) return null;
      const gain = new Tone.Gain(volToGain(trackVolumeRef.current[trackId] ?? 100));
      const pan = new Tone.Panner(panToPan(trackPanRef.current[trackId] ?? 0));
      gain.connect(pan);
      pan.connect(limiterRef.current);
      chain = { gain, pan };
      trackChainsRef.current[trackId] = chain;
    }
    return chain;
  };

  const disposeTrackSynth = (trackId: string) => {
    const entry = trackSynthsRef.current[trackId];
    if (entry) {
      try { entry.inst.dispose(); } catch {}
      delete trackSynthsRef.current[trackId];
    }
  };

  // Track samplers share decoded buffers with every other track, so they
  // are only disconnected here — dispose() would nuke everyone's audio.
  const disposeTrackSampler = (trackId: string) => {
    const prefix = `${trackId}:`;
    Object.keys(trackSamplersRef.current).forEach(key => {
      if (key === trackId || key.startsWith(prefix)) {
        try { trackSamplersRef.current[key].disconnect(); } catch {}
        delete trackSamplersRef.current[key];
      }
    });
  };

  const disposeTrackSound = (trackId: string) => {
    disposeTrackSynth(trackId);
    disposeTrackSampler(trackId);
  };

  const disposeTrackChain = (trackId: string) => {
    disposeTrackSound(trackId);
    const chain = trackChainsRef.current[trackId];
    if (chain) {
      try { chain.gain.dispose(); } catch {}
      try { chain.pan.dispose(); } catch {}
      delete trackChainsRef.current[trackId];
    }
  };

  const ensureTrackSynth = (track: TrackDef) => {
    const existing = trackSynthsRef.current[track.id];
    if (existing && existing.type === track.type) return existing.inst;
    disposeTrackSynth(track.id);
    const chain = ensureTrackChain(track.id);
    if (!chain) return null;
    const inst = createToneInstrument(track.type);
    inst.connect(chain.gain);
    trackSynthsRef.current[track.id] = { inst, type: track.type };
    return inst;
  };

  const ensureTrackSamplerById = async (trackId: string, gmId: number) => {
    const key = samplerKey(trackId, gmId);
    const cached = trackSamplersRef.current[key];
    if (cached) return cached;
    const chain = ensureTrackChain(trackId);
    const player = soundFontPlayerRef.current;
    if (!chain || !player) return null;
    const sampler = await player.createTrackSampler(gmId, chain.gain);
    if (!sampler) return null;
    // Track may have been removed while loading.
    if (!trackChainsRef.current[trackId]) {
      try { sampler.dispose(); } catch {}
      return null;
    }
    trackSamplersRef.current[key] = sampler;
    return sampler;
  };

  const setTrackVolumeLive = (trackId: string, v: number) => {
    const vol = Math.max(0, Math.min(100, Math.round(v)));
    pushHistory();
    setTrackVolume(prev => ({ ...prev, [trackId]: vol }));
    const chain = trackChainsRef.current[trackId];
    if (chain) {
      try { chain.gain.gain.rampTo(volToGain(vol), 0.05); } catch {}
    }
  };

  const setTrackPanLive = (trackId: string, p: number) => {
    const pan = Math.max(-50, Math.min(50, Math.round(p)));
    pushHistory();
    setTrackPan(prev => ({ ...prev, [trackId]: pan }));
    const chain = trackChainsRef.current[trackId];
    if (chain) {
      try { chain.pan.pan.rampTo(panToPan(pan), 0.05); } catch {}
    }
  };

  // ── Damper pedal: held voices ────────────────────────────────────────────
  const heldVoicesRef = useRef<Record<string, Array<{ sampler?: Tone.Sampler; inst?: any; note: string }>>>({});
  const sustainPrevRef = useRef<Record<string, boolean>>({});

  // Call once per track per step: releases voices on pedal-up, reports state.
  const trackSustainTick = (trackId: string, step: number, time: number): boolean => {
    const down = sustainDownAt(trackId, step);
    if (sustainPrevRef.current[trackId] && !down) releaseTrackVoices(trackId, time);
    sustainPrevRef.current[trackId] = down;
    return down;
  };

  const sustainDownAt = (trackId: string, step: number): boolean => {
    const regions = trackSustainRef.current[trackId];
    if (!regions) return false;
    return regions.some(r => step >= r.down && step < r.up);
  };

  const releaseTrackVoices = (trackId: string, time?: number) => {
    const voices = heldVoicesRef.current[trackId];
    if (!voices || voices.length === 0) return;
    delete heldVoicesRef.current[trackId];
    const t = time !== undefined ? time : Tone.now();
    voices.forEach(v => {
      try {
        if (v.sampler) v.sampler.triggerRelease(v.note, t);
        else if (v.inst) v.inst.triggerRelease(v.note, t);
      } catch {}
    });
  };

  const releaseAllVoices = (time?: number) => {
    Object.keys(heldVoicesRef.current).forEach(id => releaseTrackVoices(id, time));
  };

  const refreshStepColCache = () => {
    const cache = Array.from({ length: stepCountRef.current }, () => ({ step: [] as HTMLElement[] }));
    document.querySelectorAll<HTMLElement>('[data-sequencer-step]').forEach(element => {
      const step = Number(element.dataset.sequencerStep);
      if (Number.isInteger(step) && cache[step]) cache[step].step.push(element);
    });
    stepColCacheRef.current = cache;
  };

  useEffect(() => { holdTonesRef.current = holdTones; }, [holdTones]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { trackEngineRef.current = trackEngine; }, [trackEngine]);
  useEffect(() => { trackVelocityRef.current = trackVelocity; }, [trackVelocity]);
  useEffect(() => { trackVolumeRef.current = trackVolume; }, [trackVolume]);
  useEffect(() => { trackPanRef.current = trackPan; }, [trackPan]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Y (or Ctrl/Cmd+Shift+Z) redo.
  // Skipped inside text fields so native text undo keeps working.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      if (k === 'z' && !e.shiftKey) undo();
      else redo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { mutedTracksRef.current = mutedTracks; }, [mutedTracks]);
  useEffect(() => { soloTracksRef.current = soloTracks; }, [soloTracks]);
  useEffect(() => { stepCountRef.current = stepCount; }, [stepCount]);
  useEffect(() => { autoFollowRef.current = autoFollow; }, [autoFollow]);
  useEffect(() => { arrangementClipsRef.current = arrangementClips; }, [arrangementClips]);
  useEffect(() => { activeViewRef.current = activeView; }, [activeView]);
  useEffect(() => {
    selectedTracksRef.current = selectedTracks;
    selectedTracksSetRef.current = new Set(selectedTracks);
  }, [selectedTracks]);

  useEffect(() => {
    if (isPlaying) {
      requestAnimationFrame(() => refreshStepColCache());
    }
  }, [tracks, isPlaying, stepCount]);

  useEffect(() => {
    try {
      Tone.Transport.bpm.rampTo(bpm, 0.05);
    } catch {
      // ignore before audio context is initialized
    }
  }, [bpm]);

  useEffect(() => {
    try {
      Tone.getContext().lookAhead = 0.1;
    } catch {}

    const masterLimiter = new Tone.Limiter(-1).toDestination();
    limiterRef.current = masterLimiter;

    const sfPlayer = new SoundFontPlayer(masterLimiter);
    soundFontPlayerRef.current = sfPlayer;
    sfPlayer.onStateChange = ({ instrumentId, state }) => {
      setSfStatus(prev => ({ ...prev, [instrumentId]: state }));
    };

    // Warm the GM sample maps, then build one mixer strip + sound per track
    // so volume/pan apply per track from the very first note. Every step
    // reports to the boot preloader; the app reveals itself when done.
    let cancelled = false;
    const finishBoot = () => {
      if (cancelled || bootedRef.current) return;
      bootedRef.current = true;
      setBoot(prev => ({ ...prev, done: prev.total, label: 'Ready' }));
      window.setTimeout(() => setBootVisible(false), 450);
    };
    (async () => {
      const showcaseGm = SHOWCASE_SONG.tracks.map(t => t.defaultGmId ?? 0);
      const gmIds = [...new Set([0, 24, 33, 48, 61, 81, 116, ...showcaseGm])];
      const sfJobs: { trackId: string; gmId: number }[] = [];
      tracks.forEach(track => {
        if ((trackEngine[track.id] ?? (track.type === 'soundfont' ? 'soundfont' : 'synth')) !== 'soundfont') return;
        sfJobs.push({ trackId: track.id, gmId: trackGmInstruments[track.id] ?? defaultGmForTrack(track) });
      });
      arrangementClips.forEach(clip => {
        if (clip.gmId !== undefined) sfJobs.push({ trackId: clip.trackId, gmId: clip.gmId });
      });
      const total = gmIds.length + sfJobs.length + tracks.length;
      let done = 0;
      const tick = (label: string) => {
        if (cancelled) return;
        done += 1;
        setBoot({ done, total, label });
      };
      setBoot({ done: 0, total, label: 'Downloading instruments…' });
      await Promise.all(gmIds.map(id =>
        sfPlayer.loadInstrument(id).catch(() => {}).finally(() => tick(`Downloading instruments… ${Math.min(done + 1, gmIds.length)}/${gmIds.length}`))
      ));
      if (cancelled) return;
      tracks.forEach(track => {
        ensureTrackChain(track.id);
        if ((trackEngine[track.id] ?? (track.type === 'soundfont' ? 'soundfont' : 'synth')) !== 'soundfont') {
          ensureTrackSynth(track);
        }
        tick('Warming up tracks…');
      });
      await Promise.all(sfJobs.map(job =>
        ensureTrackSamplerById(job.trackId, job.gmId).catch(() => {}).finally(() => tick('Warming up tracks…'))
      ));
      if (cancelled) return;
      finishBoot();
    })().catch(() => finishBoot());

    return () => {
      cancelled = true;
      try {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      } catch {}
      Object.keys(trackChainsRef.current).forEach(id => disposeTrackChain(id));
      trackChainsRef.current = {};
      trackSynthsRef.current = {};
      trackSamplersRef.current = {};
      try { limiterRef.current?.dispose(); } catch {}
      limiterRef.current = null;
      try { soundFontPlayerRef.current?.dispose(); } catch {}
      soundFontPlayerRef.current = null;
      stepColCacheRef.current = [];
    };
  }, []);

  const getTrackActiveNote = (trackDef: TrackDef) => {
    const selectedPresetId = trackPresetsRef.current[trackDef.id];
    const engine = trackEngineRef.current[trackDef.id] ?? (trackDef.type === 'soundfont' ? 'soundfont' : 'synth');
    const list = engine === 'soundfont' ? MIDI_NOTE_PRESETS : trackDef.presets;
    const preset = list.find(p => p.id === selectedPresetId) || trackDef.presets.find(p => p.id === selectedPresetId);
    return preset?.note || trackDef.note || 'C4';
  };

  const usesSoundFont = (trackDef: TrackDef) => {
    const engine = trackEngineRef.current[trackDef.id];
    if (engine) return engine === 'soundfont';
    return trackDef.type === 'soundfont';
  };

  // Single trigger path for every track: per-track Tone synth or per-track
  // SoundFont sampler, both routed through the track's mixer strip.
  // gmOverride plays this hit with a per-block instrument instead.
  const fireTrackSound = (trackDef: TrackDef, currentNote: string, triggerTime: number, velocity: number, duration: string | number = '8n', gmOverride?: number, sustainDown = false) => {
    try {
      if (usesSoundFont(trackDef)) {
        const gmId = gmOverride ?? trackGmInstrumentsRef.current[trackDef.id] ?? defaultGmForTrack(trackDef);
        const sampler = trackSamplersRef.current[samplerKey(trackDef.id, gmId)];
        if (!sampler || !samplerHasRoom(sampler, duration)) return;
        const note = currentNote || 'C4';
        if (sustainDown) {
          try {
            sampler.triggerAttack(note, triggerTime, velocity);
            (heldVoicesRef.current[trackDef.id] ||= []).push({ sampler, note });
          } catch {}
        } else {
          sampler.triggerAttackRelease(note, duration, triggerTime, velocity);
        }
        return;
      }
      const inst = ensureTrackSynth(trackDef);
      if (!inst) return;
      if (sustainDown && SUSTAIN_SYNTH_TYPES.includes(trackDef.type)) {
        const note = currentNote || 'C4';
        try {
          inst.triggerAttack(note, triggerTime, velocity);
          (heldVoicesRef.current[trackDef.id] ||= []).push({ inst, note });
        } catch {}
        return;
      }
      if (trackDef.type === 'membrane' || trackDef.type === 'sub808' || trackDef.type === 'tom') {
        inst.triggerAttackRelease(currentNote || 'C1', '8n', triggerTime, velocity);
      } else if (trackDef.type === 'noise') {
        inst.triggerAttackRelease(currentNote || '16n', triggerTime, velocity);
      } else if (trackDef.type === 'metal' || trackDef.type === 'metal_open' || trackDef.type === 'cowbell') {
        inst.triggerAttackRelease(currentNote || '32n', triggerTime, velocity);
      } else if (trackDef.type === 'fm' || trackDef.type === 'synth' || trackDef.type === 'rim') {
        inst.triggerAttackRelease(currentNote || 'C3', '8n', triggerTime, velocity);
      } else if (trackDef.type === 'acid' || trackDef.type === 'wobble') {
        inst.triggerAttackRelease(currentNote || 'C2', '8n', triggerTime, velocity);
      } else if (trackDef.type === 'pluck') {
        inst.triggerAttackRelease(currentNote || 'C4', '16n', triggerTime, velocity);
      } else {
        inst.triggerAttackRelease(currentNote || 'C4', '8n', triggerTime, velocity);
      }
    } catch {
      // timing collision
    }
  };

  const triggerInstrument = async (trackDef: TrackDef, time?: number) => {
    try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
      const triggerTime = time !== undefined ? Math.max(time, Tone.now()) : Tone.now();
      const currentNote = getTrackActiveNote(trackDef);
      const velocity = (trackVelocityRef.current[trackDef.id] ?? 100) / 127;

      if (usesSoundFont(trackDef)) {
        const gmId = trackGmInstrumentsRef.current[trackDef.id] ?? defaultGmForTrack(trackDef);
        await loadSoundFontInstrument(gmId);
        const sampler = await ensureTrackSamplerById(trackDef.id, gmId);
        if (!sampler || !samplerHasRoom(sampler, '8n')) return;
        sampler.triggerAttackRelease(currentNote || 'C4', '8n', triggerTime, velocity);
        return;
      }

      fireTrackSound(trackDef, currentNote, triggerTime, velocity);
    } catch {
      // overlapping audio thread collision
    }
  };

  const channelAudible = (trackId: string) => {
    if (!selectedTracksSetRef.current.has(trackId)) return false;
    if (mutedTracksRef.current[trackId]) return false;
    const anySolo = Object.values(soloTracksRef.current).some(Boolean);
    if (anySolo && !soloTracksRef.current[trackId]) return false;
    return true;
  };

  // Pause keeps the playhead position; full stop rewinds to the start.
  const pauseTransport = (reset: boolean) => {
    Tone.Transport.stop();
    releaseAllVoices();
    if (repeatIdRef.current !== null) {
      Tone.Transport.clear(repeatIdRef.current);
      repeatIdRef.current = null;
    }
    setIsPlaying(false);
    if (reset) stepRef.current = 0;
    const cache = stepColCacheRef.current;
    if (cache.length > 0) {
      cache.forEach(c => c.step.forEach(el => {
        el.classList.remove('step-current');
        el.classList.remove('note-playing');
      }));
    } else {
      document.querySelectorAll('.step-current, .note-playing').forEach(el => {
        el.classList.remove('step-current');
        el.classList.remove('note-playing');
      });
    }
    if (reset) {
      const playhead = document.querySelector<HTMLElement>('[data-arrangement-playhead]');
      if (playhead) {
        // Snap back instantly — the glide transition must not animate rewind.
        try {
          playhead.style.transition = 'none';
          playhead.style.left = '180px';
          void playhead.offsetWidth;
          playhead.style.transition = '';
        } catch {
          playhead.style.left = '180px';
        }
      }
      gridScrollRef.current?.scrollTo({ left: 0, behavior: 'auto' });
    }
  };

  const stopTransport = () => pauseTransport(true);

  // Jump the playhead to any step. Works paused or mid-playback — the next
  // scheduled tick continues from the new position.
  const seekToStep = (step: number) => {
    const steps = stepCountRef.current;
    const s = Math.max(0, Math.min(steps - 1, Math.floor(step)));
    releaseAllVoices();
    stepRef.current = s;
    document.querySelectorAll('.step-current, .note-playing').forEach(el => {
      el.classList.remove('step-current');
      el.classList.remove('note-playing');
    });
    // Make sure the window covers the target, then highlight after render.
    setWin(prev => {
      if (s >= prev.start && s < prev.end) return prev;
      const start = Math.max(0, Math.min(steps - 32, Math.floor((s - 96) / WIN_BUCKET) * WIN_BUCKET));
      return { start, end: Math.min(steps, start + 320) };
    });
    const playhead = document.querySelector<HTMLElement>('[data-arrangement-playhead]');
    const canvas = playhead?.parentElement;
    if (playhead && canvas) {
      playhead.style.left = `${180 + (s / steps) * (canvas.clientWidth - 180)}px`;
    }
    const scroller = gridScrollRef.current;
    const target = stepColCacheRef.current[s]?.step.find(el => el.classList.contains('pad-cell'));
    if (scroller && target) {
      const scrollerRect = scroller.getBoundingClientRect();
      const cellRect = target.getBoundingClientRect();
      scroller.scrollTo({ left: Math.max(0, scroller.scrollLeft + cellRect.left - scrollerRect.left - scroller.clientWidth / 2), behavior: 'auto' });
    }
    requestAnimationFrame(() => {
      refreshStepColCache();
      stepColCacheRef.current[s]?.step.forEach(el => el.classList.add('step-current'));
    });
  };

  const togglePlayback = async () => {
    try {
      if (isPlaying) {
        pauseTransport(false);
        return;
      }

      await Tone.start();
      Tone.Transport.bpm.value = bpmRef.current;
      refreshStepColCache();

      repeatIdRef.current = Tone.Transport.scheduleRepeat((time: number) => {
        const step = stepRef.current;
        const steps = stepCountRef.current;
        const currentGrid = gridRef.current;
        const currentHolds = holdTonesRef.current;
        const currentTracks = tracksRef.current;
        // Exact note lengths in seconds — coarse '8n'/'4n' buckets audibly
        // cut sustained piano lines short, so durations stay in steps here.
        const stepDurSec = 60 / bpmRef.current / 4;

        for (let i = 0; activeViewRef.current === 'steps' && i < currentTracks.length; i++) {
          const track = currentTracks[i];
          if (!channelAudible(track.id)) continue;
          if (!(currentGrid[track.id]?.[step] || currentHolds[track.id])) continue;

          // Same real block notes the arrangement plays — identical sound in
          // both views. Held tracks with no note here drone the track pitch.
          const sustainDown = trackSustainTick(track.id, step, time);
          let firedReal = false;
          arrangementClipsRef.current.forEach(clip => {
            if (clip.trackId !== track.id) return;
            const local = step - clip.start;
            if (local < 0 || local >= clip.length) return;
            clip.notes.filter(note => note.start === local).forEach(note => {
              const durSec = Math.max(0.05, note.duration * stepDurSec);
              fireTrackSound(track, midiNoteName(note.pitch), time, note.velocity / 127, durSec, clip.gmId, sustainDown);
              firedReal = true;
            });
          });
          if (!firedReal) {
            const currentNote = getTrackActiveNote(track);
            const velocity = (trackVelocityRef.current[track.id] ?? 100) / 127;
            fireTrackSound(track, currentNote, time, velocity);
          }
        }

        if (activeViewRef.current === 'arrangement') {
          arrangementClipsRef.current.forEach(clip => {
            const localStep = step - clip.start;
            if (localStep < 0 || localStep >= clip.length || !channelAudible(clip.trackId)) return;
            const track = currentTracks.find(item => item.id === clip.trackId);
            if (!track) return;
            const sustainDown = trackSustainTick(track.id, step, time);
            clip.notes.filter(note => note.start === localStep).forEach(note => {
              const noteName = midiNoteName(note.pitch);
              const velocity = note.velocity / 127;
              const durSec = Math.max(0.05, note.duration * stepDurSec);
              fireTrackSound(track, noteName, time, velocity, durSec, clip.gmId, sustainDown);
            });
          });
        }

        Tone.Draw.schedule(() => {
          const playhead = document.querySelector<HTMLElement>('[data-arrangement-playhead]');
          const canvas = playhead?.parentElement;
          if (playhead && canvas) {
            // Glide (one step duration) instead of jumping each tick.
            try {
              playhead.style.transition = `left ${(60 / bpmRef.current / 4).toFixed(3)}s linear`;
              playhead.style.left = `${180 + (step / steps) * (canvas.clientWidth - 180)}px`;
            } catch {
              playhead.style.left = `${180 + (step / steps) * (canvas.clientWidth - 180)}px`;
            }
            // Keep the playhead in view with a smooth cruise — retargeting a
            // smooth scroll every tick glides instead of jumping.
            const laneScroller = playhead.closest('.arrangement-scroll') as HTMLElement | null;
            if (laneScroller) {
              const pr = playhead.getBoundingClientRect();
              const sr = laneScroller.getBoundingClientRect();
              if (pr.left < sr.left + 200 || pr.right > sr.right - 80) {
                laneScroller.scrollTo({ left: Math.max(0, laneScroller.scrollLeft + pr.left - sr.left - laneScroller.clientWidth * 0.35) });
              }
            }
          }
          let cache = stepColCacheRef.current;
          if (cache.length === 0) {
            refreshStepColCache();
            cache = stepColCacheRef.current;
          }
          const prevStep = (step - 1 + steps) % steps;
          cache[prevStep]?.step.forEach(el => {
            el.classList.remove('step-current');
            el.classList.remove('note-playing');
          });
          cache[step]?.step.forEach(el => el.classList.add('step-current'));

          const scroller = gridScrollRef.current;
          // Highlight sounding pads. Vertical position is NEVER touched here —
          // the user owns up/down scrolling; follow only cruises sideways.
          cache[step]?.step.forEach(element => {
            const trackId = element.dataset.trackId;
            if (element.classList.contains('pad-cell') && !!trackId
              && channelAudible(trackId)
              && !!(currentGrid[trackId]?.[step] || currentHolds[trackId])) {
              element.classList.add('note-playing');
            }
          });
          const horizontalTarget = cache[step]?.step.find(el => el.classList.contains('pad-cell'));
          // Don't yank the grid while a dropdown menu has focus: browsers
          // instantly dismiss an open <select> popup when an ancestor scrolls.
          const focusedEl = document.activeElement as HTMLElement | null;
          const menuOpen = !!focusedEl && focusedEl.tagName === 'SELECT';
          if (autoFollowRef.current && scroller && horizontalTarget && !menuOpen) {
            const scrollerRect = scroller.getBoundingClientRect();
            const cellRect = horizontalTarget.getBoundingClientRect();
            const stickyControlsWidth = 340;
            const safeLeft = scrollerRect.left + stickyControlsWidth;
            const safeRight = scrollerRect.right - 72;
            const nextLeft = (cellRect.left < safeLeft || cellRect.right > safeRight)
              ? Math.max(0, scroller.scrollLeft + cellRect.left - safeLeft)
              : scroller.scrollLeft;
            if (nextLeft !== scroller.scrollLeft) {
              // No behavior flag: the container's smooth scroll-behavior glides.
              scroller.scrollTo({ left: nextLeft, top: scroller.scrollTop });
            }
          }
        }, time);

        stepRef.current = (step + 1) % steps;
      }, '16n');

      Tone.Transport.start();
      setIsPlaying(true);
    } catch (err) {
      console.error('Playback failed to start:', err);
    }
  };

  // Step pads write straight through to arrangement clips: toggling a lit
  // pad removes the note(s) starting there, toggling a dark one adds a note
  // (creating a 1-bar block if no block covers that step yet).
  const togglePad = (trackId: string, stepIdx: number) => {
    // Release dropdown focus so follow-playhead resumes after menu use.
    const focused = document.activeElement as HTMLElement | null;
    if (focused && focused.tagName === 'SELECT') focused.blur();
    pushHistory();
    const track = tracksRef.current.find(t => t.id === trackId);
    const pitch = track ? getMidiPitchForTrack(track) : 60;
    const vel = trackVelocityRef.current[trackId] ?? 100;
    const stamp = Date.now();
    const rnd = Math.floor(Math.random() * 1000000);
    setArrangementClips(prev => {
      const covering = prev.filter(c => c.trackId === trackId && stepIdx >= c.start && stepIdx < c.start + c.length);
      const lit = covering.some(c => c.notes.some(n => n.start === stepIdx - c.start));
      if (lit) {
        return prev.map(c => {
          if (c.trackId !== trackId || stepIdx < c.start || stepIdx >= c.start + c.length) return c;
          const local = stepIdx - c.start;
          const notes = c.notes.filter(n => n.start !== local);
          return notes.length === c.notes.length ? c : { ...c, notes };
        });
      }
      if (covering.length > 0) {
        const target = covering[0];
        const local = stepIdx - target.start;
        return prev.map(c => (c.id === target.id
          ? { ...c, notes: [...c.notes, { id: `n_${stamp}_${rnd}`, pitch, start: local, duration: 1, velocity: vel }] }
          : c));
      }
      const start = Math.min(Math.floor(stepIdx / 16) * 16, Math.max(0, stepCountRef.current - 16));
      const length = Math.min(16, stepCountRef.current - start);
      const fresh: InstrumentClip = {
        id: `clip_${stamp}_${rnd}`, trackId,
        name: `Pattern ${prev.filter(c => c.trackId === trackId).length + 1}`,
        start, length,
        notes: [{ id: `n_${stamp}_${rnd}`, pitch, start: stepIdx - start, duration: 1, velocity: vel }]
      };
      return [...prev, fresh];
    });
  };

  const toggleTrackSelect = (trackId: string) => {
    pushHistory();
    setSelectedTracks(prev =>
      prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]
    );
  };

  const toggleHold = (trackId: string) => {
    pushHistory();
    setHoldTones(prev => {
      const next = { ...prev, [trackId]: !prev[trackId] };
      if (next[trackId] && !isPlayingRef.current) {
        const def = tracksRef.current.find(t => t.id === trackId);
        if (def) triggerInstrument(def);
      }
      return next;
    });
  };

  const resizeGrid = (nextSteps: number) => {
    // Clips carry the music, so resizing only moves the timeline window —
    // the projected grid follows automatically.
    nextSteps = normalizeStepCount(nextSteps);
    if (nextSteps !== stepCountRef.current) pushHistory();
    stepCountRef.current = nextSteps;
    setStepCount(nextSteps);
  };

  const extendTimeline = (extraSteps: number) => {
    const target = normalizeStepCount(stepCountRef.current + extraSteps);
    if (target <= stepCountRef.current) return;
    resizeGrid(target);
  };

  const clearGrid = () => {
    pushHistory();
    setArrangementClips([]);
  };

  const addChannel = (template?: TrackDef) => {
    const index = tracks.length;
    const id = `ch_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const src = template || {
      id,
      name: `Channel ${index + 1}`,
      category: 'SoundFont Instruments' as TrackCategory,
      type: 'soundfont' as SynthType,
      note: 'C4',
      color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
      presets: MIDI_NOTE_PRESETS,
      defaultGmId: 0
    };
    const track: TrackDef = {
      ...src,
      id,
      name: template ? `${template.name} ${index + 1}` : src.name,
      presets: src.type === 'soundfont' || !template ? MIDI_NOTE_PRESETS : [...src.presets]
    };
    const gmId = defaultGmForTrack(track);
    pushHistory();
    setTracks(prev => [...prev, track]);
    setSelectedTracks(prev => [...prev, id]);
    setTrackPresets(prev => ({ ...prev, [id]: track.type === 'soundfont' ? track.note : (track.presets[0]?.id || 'C4') }));
    setTrackEngine(prev => ({ ...prev, [id]: 'soundfont' }));
    setTrackGmInstruments(prev => ({ ...prev, [id]: gmId }));
    setTrackVelocity(prev => ({ ...prev, [id]: 100 }));
    setTrackVolume(prev => ({ ...prev, [id]: 100 }));
    setTrackPan(prev => ({ ...prev, [id]: 0 }));
    loadSoundFontInstrument(gmId);
    ensureTrackChain(id);
    ensureTrackSamplerById(id, gmId).catch(() => {});
  };

  const removeChannel = (trackId: string) => {
    if (tracksRef.current.length <= 1) return;
    pushHistory();
    setTracks(prev => prev.filter(t => t.id !== trackId));
    setSelectedTracks(prev => prev.filter(id => id !== trackId));
    setArrangementClips(prev => prev.filter(clip => clip.trackId !== trackId));
    setHoldTones(prev => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
    setMutedTracks(prev => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
    setSoloTracks(prev => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
    setTrackVolume(prev => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
    setTrackPan(prev => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
    setTrackSustain(prev => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
    releaseTrackVoices(trackId);
    disposeTrackChain(trackId);
  };

  const setChannelEngine = (track: TrackDef, engine: TrackEngine) => {
    pushHistory();
    releaseTrackVoices(track.id);
    setTrackEngine(prev => ({ ...prev, [track.id]: engine }));
    if (engine === 'soundfont') {
      disposeTrackSynth(track.id);
      const gmId = trackGmInstrumentsRef.current[track.id] ?? defaultGmForTrack(track);
      setTrackGmInstruments(prev => ({ ...prev, [track.id]: gmId }));
      const note = getTrackActiveNote(track);
      const safeNote = note.endsWith('n') ? (track.note && !track.note.endsWith('n') ? track.note : 'C4') : note;
      setTrackPresets(prev => ({ ...prev, [track.id]: safeNote }));
      loadSoundFontInstrument(gmId);
      ensureTrackSamplerById(track.id, gmId).catch(() => {});
    } else {
      disposeTrackSampler(track.id);
      ensureTrackSynth(track);
    }
  };

  const setChannelInstrument = async (track: TrackDef, gmId: number) => {
    pushHistory();
    releaseTrackVoices(track.id);
    setTrackGmInstruments(prev => ({ ...prev, [track.id]: gmId }));
    setTrackEngine(prev => ({ ...prev, [track.id]: 'soundfont' }));
    const gm = GM_INSTRUMENTS[gmId];
    if (gm) {
      setTracks(prev => prev.map(t => t.id === track.id ? { ...t, name: gm.name } : t));
    }
    const currentNote = getTrackActiveNote(track);
    const note = !currentNote || currentNote.endsWith('n')
      ? (track.note && !track.note.endsWith('n') ? track.note : 'C4')
      : currentNote;
    setTrackPresets(prev => ({ ...prev, [track.id]: note }));
    await loadSoundFontInstrument(gmId);
    const sampler = await ensureTrackSamplerById(track.id, gmId);
    sampler?.triggerAttackRelease(note, '8n', Tone.now(), (trackVelocityRef.current[track.id] ?? 100) / 127);
  };

  // Per-block instrument: give one clip its own GM sound, or reset it to null
  // to follow its track again.
  const setClipInstrument = (clipId: string, gmId: number | null) => {
    const clip = arrangementClipsRef.current.find(c => c.id === clipId);
    if (!clip) return;
    pushHistory();
    setArrangementClips(prev => prev.map(c => {
      if (c.id !== clipId) return c;
      const next = { ...c };
      if (gmId === null) delete next.gmId;
      else next.gmId = gmId;
      return next;
    }));
    if (gmId !== null) ensureTrackSamplerById(clip.trackId, gmId).catch(() => {});
  };

  const applyInstrumentToAll = async (gmId: number) => {
    pushHistory();
    setApplyAllGm(gmId);
    setTrackEngine(prev => {
      const next = { ...prev };
      tracks.forEach(t => { next[t.id] = 'soundfont'; });
      return next;
    });
    setTrackGmInstruments(prev => {
      const next = { ...prev };
      tracks.forEach(t => { next[t.id] = gmId; });
      return next;
    });
    await loadSoundFontInstrument(gmId);
    tracks.forEach(t => {
      disposeTrackSynth(t.id);
      ensureTrackSamplerById(t.id, gmId).catch(() => {});
    });
    // Keep channel names; only the GM program changes.
  };

  const getMidiPitchForTrack = (track: TrackDef): number => {
    const activeNote = getTrackActiveNote(track);
    if (!activeNote || activeNote.endsWith('n')) {
      const fallbackPitchMapping: Record<string, number> = {
        kick: 36, sub_808: 34, snare: 38, clap: 39, hihat: 42, openhat: 46,
        tom: 45, rimshot: 37, cowbell: 56, bass: 36, acid_bass: 41,
        synth_lead: 60, pluck: 64, chord_pad: 55, space_pad: 48, wobble: 38
      };
      return fallbackPitchMapping[track.id] || 60;
    }
    try {
      return Math.round(Tone.Frequency(activeNote).toMidi());
    } catch {
      return 60;
    }
  };

  const exportMidi = () => {
    try {
      const midi = new Midi();
      midi.header.tempos = [{ bpm: bpm, ticks: 0 }];
      midi.header.timeSignatures = [{ timeSignature: [4, 4], ticks: 0 }];
      midi.header.update();

      const ppq = midi.header.ppq || 480;
      const ticksPer16th = Math.round(ppq / 4);
      let notesAdded = 0;

      tracks.forEach((track, channelIndex) => {
        if (activeView === 'arrangement') return;
        if (!selectedTracks.includes(track.id)) return;
        if (mutedTracks[track.id]) return;

        const trackNotes = grid[track.id];
        const isHeld = holdTones[track.id];
        const midiTrack = midi.addTrack();
        const gmId = trackGmInstruments[track.id] ?? defaultGmForTrack(track);
        const gmInst = GM_INSTRUMENTS[gmId];
        const sf = (trackEngine[track.id] ?? (track.type === 'soundfont' ? 'soundfont' : 'synth')) === 'soundfont';

        midiTrack.name = sf && gmInst ? gmInst.name : track.name;
        midiTrack.channel = Math.min(15, channelIndex);
        if (sf) midiTrack.instrument.number = gmId;

        const midiPitch = getMidiPitchForTrack(track);
        const vel = ((trackVelocity[track.id] ?? 100) / 127) * ((trackVolume[track.id] ?? 100) / 100);

        for (let s = 0; s < stepCount; s++) {
          if (trackNotes?.[s] || isHeld) {
            midiTrack.addNote({
              midi: midiPitch,
              ticks: s * ticksPer16th,
              durationTicks: Math.max(1, Math.round(ticksPer16th * 0.85)),
              velocity: vel
            });
            notesAdded++;
          }
        }
      });

      if (activeView === 'arrangement') {
        arrangementClips.forEach((clip, clipIndex) => {
          const track = tracks.find(item => item.id === clip.trackId);
          if (!track || !selectedTracks.includes(track.id) || mutedTracks[track.id]) return;
          const midiTrack = midi.addTrack();
          const gmId = trackGmInstruments[track.id] ?? defaultGmForTrack(track);
          midiTrack.name = `${track.name} — ${clip.name}`;
          midiTrack.channel = Math.min(15, clipIndex);
          midiTrack.instrument.number = gmId;
          const mix = (trackVolume[track.id] ?? 100) / 100;
          const clipGm = clip.gmId ?? gmId;
          midiTrack.instrument.number = clipGm;
          if (clip.gmId !== undefined) {
            midiTrack.name = `${track.name} — ${clip.name} (${GM_INSTRUMENTS[clipGm]?.name ?? 'custom'})`;
          }
          clip.notes.forEach(note => {
            midiTrack.addNote({
              midi: note.pitch,
              ticks: (clip.start + note.start) * ticksPer16th,
              durationTicks: Math.max(1, note.duration * ticksPer16th),
              velocity: (note.velocity / 127) * mix
            });
            notesAdded++;
          });
        });
      }

      if (notesAdded === 0) {
        alert('No notes or active tracks to export! Toggle some pads or hold buttons first.');
        return;
      }

      const uint8 = midi.toArray();
      const blob = new Blob([uint8.buffer as ArrayBuffer], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `snuzy_beat_${Date.now()}.mid`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err: any) {
      console.error('Error exporting MIDI:', err);
      alert('Failed to export MIDI: ' + (err?.message || err));
    }
  };

  const exportProject = () => {
    try {
      const projectData = {
        app: 'snuzy-workstation',
        version: '3.0',
        timestamp: Date.now(),
        bpm,
        stepCount,
        tracks,
        trackPresets,
        trackGmInstruments,
        trackEngine,
        trackVelocity,
        trackVolume,
        trackPan,
        trackSustain,
        selectedTracks,
        holdTones,
        mutedTracks,
        soloTracks,
        arrangementClips
      };

      const jsonStr = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `snuzy_project_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err: any) {
      console.error('Error exporting project:', err);
      alert('Failed to export project: ' + (err?.message || err));
    }
  };

  const showToast = (fileName: string, title = 'MIDI IMPORTED', sub = 'Mapped to sequencer channels', ms = 3500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setMidiToast({ visible: true, fileName, title, sub });
    toastTimerRef.current = setTimeout(() => {
      setMidiToast(prev => ({ ...prev, visible: false }));
    }, ms);
  };

  // ── Undo / redo: full-song snapshots ─────────────────────────────────────
  interface SongSnapshot {
    bpm: number;
    stepCount: number;
    tracks: TrackDef[];
    grid: Record<string, boolean[]>;
    trackPresets: Record<string, string>;
    trackGmInstruments: Record<string, number>;
    trackEngine: Record<string, TrackEngine>;
    trackVelocity: Record<string, number>;
    trackVolume: Record<string, number>;
    trackPan: Record<string, number>;
    trackSustain: Record<string, { down: number; up: number }[]>;
    selectedTracks: string[];
    holdTones: Record<string, boolean>;
    mutedTracks: Record<string, boolean>;
    soloTracks: Record<string, boolean>;
    arrangementClips: InstrumentClip[];
  }

  const MAX_HISTORY = 50;
  const pastRef = useRef<SongSnapshot[]>([]);
  const futureRef = useRef<SongSnapshot[]>([]);
  const lastPushRef = useRef<number>(0);
  const [histLen, setHistLen] = useState({ past: 0, future: 0 });

  const currentSnapshot = (): SongSnapshot => ({
    bpm: bpmRef.current,
    stepCount: stepCountRef.current,
    tracks: tracksRef.current,
    grid: gridRef.current,
    trackPresets: trackPresetsRef.current,
    trackGmInstruments: trackGmInstrumentsRef.current,
    trackEngine: trackEngineRef.current,
    trackVelocity: trackVelocityRef.current,
    trackVolume: trackVolumeRef.current,
    trackPan: trackPanRef.current,
    trackSustain: trackSustainRef.current,
    selectedTracks: selectedTracksRef.current,
    holdTones: holdTonesRef.current,
    mutedTracks: mutedTracksRef.current,
    soloTracks: soloTracksRef.current,
    arrangementClips: arrangementClipsRef.current,
  });

  // Pushes the CURRENT (pre-edit) state. Calls closer than 1s apart coalesce,
  // so one block drag or slider sweep is a single undo step.
  const pushHistory = () => {
    const now = Date.now();
    if (now - lastPushRef.current < 1000) return;
    lastPushRef.current = now;
    try {
      pastRef.current.push(structuredClone(currentSnapshot()));
    } catch {
      return;
    }
    if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift();
    futureRef.current = [];
    setHistLen({ past: pastRef.current.length, future: 0 });
  };

  const syncTrackSounds = (
    list: TrackDef[],
    gmMap: Record<string, number>,
    engMap: Record<string, TrackEngine>,
    volMap: Record<string, number>,
    panMap: Record<string, number>
  ) => {
    const ids = new Set(list.map(t => t.id));
    Object.keys(trackChainsRef.current).forEach(id => {
      if (!ids.has(id)) disposeTrackChain(id);
    });
    list.forEach(t => {
      const chain = ensureTrackChain(t.id);
      if (chain) {
        try {
          chain.gain.gain.rampTo(volToGain(volMap[t.id] ?? 100), 0.03);
          chain.pan.pan.rampTo(panToPan(panMap[t.id] ?? 0), 0.03);
        } catch {}
      }
      const eng = engMap[t.id] ?? (t.type === 'soundfont' ? 'soundfont' : 'synth');
      if (eng === 'soundfont') {
        ensureTrackSamplerById(t.id, gmMap[t.id] ?? defaultGmForTrack(t)).catch(() => {});
      } else {
        ensureTrackSynth(t);
      }
    });
  };

  const applySnapshot = (snap: SongSnapshot) => {
    setBpm(snap.bpm);
    stepCountRef.current = snap.stepCount;
    setStepCount(snap.stepCount);
    setTracks(snap.tracks);
    // No setGrid: the projected grid rebuilds itself from tracks + clips.
    setTrackPresets(snap.trackPresets);
    setTrackGmInstruments(snap.trackGmInstruments);
    setTrackEngine(snap.trackEngine);
    setTrackVelocity(snap.trackVelocity);
    setTrackVolume(snap.trackVolume);
    setTrackPan(snap.trackPan);
    releaseAllVoices();
    setTrackSustain(snap.trackSustain ?? {});
    setSelectedTracks(snap.selectedTracks);
    setHoldTones(snap.holdTones);
    setMutedTracks(snap.mutedTracks);
    setSoloTracks(snap.soloTracks);
    setArrangementClips(snap.arrangementClips);
    stepColCacheRef.current = [];
    syncTrackSounds(snap.tracks, snap.trackGmInstruments, snap.trackEngine, snap.trackVolume, snap.trackPan);
  };

  const undo = () => {
    const past = pastRef.current;
    if (past.length === 0) return;
    try {
      futureRef.current.push(structuredClone(currentSnapshot()));
    } catch { return; }
    const snap = past.pop()!;
    applySnapshot(snap);
    setHistLen({ past: past.length, future: futureRef.current.length });
  };

  const redo = () => {
    const future = futureRef.current;
    if (future.length === 0) return;
    try {
      pastRef.current.push(structuredClone(currentSnapshot()));
    } catch { return; }
    const snap = future.pop()!;
    applySnapshot(snap);
    setHistLen({ past: pastRef.current.length, future: future.length });
  };

  // Whole-site right-click handling (no native menu / Inspect anywhere):
  // right-click on tracks/blocks opens their toolbox, anywhere else
  // (including the page sides) opens the Song tools menu.
  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      const el = e.target as HTMLElement;
      // Leave text-field editing alone.
      if (el.closest?.('.piano-roll-toolbar')) return;
      const clipEl = el.closest?.('[data-ctx-clip]');
      const trackEl = el.closest?.('[data-ctx-track]');
      setCtxMenu({
        x: e.clientX,
        y: e.clientY,
        trackId: trackEl ? trackEl.getAttribute('data-ctx-track') : null,
        clipId: clipEl ? clipEl.getAttribute('data-ctx-clip') : null,
      });
    };
    window.addEventListener('contextmenu', onCtx);
    return () => window.removeEventListener('contextmenu', onCtx);
  }, []);

  // Rescue click: clicking the page background (outside the workspace)
  // clears every mute and solo so the full song plays again.
  // Arm states are left untouched — this only unmutes/unsolos.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (document.querySelector('.ctx-menu')) return;
      // Clicks from an already-closed menu hit a detached node — ignore them,
      // or picking Solo/Mute from the menu would instantly undo itself.
      if (!(e.target instanceof Node) || !e.target.isConnected) return;
      const root = workspaceRef.current;
      if (root && root.contains(e.target)) return;
      const hasMute = Object.values(mutedTracksRef.current).some(Boolean);
      const hasSolo = Object.values(soloTracksRef.current).some(Boolean);
      if (!hasMute && !hasSolo) return;
      setMutedTracks({});
      setSoloTracks({});
      pushHistory();
      showToast('Muted and soloed tracks reset — everything plays', 'FULL MIX', '', 2500);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyProjectData = (data: any, label: string) => {
    pushHistory();
    if (typeof data.bpm === 'number') setBpm(data.bpm);
    if (typeof data.stepCount === 'number') {
      const importedStepCount = normalizeStepCount(data.stepCount);
      stepCountRef.current = importedStepCount;
      setStepCount(importedStepCount);
    }
    if (Array.isArray(data.tracks) && data.tracks.length > 0) setTracks(data.tracks);
    if (data.trackPresets) setTrackPresets(data.trackPresets);
    if (data.trackGmInstruments) setTrackGmInstruments(data.trackGmInstruments);
    if (data.trackEngine) setTrackEngine(data.trackEngine);
    if (data.trackVelocity) setTrackVelocity(data.trackVelocity);
    if (data.trackVolume) {
      setTrackVolume(data.trackVolume);
      Object.entries(data.trackVolume as Record<string, number>).forEach(([id, v]) => {
        const chain = trackChainsRef.current[id];
        if (chain) { try { chain.gain.gain.rampTo(volToGain(v), 0.05); } catch {} }
      });
    }
    if (data.trackPan) {
      setTrackPan(data.trackPan);
      Object.entries(data.trackPan as Record<string, number>).forEach(([id, p]) => {
        const chain = trackChainsRef.current[id];
        if (chain) { try { chain.pan.pan.rampTo(panToPan(p), 0.05); } catch {} }
      });
    }
    if (data.selectedTracks) setSelectedTracks(data.selectedTracks);
    if (data.holdTones) setHoldTones(data.holdTones);
    if (data.mutedTracks) setMutedTracks(data.mutedTracks);
    if (data.soloTracks) setSoloTracks(data.soloTracks);
    if (Array.isArray(data.arrangementClips)) {
      setArrangementClips(data.arrangementClips);
      setActiveView('arrangement');
    } else if (data.grid && Array.isArray(data.tracks)) {
      // Legacy step-only project: fold each grid row into one full-length clip.
      const len = normalizeStepCount(typeof data.stepCount === 'number' ? data.stepCount : DEFAULT_STEPS);
      const stamp = Date.now();
      const legacy: InstrumentClip[] = [];
      (data.tracks as TrackDef[]).forEach((t, i) => {
        const row: boolean[] = (data.grid as Record<string, boolean[]>)[t.id] || [];
        const steps: number[] = [];
        for (let s = 0; s < Math.min(row.length, len); s++) if (row[s]) steps.push(s);
        if (steps.length === 0) return;
        let pitch = 60;
        try {
          const note = t.note && !t.note.endsWith('n') ? t.note : 'C4';
          pitch = Math.round(Tone.Frequency(note).toMidi());
        } catch {}
        const vel = (data.trackVelocity as Record<string, number> | undefined)?.[t.id] ?? 100;
        legacy.push({
          id: `clip_legacy_${stamp}_${i}`, trackId: t.id, name: `${t.name} (imported)`,
          start: 0, length: len,
          notes: steps.map((s, k) => ({ id: `n_legacy_${stamp}_${i}_${k}`, pitch, start: s, duration: 1, velocity: vel }))
        });
      });
      setArrangementClips(legacy);
      setActiveView('steps');
    } else {
      setActiveView('steps');
    }
    if (data.trackSustain) setTrackSustain(data.trackSustain);
    releaseAllVoices();
    sustainPrevRef.current = {};
    const programs = new Set<number>(Object.values((data.trackGmInstruments || {}) as Record<string, number>));
    programs.forEach(program => loadSoundFontInstrument(program));
    if (Array.isArray(data.tracks)) {
      const freshIds = new Set((data.tracks as TrackDef[]).map(t => t.id));
      Object.keys(trackChainsRef.current).forEach(id => {
        if (!freshIds.has(id)) disposeTrackChain(id);
      });
      (data.tracks as TrackDef[]).forEach(t => {
        ensureTrackChain(t.id);
        const eng = (data.trackEngine as Record<string, TrackEngine> | undefined)?.[t.id]
          ?? (t.type === 'soundfont' ? 'soundfont' : 'synth');
        if (eng === 'soundfont') {
          const g = (data.trackGmInstruments as Record<string, number> | undefined)?.[t.id] ?? defaultGmForTrack(t);
          ensureTrackSamplerById(t.id, g).catch(() => {});
        } else {
          ensureTrackSynth(t);
        }
      });
    }
    showToast(label);
  };

  const applyMidiObject = (imported: Midi, fileName: string) => {
    if (isPlaying) stopTransport();
    stepColCacheRef.current = [];
    pushHistory();

    const ppq = imported.header.ppq || 480;
    const ticksPer16th = ppq / 4;
    const lastNoteEndTicks = imported.tracks.reduce((latest, track) => (
      track.notes.reduce((trackLatest, note) => (
        Math.max(trackLatest, note.ticks + note.durationTicks)
      ), latest)
    ), 0);
    const rawStepCount = Math.max(16, Math.ceil(lastNoteEndTicks / ticksPer16th));
    const importWasTruncated = rawStepCount > MAX_STEPS;
    const importedStepCount = normalizeStepCount(Math.min(rawStepCount, MAX_STEPS));

    if (imported.header.tempos && imported.header.tempos.length > 0) {
      const fileBpm = Math.round(imported.header.tempos[0].bpm);
      if (fileBpm >= 40 && fileBpm <= 300) setBpm(fileBpm);
    }

    const instrumentTracks = imported.tracks.filter(t => t.notes.length > 0);
    const nextTracks: TrackDef[] = [];
    const nextGm: Record<string, number> = {};
    const nextEngine: Record<string, TrackEngine> = {};
    const nextPresets: Record<string, string> = {};
    const nextVel: Record<string, number> = {};
    const nextSelected: string[] = [];
    const nextClips: InstrumentClip[] = [];
    const nextSustain: Record<string, { down: number; up: number }[]> = {};
    const programsToLoad = new Set<number>();
    const importId = Date.now();

    instrumentTracks.forEach((t, i) => {
      // Drum-channel tracks usually carry no program: give them Taiko Drum
      // instead of a piano, or every kick would play as Acoustic Grand.
      const gmProg = typeof t.instrument?.number === 'number'
        ? Math.max(0, Math.min(127, t.instrument.number))
        : (t.channel === 9 ? 116 : 0);
      const gm = GM_INSTRUMENTS[gmProg];
      const trackName = (t.name || (gm as { name?: string })?.name || `MIDI Track ${i + 1}`).slice(0, 48);
      const channelIndex = nextTracks.length;
      const id = `midi_${importId}_${i}`;

      const pitchCounts = new Map<number, number>();
      t.notes.forEach(n => pitchCounts.set(n.midi, (pitchCounts.get(n.midi) || 0) + 1));
      let repPitch = 60;
      let repCount = -1;
      pitchCounts.forEach((count, pitch) => {
        if (count > repCount) { repCount = count; repPitch = pitch; }
      });
      const repName = midiNoteName(Math.max(21, Math.min(108, repPitch)));
      const avgVel = Math.round(
        (t.notes.reduce((sum, note) => sum + note.velocity, 0) / Math.max(1, t.notes.length)) * 127
      );

      const track: TrackDef = {
        id,
        name: trackName,
        category: 'SoundFont Instruments',
        type: 'soundfont',
        note: repName,
        color: CHANNEL_COLORS[channelIndex % CHANNEL_COLORS.length],
        presets: MIDI_NOTE_PRESETS,
        defaultGmId: gmProg
      };

      nextTracks.push(track);
      nextGm[id] = gmProg;
      nextEngine[id] = 'soundfont';
      nextPresets[id] = repName;
      nextVel[id] = Math.max(1, Math.min(127, avgVel));
      nextSelected.push(id);
      programsToLoad.add(gmProg);

      const quantized = t.notes.map((note, idx) => {
        const globalStep = Math.round(note.ticks / ticksPer16th);
        const durationSteps = Math.max(1, Math.round(note.durationTicks / ticksPer16th));
        return {
          globalStep,
          pitch: Math.max(0, Math.min(127, note.midi)),
          durationSteps,
          velocity: Math.max(1, Math.min(127, Math.round(note.velocity * 127))),
          idx
        };
      }).filter(q => q.globalStep < importedStepCount)
        .sort((a, b) => a.globalStep - b.globalStep || a.pitch - b.pitch);

      // Damper pedal (CC64) → sustain regions in song steps.
      const cc64 = ((t.controlChanges?.[64] || []) as { ticks: number; value: number }[])
        .slice().sort((a, b) => a.ticks - b.ticks);
      const regions: { down: number; up: number }[] = [];
      let pedalDown: number | null = null;
      cc64.forEach(ev => {
        const atStep = Math.round(ev.ticks / ticksPer16th);
        if (ev.value >= 0.5) {
          if (pedalDown === null) pedalDown = Math.max(0, Math.min(importedStepCount - 1, atStep));
        } else if (pedalDown !== null) {
          regions.push({ down: pedalDown, up: Math.max(pedalDown + 1, Math.min(importedStepCount, atStep)) });
          pedalDown = null;
        }
      });
      if (pedalDown !== null) regions.push({ down: pedalDown, up: importedStepCount });
      if (regions.length > 0) nextSustain[id] = regions;

      const numBlocks = Math.ceil(importedStepCount / ENDLESS_BLOCK_STEPS);
      for (let b = 0; b < numBlocks; b++) {
        const blockStart = b * ENDLESS_BLOCK_STEPS;
        const blockLen = Math.min(ENDLESS_BLOCK_STEPS, importedStepCount - blockStart);
        const blockNotes = quantized.filter(
          q => q.globalStep >= blockStart && q.globalStep < blockStart + blockLen
        );
        if (blockNotes.length === 0) continue;
        nextClips.push({
          id: `clip_${importId}_${i}_${b}`,
          trackId: id,
          name: `${trackName} · ${b + 1}/${numBlocks}`,
          start: blockStart,
          length: blockLen,
          notes: blockNotes.map(q => ({
            id: `n_${importId}_${i}_${b}_${q.idx}`,
            pitch: q.pitch,
            start: q.globalStep - blockStart,
            duration: Math.min(q.durationSteps, blockLen - (q.globalStep - blockStart) + 8),
            velocity: q.velocity
          }))
        });
      }
    });

    if (nextTracks.length === 0) return false;

    setTracks(nextTracks);
    setArrangementClips(nextClips);
    setActiveView('arrangement');
    stepCountRef.current = importedStepCount;
    setStepCount(importedStepCount);
    setTrackGmInstruments(nextGm);
    setTrackEngine(nextEngine);
    setTrackPresets(nextPresets);
    setTrackVelocity(nextVel);
    setTrackVolume(prev => {
      const next = { ...prev };
      nextSelected.forEach(id => { if (next[id] === undefined) next[id] = 100; });
      return next;
    });
    setTrackPan(prev => {
      const next = { ...prev };
      nextSelected.forEach(id => { if (next[id] === undefined) next[id] = 0; });
      return next;
    });
    setSelectedTracks(nextSelected);
    setHoldTones({});
    setMutedTracks({});
    setSoloTracks({});
    releaseAllVoices();
    sustainPrevRef.current = {};
    setTrackSustain(nextSustain);
    programsToLoad.forEach(program => loadSoundFontInstrument(program));
    // Rebuild mixer strips for the fresh track list; drop orphaned ones.
    const freshIds = new Set(nextSelected);
    Object.keys(trackChainsRef.current).forEach(id => {
      if (!freshIds.has(id)) disposeTrackChain(id);
    });
    nextTracks.forEach(t => {
      ensureTrackChain(t.id);
      ensureTrackSamplerById(t.id, nextGm[t.id]).catch(() => {});
    });

    const totalBars = Math.ceil(importedStepCount / STEPS_PER_BAR);
    showToast(importWasTruncated
      ? `${fileName} (full song is ${rawStepCount} steps — loaded first ${importedStepCount})`
      : `${fileName} (full song · ${totalBars} bars · ${nextClips.length} blocks)`);
    return true;
  };

  const handleMidiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.app === 'snuzy-workstation') {
          applyProjectData(data, `${file.name} (Full Project Restored)`);
          return;
        }
      }

      const buffer = await file.arrayBuffer();
      const imported = new Midi(buffer);
      const ok = applyMidiObject(imported, file.name);
      if (!ok) {
        alert('No notes found in that MIDI file.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to parse file: ' + (err?.message || err));
    }
  };

  // ── Right-click toolbox ──────────────────────────────────────────────────
  // Boxed family picker rendered in-panel — no off-screen flyouts.
  const instrumentSubmenu = (currentGm: number, onPick: (gmId: number) => void): CtxItem[] => ([
    {
      custom: (
        <InstrumentPicker
          cats={groupedGmInstruments}
          currentGm={currentGm}
          onPick={gmId => { onPick(gmId); setCtxMenu(null); }}
        />
      ),
    },
  ]);

  const buildTrackMenu = (track: TrackDef): CtxItem[] => {
    const engine = trackEngine[track.id] ?? (track.type === 'soundfont' ? 'soundfont' : 'synth');
    const currentGm = trackGmInstruments[track.id] ?? defaultGmForTrack(track);
    const gmName = GM_INSTRUMENTS[currentGm]?.name || 'instrument';
    const activePreset = trackPresets[track.id] || track.presets[0]?.id;
    const canUseSynth = track.type !== 'soundfont';
    return [
      { label: track.name, header: true },
      { label: 'Preview sound', hint: 'click', onClick: () => triggerInstrument(track) },
      { separator: true, label: '' },
      { label: 'Armed', checked: selectedTracks.includes(track.id), onClick: () => toggleTrackSelect(track.id) },
      { label: mutedTracks[track.id] ? 'Unmute' : 'Mute', checked: !!mutedTracks[track.id], onClick: () => { pushHistory(); setMutedTracks(prev => ({ ...prev, [track.id]: !prev[track.id] })); } },
      { label: soloTracks[track.id] ? 'Unsolo' : 'Solo', checked: !!soloTracks[track.id], onClick: () => { pushHistory(); setSoloTracks(prev => ({ ...prev, [track.id]: !prev[track.id] })); } },
      { label: holdTones[track.id] ? 'Unhold' : 'Hold', checked: !!holdTones[track.id], onClick: () => toggleHold(track.id) },
      { separator: true, label: '' },
      {
        label: 'Engine', hint: engine === 'soundfont' ? 'GM' : 'Tone',
        submenu: [
          ...(canUseSynth ? [{ label: 'Tone synth', checked: engine === 'synth', onClick: () => setChannelEngine(track, 'synth' as TrackEngine) }] : []),
          { label: 'GM SoundFont', checked: engine === 'soundfont', onClick: () => setChannelEngine(track, 'soundfont' as TrackEngine) },
        ],
      },
      { label: 'Instrument', hint: gmName, submenu: instrumentSubmenu(currentGm, gmId => setChannelInstrument(track, gmId)) },
      {
        label: 'Note / pitch', hint: activePreset,
        submenu: (engine === 'soundfont' ? MIDI_NOTE_PRESETS : track.presets).map(p => ({
          label: p.note || p.name, checked: p.id === activePreset,
          onClick: () => { pushHistory(); setTrackPresets(prev => ({ ...prev, [track.id]: p.id })); },
        })),
      },
      {
        label: 'Velocity', hint: `V${trackVelocity[track.id] ?? 100}`,
        submenu: [127, 110, 100, 85, 70, 55, 40, 25].map(v => ({
          label: `V${v}`, checked: (trackVelocity[track.id] ?? 100) === v,
          onClick: () => { pushHistory(); setTrackVelocity(prev => ({ ...prev, [track.id]: v })); },
        })),
      },
      { label: 'Volume', slider: { min: 0, max: 100, value: trackVolume[track.id] ?? 100, accent: track.color, onChange: v => setTrackVolumeLive(track.id, v) } },
      { label: 'Pan', slider: { min: -50, max: 50, value: trackPan[track.id] ?? 0, onChange: v => setTrackPanLive(track.id, v) } },
      { separator: true, label: '' },
      { label: `Use ${gmName} for ALL tracks`, hint: 'whole song', onClick: () => applyInstrumentToAll(currentGm) },
      { label: 'Remove track', danger: true, disabled: tracks.length <= 1, onClick: () => removeChannel(track.id) },
    ];
  };

  const buildGlobalMenu = (): CtxItem[] => ([
    { label: 'Song tools', header: true },
    { label: isPlaying ? 'Stop' : 'Play', hint: isPlaying ? '■' : '▶', onClick: () => togglePlayback() },
    { label: 'Take the guided tour', hint: '✨', onClick: () => setTourStep(0) },
    { separator: true, label: '' },
    {
      label: 'Play everything: unmute + unsolo', hint: 'full mix',
      onClick: () => {
        pushHistory();
        setMutedTracks({});
        setSoloTracks({});
        showToast('Muted and soloed tracks reset — everything plays', 'FULL MIX', '', 2500);
      },
    },
    { label: 'All tracks → instrument', submenu: instrumentSubmenu(applyAllGm, gmId => applyInstrumentToAll(gmId)) },
    { separator: true, label: '' },
    { label: 'Arrangement view', checked: activeView === 'arrangement', onClick: () => setActiveView('arrangement') },
    { label: 'Step sequencer view', checked: activeView === 'steps', onClick: () => setActiveView('steps') },
    { label: 'Extend timeline +4 bars', onClick: () => extendTimeline(64) },
    { label: 'Extend timeline +16 bars', onClick: () => extendTimeline(256) },
    { separator: true, label: '' },
    { label: 'Clear pattern', danger: true, onClick: () => clearGrid() },
  ]);

  // ── Guided tour ────────────────────────────────────────────────────────────
  const TOUR_STEPS: TourStep[] = [
    {
      title: 'Welcome to SNUZY',
      body: <>Your song is already loaded — press PLAY and it starts playing. This tour walks you through everything in about a minute. Use ← → keys, Esc to leave anytime.</>,
      view: 'arrangement',
    },
    {
      title: 'Transport: play, pause, stop',
      body: <>Green plays, yellow pauses <b>where you stopped</b>, red rewinds to the start. Click any bar or step number in a ruler to jump the playhead there.</>,
      target: () => document.querySelector<HTMLElement>('.btn-playback'),
      view: 'arrangement',
    },
    {
      title: 'The song is blocks',
      body: <>Every block is an instrument pattern. <b>Drag</b> a block to move it (even onto another instrument), <b>drag empty space</b> to paint a new one, <b>double-click</b> for a quick bar, <b>Del</b> removes the selected block.</>,
      target: () => document.querySelector<HTMLElement>('.arrangement-scroll'),
      view: 'arrangement',
    },
    {
      title: 'Each block has its own sound',
      body: <>Click a block to open its piano roll: draw notes, drag the <b>Vel</b> slider per note, and pick a <b>Block sound</b> so one block can be a trumpet while its lane stays piano. ✦ marks custom blocks.</>,
      target: () => document.querySelector<HTMLElement>('.piano-roll-toolbar'),
      view: 'arrangement',
    },
    {
      title: 'Two editors, one song',
      body: <>Arrangement is the full song. Step Sequencer is the drum-machine grid. Let's look at the grid — same song, different lens.</>,
      target: () => document.querySelector<HTMLElement>('.view-switcher'),
      view: 'steps',
    },
    {
      title: 'Pads + mini mixer',
      body: <>Click pads to toggle steps. Each row has its instrument, note, velocity — plus <b>VOL / PAN</b> sliders for a real per-track mix, and M / S / Hold buttons.</>,
      target: () => document.querySelector<HTMLElement>('.sequencer-scroll'),
      view: 'steps',
    },
    {
      title: 'Right-click does everything',
      body: <>Right-click any track, block, or empty space for the full toolbox: instruments, notes, mixer, mute/solo, and <b>one-click whole-song instrument swaps</b>. Clicking the page background resets mutes and solos.</>,
      view: 'steps',
    },
    {
      title: 'Save, share, undo',
      body: <>↑ Load MIDI or a saved project · ↓ Save Project keeps everything · ↓ Export MIDI shares the song · <b>Ctrl+Z / Ctrl+Y</b> undo and redo almost anything. That's the tour — press Finish and make some noise.</>,
      view: 'steps',
    },
  ];

  useEffect(() => {
    if (tourStep === null) return;
    const v = TOUR_STEPS[tourStep]?.view;
    if (v) setActiveView(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep]);

  const gridTemplate = `268px 56px repeat(${Math.max(0, win.end - win.start)}, minmax(18px, 1fr))`;

  const ctxTrack = ctxMenu?.trackId ? tracks.find(t => t.id === ctxMenu.trackId) ?? null : null;
  const ctxClip = ctxMenu?.clipId ? arrangementClips.find(c => c.id === ctxMenu.clipId) ?? null : null;
  const buildBlockMenu = (): CtxItem[] => {
    if (!ctxClip) return [];
    const trackDefault = trackGmInstruments[ctxClip.trackId] ?? 0;
    const effective = ctxClip.gmId ?? trackDefault;
    return [
      { label: `Block: ${ctxClip.name}`, header: true },
      {
        label: 'Block instrument', hint: GM_INSTRUMENTS[effective]?.name ?? '',
        submenu: [
          {
            label: `Track default (${GM_INSTRUMENTS[trackDefault]?.name ?? 'instrument'})`,
            checked: ctxClip.gmId === undefined,
            onClick: () => setClipInstrument(ctxClip.id, null),
          },
          { separator: true, label: '' },
          ...instrumentSubmenu(effective, gmId => setClipInstrument(ctxClip.id, gmId)),
        ],
      },
      { separator: true, label: '' },
    ];
  };

  return (
    <div ref={workspaceRef} style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: '#00e5ff', fontWeight: 800, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 0 }}>
            {(() => {
              const text = 'SNUZY MIDI WORKSTATION';
              const len = text.length;
              const stepSec = 0.115;
              const pauseSec = 0.2;
              const fwdTime = len * stepSec;
              const revTime = len * stepSec;
              const totalCycle = fwdTime + pauseSec + revTime + pauseSec;

              const keyframes = text.split('').map((_, i) => {
                const fwdPeakSec = i * stepSec + 0.1;
                const revPeakSec = fwdTime + pauseSec + (len - 1 - i) * stepSec + 0.1;
                const fwdStart = (((fwdPeakSec - 0.12) / totalCycle) * 100).toFixed(2);
                const fwdPeak = ((fwdPeakSec / totalCycle) * 100).toFixed(2);
                const fwdLand = (((fwdPeakSec + 0.18) / totalCycle) * 100).toFixed(2);
                const revStart = (((revPeakSec - 0.12) / totalCycle) * 100).toFixed(2);
                const revPeak = ((revPeakSec / totalCycle) * 100).toFixed(2);
                const revLand = (((revPeakSec + 0.18) / totalCycle) * 100).toFixed(2);
                return `
                  @keyframes titleJumpLetter_${i} {
                    0%, 100% { transform: translateY(0) scale(1); }
                    ${fwdStart}% { transform: translateY(0) scale(1); }
                    ${fwdPeak}% { transform: translateY(-9px) scale(1.22); }
                    ${fwdLand}% { transform: translateY(0) scale(1); }
                    ${revStart}% { transform: translateY(0) scale(1); }
                    ${revPeak}% { transform: translateY(-9px) scale(1.22); }
                    ${revLand}% { transform: translateY(0) scale(1); }
                  }
                `;
              }).join('\n');

              return (
                <>
                  <style>{keyframes}</style>
                  {text.split('').map((char, i) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-block',
                        transformOrigin: 'bottom center',
                        willChange: 'transform',
                        whiteSpace: 'pre',
                        animation: `titleJumpLetter_${i} ${totalCycle.toFixed(2)}s cubic-bezier(0.25, 1, 0.5, 1) infinite`
                      }}
                    >
                      {char}
                    </span>
                  ))}
                </>
              );
            })()}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#90a4ae', fontSize: 13 }}>
            MIDI-style channels • 128 GM SoundFonts on every track • Mute / Solo / Velocity • Import & Export
          </p>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: '#cfd8dc' }}>
            BPM: <strong style={{ color: '#00e5ff' }}>{bpm}</strong>
            <input
              type="range"
              min="40"
              max="300"
              value={bpm}
              onChange={e => setBpm(Number(e.target.value))}
              style={{ display: 'block', width: 110, accentColor: '#00e5ff', cursor: 'pointer' }}
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#cfd8dc' }}>
            Length <span style={{ color: '#78909c' }}>({stepCount} steps)</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {BAR_OPTIONS.map(bars => {
                const steps = bars * STEPS_PER_BAR;
                return (
                <button
                  key={bars}
                  onClick={() => resizeGrid(steps)}
                  title={`${bars} ${bars === 1 ? 'bar' : 'bars'} at 4/4`}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    background: stepCount === steps ? '#00e5ff' : '#262f40',
                    color: stepCount === steps ? '#000' : '#eee'
                  }}
                >
                  {bars}B
                </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={togglePlayback}
              className="btn-playback"
              title={isPlaying ? 'Pause (keeps position)' : stepRef.current > 0 ? 'Resume where you paused' : 'Play from here'}
              style={{
                padding: '10px 24px',
                fontSize: 15,
                fontWeight: 800,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isPlaying ? '#ffd600' : '#00e676',
                color: '#000',
                boxShadow: isPlaying ? '0 0 16px #ffd600' : '0 0 16px #00e676'
              }}
            >
              {isPlaying ? '❚❚ PAUSE' : stepRef.current > 0 ? '▶ RESUME' : '▶ PLAY'}
            </button>
            <button
              onClick={() => pauseTransport(true)}
              className="btn-toolbar"
              title="Stop and rewind to the start"
              style={{
                padding: '10px 14px',
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#ff4b4b',
                color: '#000'
              }}
            >
              ■
            </button>
          </div>
        </div>
      </header>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#171b26',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16,
          gap: 10,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => addChannel()}
            className="btn-toolbar"
            style={{ padding: '6px 12px', background: '#00e676', color: '#000', fontWeight: 700, border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            + Add Channel
          </button>
          <select
            defaultValue=""
            onChange={e => {
              const def = TRACK_DEFS.find(t => t.id === e.target.value);
              if (def) addChannel(def);
              e.target.value = '';
            }}
            style={{ ...selectStyle, color: '#cfd8dc', padding: '6px 8px', fontSize: 12 }}
            title="Add a channel from the instrument library"
          >
            <option value="" disabled>Add from library…</option>
            {TRACK_DEFS.map(t => (
              <option key={t.id} value={t.id}>{t.category} — {t.name}</option>
            ))}
          </select>
          <button
            onClick={() => setSelectedTracks(tracks.map(t => t.id))}
            className="btn-toolbar"
            style={{ padding: '6px 12px', background: '#262f40', color: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Arm All
          </button>
          <button
            onClick={() => setSelectedTracks([])}
            className="btn-toolbar"
            style={{ padding: '6px 12px', background: '#262f40', color: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Disarm All
          </button>
          <button
            onClick={clearGrid}
            className="btn-toolbar"
            style={{ padding: '6px 12px', background: '#3b242e', color: '#ff8a80', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Clear Pattern
          </button>
          <button
            onClick={undo}
            disabled={histLen.past === 0}
            className="btn-toolbar"
            title="Undo (Ctrl+Z)"
            style={{ padding: '6px 12px', background: '#262f40', color: histLen.past === 0 ? '#546e7a' : '#eee', border: 'none', borderRadius: 4, cursor: histLen.past === 0 ? 'default' : 'pointer' }}
          >
            ↩ Undo
          </button>
          <button
            onClick={redo}
            disabled={histLen.future === 0}
            className="btn-toolbar"
            title="Redo (Ctrl+Y)"
            style={{ padding: '6px 12px', background: '#262f40', color: histLen.future === 0 ? '#546e7a' : '#eee', border: 'none', borderRadius: 4, cursor: histLen.future === 0 ? 'default' : 'pointer' }}
          >
            ↪ Redo
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#90a4ae' }}>
            Set all to
            <select
              value={applyAllGm}
              onChange={e => applyInstrumentToAll(Number(e.target.value))}
              style={{ ...selectStyle, color: '#f9a825', maxWidth: 180 }}
              title="Assign this SoundFont instrument to every channel"
            >
              {Object.entries(groupedGmInstruments).map(([cat, insts]) => (
                <optgroup key={cat} label={cat}>
                  {insts.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label
            className="btn-toolbar"
            style={{
              padding: '7px 14px',
              backgroundColor: '#262f40',
              color: '#00e5ff',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              border: '1px solid #37474f',
              display: 'inline-block'
            }}
          >
            ↑ Load MIDI / Project
            <input type="file" accept=".mid,.midi,.json" onChange={handleMidiImport} style={{ display: 'none' }} />
          </label>
          <button
            onClick={exportProject}
            className="btn-toolbar"
            style={{ padding: '7px 16px', backgroundColor: '#00e676', color: '#000', fontWeight: 700, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            ↓ Save Project
          </button>
          <button
            onClick={exportMidi}
            className="btn-toolbar"
            style={{ padding: '7px 16px', backgroundColor: '#00b0ff', color: '#000', fontWeight: 700, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            ↓ Export MIDI
          </button>
          <button
            onClick={() => setTourStep(0)}
            className="btn-toolbar"
            title="Take the interactive guided tour"
            style={{ padding: '7px 16px', backgroundColor: '#651fff', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            ✨ Tour
          </button>
        </div>
      </div>

      <div className="view-switcher" role="tablist" aria-label="Editor view">
        <button className={activeView === 'arrangement' ? 'active' : ''} onClick={() => setActiveView('arrangement')}>▦ Arrangement</button>
        <button className={activeView === 'steps' ? 'active' : ''} onClick={() => setActiveView('steps')}>▦ Step Sequencer</button>
      </div>

      {activeView === 'arrangement' ? (
        <ArrangementView tracks={tracks} stepCount={stepCount} clips={arrangementClips} setClips={updater => { pushHistory(); setArrangementClips(updater); }} onExtend={extendTimeline} trackGmInstruments={trackGmInstruments} onSetClipInstrument={setClipInstrument} onSeekStep={seekToStep} />
      ) : <>
      <div className="timeline-toolbar">
        <div>
          <strong>Arrangement</strong>
          <span>{stepCount / STEPS_PER_BAR} bars · {stepCount} steps</span>
        </div>
        <div className="timeline-toolbar-actions">
          <button
            type="button"
            onClick={() => gridScrollRef.current?.scrollBy({ left: -gridScrollRef.current.clientWidth * 0.75, behavior: 'smooth' })}
            title="Scroll backward"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => gridScrollRef.current?.scrollBy({ left: gridScrollRef.current.clientWidth * 0.75, behavior: 'smooth' })}
            title="Scroll forward"
          >
            Forward →
          </button>
          <button type="button" onClick={() => gridScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}>
            Start
          </button>
          <label title="Keep the current step visible during playback">
            <input type="checkbox" checked={autoFollow} onChange={event => setAutoFollow(event.target.checked)} />
            Follow playhead
          </label>
        </div>
      </div>

      <div ref={gridScrollRef} className="sequencer-scroll" onScroll={onGridScroll}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 720 }}>
          {tracks.map((track, channelIndex) => {
            const engine = trackEngine[track.id] ?? (track.type === 'soundfont' ? 'soundfont' : 'synth');
            const currentGm = trackGmInstruments[track.id] ?? defaultGmForTrack(track);
            return (
              <TrackRow
                key={track.id}
                track={track}
                channelIndex={channelIndex}
                row={grid[track.id] ?? EMPTY_ROW_CONST}
                winStart={win.start}
                winEnd={win.end}
                gridTemplate={gridTemplate}
                trackCount={tracks.length}
                isSelected={selectedTracks.includes(track.id)}
                isHeld={!!holdTones[track.id]}
                isMuted={!!mutedTracks[track.id]}
                isSolo={!!soloTracks[track.id]}
                engine={engine}
                activePreset={trackPresets[track.id] || track.presets[0]?.id}
                currentGm={currentGm}
                status={sfStatus[currentGm] || (soundFontPlayerRef.current?.isLoaded(currentGm) ? 'loaded' : 'idle')}
                velocity={trackVelocity[track.id] ?? 100}
                volume={trackVolume[track.id] ?? 100}
                pan={trackPan[track.id] ?? 0}
                canUseSynth={track.type !== 'soundfont'}
                groupedGm={groupedGmInstruments}
                onToggleMute={id => { pushHistory(); setMutedTracks(prev => ({ ...prev, [id]: !prev[id] })); }}
                onToggleSolo={id => { pushHistory(); setSoloTracks(prev => ({ ...prev, [id]: !prev[id] })); }}
                onPreview={triggerInstrument}
                onToggleSelect={toggleTrackSelect}
                onEngine={setChannelEngine}
                onInstrument={setChannelInstrument}
                onPreset={(id, v) => { pushHistory(); setTrackPresets(prev => ({ ...prev, [id]: v })); }}
                onVelocity={(id, v) => { pushHistory(); setTrackVelocity(prev => ({ ...prev, [id]: v })); }}
                onVolume={setTrackVolumeLive}
                onPan={setTrackPanLive}
                onRemove={removeChannel}
                onHold={toggleHold}
                onPad={togglePad}
              />
            );
          })}

          <div
            className="step-ruler"
            style={{
              display: 'grid',
              gridTemplateColumns: gridTemplate,
              gap: 6,
              textAlign: 'center'
            }}
          >
            <div className="sticky-track-controls ruler-label">CHANNEL</div>
            <div className="sticky-hold-control ruler-label">HOLD</div>
            {Array.from({ length: Math.max(0, win.end - win.start) }).map((_, k) => {
              const i = win.start + k;
              return (
                <div
                  key={i}
                  className={`step-num step-col-${i} ${i % STEPS_PER_BAR === 0 ? 'bar-start' : ''}`}
                  data-sequencer-step={i}
                  title={`Play from here — Bar ${Math.floor(i / STEPS_PER_BAR) + 1}, step ${(i % STEPS_PER_BAR) + 1}`}
                  onClick={() => seekToStep(i)}
                  style={{ cursor: 'pointer' }}
                >
                  {i % STEPS_PER_BAR === 0 ? `B${Math.floor(i / STEPS_PER_BAR) + 1}` : i + 1}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </>}

      <div
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #0d1b2a 0%, #1a2a3a 100%)',
            border: '1px solid #00e5ff44',
            borderRadius: 14,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 8px 32px #000a, 0 0 0 1px #00e5ff22',
            minWidth: 260,
            maxWidth: 360,
            transform: midiToast.visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.96)',
            opacity: midiToast.visible ? 1 : 0,
            transition: 'opacity 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)'
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #00e676 0%, #00b248 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 14px #00e67688'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <polyline points="4,10 8,14 16,6" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#00e676', fontWeight: 800, fontSize: 13, letterSpacing: '0.5px' }}>
              {midiToast.title}
            </div>
            <div
              style={{
                color: '#90a4ae',
                fontSize: 11,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              title={midiToast.fileName}
            >
              {midiToast.fileName}
            </div>
            {midiToast.sub !== '' && (
              <div style={{ color: '#546e7a', fontSize: 10, marginTop: 4 }}>
                {midiToast.sub}
              </div>
            )}
          </div>
        </div>
      </div>

      {bootVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 12000,
            background: '#0b0e14',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            opacity: boot.done >= boot.total ? 0 : 1,
            transition: 'opacity 0.4s ease',
            pointerEvents: boot.done >= boot.total ? 'none' : 'auto',
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6, color: '#00e5ff', textShadow: '0 0 24px #00e5ff66' }}>
            SNUZY
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#78909c' }}>
            MIDI WORKSTATION
          </div>
          <div style={{ width: 280, height: 8, borderRadius: 999, background: '#1b2230', border: '1px solid #2c3547', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${boot.total > 0 ? Math.round((boot.done / boot.total) * 100) : 0}%`,
                borderRadius: 999,
                background: 'linear-gradient(90deg, #00e5ff, #00e676)',
                boxShadow: '0 0 12px #00e5ff88',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#90a4ae' }}>
            {boot.total > 0 ? Math.round((boot.done / boot.total) * 100) : 0}% · {boot.label}
          </div>
        </div>
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxTrack ? [...buildBlockMenu(), ...buildTrackMenu(ctxTrack)] : buildGlobalMenu()}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {tourStep !== null && TOUR_STEPS[tourStep] && (
        <TourGuide
          step={tourStep}
          steps={TOUR_STEPS}
          onNext={() => setTourStep(s => (s === null || s + 1 >= TOUR_STEPS.length ? null : s + 1))}
          onBack={() => setTourStep(s => (s === null || s === 0 ? s : s - 1))}
          onClose={() => setTourStep(null)}
        />
      )}

      {!secretPiano && (
        <button
          onClick={() => setSecretPiano(true)}
          title="Shh… secret piano"
          style={{
            position: 'fixed', left: 12, bottom: 12, zIndex: 9997,
            width: 34, height: 34, borderRadius: '50%',
            border: '1px solid #3b475d', background: '#171c29', color: '#607d8b',
            cursor: 'pointer', fontSize: 16, fontWeight: 800, lineHeight: 1,
          }}
        >
          ?
        </button>
      )}

      {!mp3Booth && (
        <button
          onClick={() => setMp3Booth(true)}
          title="MP3 → MIDI converter"
          style={{
            position: 'fixed', right: 12, bottom: 12, zIndex: 9997,
            minWidth: 34, height: 34, borderRadius: 8, padding: '0 8px',
            border: '1px solid #3b475d', background: '#171c29', color: '#00e5ff',
            cursor: 'pointer', fontSize: 11, fontWeight: 800, lineHeight: 1,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <span style={{ fontSize: 14 }}>♫</span>MP3
        </button>
      )}

      {mp3Booth && (
        <Mp3ToMidi
          bpm={bpm}
          onImport={(midi, name) => {
            setMp3Booth(false);
            setActiveView('arrangement');
            if (!applyMidiObject(midi, name)) {
              alert('No melody detected in that file — try higher sensitivity or a simpler recording.');
            }
          }}
          onExit={() => setMp3Booth(false)}
        />
      )}

      {secretPiano && (
        <SecretPiano
          tracks={tracks}
          clips={arrangementClips}
          sustain={trackSustain}
          stepCount={stepCount}
          bpm={bpm}
          isPlaying={isPlaying}
          stepRef={stepRef}
          onTogglePlay={() => togglePlayback()}
          onExit={() => setSecretPiano(false)}
          onSeekStep={seekToStep}
        />
      )}
    </div>
  );
}
