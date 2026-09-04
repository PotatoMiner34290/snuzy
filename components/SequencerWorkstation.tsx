'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import {
  GM_INSTRUMENTS,
  getInstrumentsByCategory,
  SoundFontPlayer
} from './SoundFontEngine';

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
export const MAX_STEPS = 256;
const BAR_OPTIONS = [1, 2, 4, 8, 16];

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
  const [bpm, setBpm] = useState<number>(DEFAULT_BPM);
  const [stepCount, setStepCount] = useState<number>(DEFAULT_STEPS);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [tracks, setTracks] = useState<TrackDef[]>(() => TRACK_DEFS.map(t => ({ ...t, presets: [...t.presets] })));
  const [selectedTracks, setSelectedTracks] = useState<string[]>(TRACK_DEFS.map(t => t.id));
  const [holdTones, setHoldTones] = useState<Record<string, boolean>>({});
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({});
  const [soloTracks, setSoloTracks] = useState<Record<string, boolean>>({});
  const [midiToast, setMidiToast] = useState<{ visible: boolean; fileName: string }>({ visible: false, fileName: '' });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [trackPresets, setTrackPresets] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    TRACK_DEFS.forEach(t => {
      initial[t.id] = t.type === 'soundfont' ? t.note : (t.presets[0]?.id || '');
    });
    return initial;
  });

  const [trackEngine, setTrackEngine] = useState<Record<string, TrackEngine>>(() => {
    const initial: Record<string, TrackEngine> = {};
    TRACK_DEFS.forEach(t => {
      initial[t.id] = t.type === 'soundfont' ? 'soundfont' : 'synth';
    });
    return initial;
  });

  const [trackVelocity, setTrackVelocity] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    TRACK_DEFS.forEach(t => { initial[t.id] = 100; });
    return initial;
  });

  const [applyAllGm, setApplyAllGm] = useState<number>(0);

  const trackPresetsRef = useRef(trackPresets);
  useEffect(() => { trackPresetsRef.current = trackPresets; }, [trackPresets]);

  const [grid, setGrid] = useState<Record<string, boolean[]>>(() => {
    const initial: Record<string, boolean[]> = {};
    TRACK_DEFS.forEach(t => {
      initial[t.id] = emptyRow(DEFAULT_STEPS);
    });
    initial.kick[0] = true;
    initial.kick[8] = true;
    initial.snare[4] = true;
    initial.snare[12] = true;
    initial.hihat[2] = true;
    initial.hihat[6] = true;
    initial.hihat[10] = true;
    initial.hihat[14] = true;
    initial.bass[0] = true;
    initial.bass[6] = true;
    initial.bass[10] = true;
    initial.chord_pad[0] = true;
    initial.chord_pad[8] = true;
    return initial;
  });

  const instrumentsRef = useRef<Record<string, any>>({});
  const repeatIdRef = useRef<number | null>(null);
  const stepRef = useRef<number>(0);
  const holdTonesRef = useRef(holdTones);
  const gridRef = useRef(grid);
  const selectedTracksRef = useRef(selectedTracks);
  const tracksRef = useRef(tracks);
  const trackEngineRef = useRef(trackEngine);
  const trackVelocityRef = useRef(trackVelocity);
  const mutedTracksRef = useRef(mutedTracks);
  const soloTracksRef = useRef(soloTracks);
  const stepCountRef = useRef(stepCount);
  const stepColCacheRef = useRef<Array<{ step: HTMLElement[] }>>([]);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const autoFollowRef = useRef(autoFollow);
  const selectedTracksSetRef = useRef<Set<string>>(new Set(selectedTracks));
  const limiterRef = useRef<Tone.Limiter | null>(null);

  const groupedGmInstruments = React.useMemo(() => getInstrumentsByCategory(), []);

  const [trackGmInstruments, setTrackGmInstruments] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    TRACK_DEFS.forEach(t => {
      initial[t.id] = defaultGmForTrack(t);
    });
    return initial;
  });

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

  const refreshStepColCache = () => {
    stepColCacheRef.current = Array.from({ length: stepCountRef.current }, (_, i) => ({
      step: Array.from(document.querySelectorAll<HTMLElement>(`.step-col-${i}`))
    }));
  };

  useEffect(() => { holdTonesRef.current = holdTones; }, [holdTones]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { trackEngineRef.current = trackEngine; }, [trackEngine]);
  useEffect(() => { trackVelocityRef.current = trackVelocity; }, [trackVelocity]);
  useEffect(() => { mutedTracksRef.current = mutedTracks; }, [mutedTracks]);
  useEffect(() => { soloTracksRef.current = soloTracks; }, [soloTracks]);
  useEffect(() => { stepCountRef.current = stepCount; }, [stepCount]);
  useEffect(() => { autoFollowRef.current = autoFollow; }, [autoFollow]);
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

    [0, 24, 33, 48, 61, 81, 116].forEach(id => {
      sfPlayer.loadInstrument(id).catch(() => {});
    });

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.35 }
    }).connect(masterLimiter);

    const sub808 = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.5, sustain: 0.2, release: 0.5 }
    }).connect(masterLimiter);
    sub808.volume.value = -1;

    const snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
    }).connect(masterLimiter);

    const clap = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.12, sustain: 0, release: 0.08 }
    }).connect(masterLimiter);

    const hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.04, release: 0.04 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).connect(masterLimiter);
    hihat.frequency.value = 250;
    hihat.volume.value = -8;

    const openhat = new Tone.MetalSynth({
      envelope: { attack: 0.005, decay: 0.25, release: 0.2 },
      harmonicity: 4.8,
      modulationIndex: 28,
      resonance: 3500,
      octaves: 1.2
    }).connect(masterLimiter);
    openhat.frequency.value = 220;
    openhat.volume.value = -8;

    const tom = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.25, sustain: 0.01, release: 0.2 }
    }).connect(masterLimiter);

    const rimshot = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.03 }
    }).connect(masterLimiter);
    rimshot.volume.value = -4;

    const cowbell = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, release: 0.08 },
      harmonicity: 1.4,
      modulationIndex: 12,
      resonance: 2500,
      octaves: 0.5
    }).connect(masterLimiter);
    cowbell.frequency.value = 540;
    cowbell.volume.value = -6;

    const bass = new Tone.FMSynth({
      harmonicity: 1,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0.3, release: 0.3 }
    }).connect(masterLimiter);
    bass.volume.value = -3;

    const acidBass = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'sawtooth' },
      filter: { Q: 6, type: 'lowpass' },
      envelope: { attack: 0.01, decay: 0.18, sustain: 0.2, release: 0.2 },
      filterEnvelope: { attack: 0.02, decay: 0.12, sustain: 0.1, release: 0.15, baseFrequency: 80, octaves: 4 }
    }).connect(masterLimiter);
    acidBass.maxPolyphony = 8;
    acidBass.volume.value = -3;

    const synthLead = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.3 }
    }).connect(masterLimiter);
    synthLead.maxPolyphony = 8;
    synthLead.volume.value = -6;

    const pluck = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.1 }
    }).connect(masterLimiter);
    pluck.maxPolyphony = 8;
    pluck.volume.value = -3;

    const chordPad = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.4 }
    }).connect(masterLimiter);
    chordPad.maxPolyphony = 8;
    chordPad.volume.value = -6;

    const spacePad = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 10,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.1, decay: 0.35, sustain: 0.5, release: 0.5 }
    }).connect(masterLimiter);
    spacePad.maxPolyphony = 8;
    spacePad.volume.value = -8;

    const wobble = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'square' },
      filter: { Q: 4, type: 'lowpass' },
      envelope: { attack: 0.03, decay: 0.18, sustain: 0.4, release: 0.25 },
      filterEnvelope: { attack: 0.08, decay: 0.15, sustain: 0.2, release: 0.2, baseFrequency: 120, octaves: 3 }
    }).connect(masterLimiter);
    wobble.maxPolyphony = 8;
    wobble.volume.value = -4;

    instrumentsRef.current = {
      membrane: kick,
      sub808: sub808,
      noise: snare,
      synth: clap,
      metal: hihat,
      metal_open: openhat,
      tom,
      rim: rimshot,
      cowbell,
      fm: bass,
      acid: acidBass,
      poly: synthLead,
      pluck,
      am: chordPad,
      space: spacePad,
      wobble
    };

    return () => {
      try {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      } catch {}
      Object.values(instrumentsRef.current).forEach(inst => {
        try { inst.dispose(); } catch {}
      });
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

  const fireSynth = (trackDef: TrackDef, currentNote: string, triggerTime: number, velocity: number) => {
    const inst = instrumentsRef.current[trackDef.type];
    if (!inst) return;
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
    } else if (trackDef.type === 'poly' || trackDef.type === 'am' || trackDef.type === 'space') {
      inst.triggerAttackRelease(currentNote || 'C4', '8n', triggerTime, velocity);
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
        const player = soundFontPlayerRef.current;
        if (!player) return;
        if (!player.isLoaded(gmId)) {
          loadSoundFontInstrument(gmId).then(() => {
            player.triggerNote(gmId, currentNote || 'C4', '8n', undefined, velocity);
          });
        } else {
          player.triggerNote(gmId, currentNote || 'C4', '8n', triggerTime, velocity);
        }
        return;
      }

      fireSynth(trackDef, currentNote, triggerTime, velocity);
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

  const stopTransport = () => {
    Tone.Transport.stop();
    if (repeatIdRef.current !== null) {
      Tone.Transport.clear(repeatIdRef.current);
      repeatIdRef.current = null;
    }
    setIsPlaying(false);
    stepRef.current = 0;
    const cache = stepColCacheRef.current;
    if (cache.length > 0) {
      cache.forEach(c => c.step.forEach(el => el.classList.remove('step-current')));
    } else {
      document.querySelectorAll('.step-current').forEach(el => el.classList.remove('step-current'));
    }
  };

  const togglePlayback = async () => {
    try {
      if (isPlaying) {
        stopTransport();
        return;
      }

      await Tone.start();
      Tone.Transport.bpm.value = bpm;
      stepRef.current = 0;
      refreshStepColCache();

      repeatIdRef.current = Tone.Transport.scheduleRepeat((time: number) => {
        const step = stepRef.current;
        const steps = stepCountRef.current;
        const currentGrid = gridRef.current;
        const currentHolds = holdTonesRef.current;
        const currentTracks = tracksRef.current;

        for (let i = 0; i < currentTracks.length; i++) {
          const track = currentTracks[i];
          if (!channelAudible(track.id)) continue;
          if (!(currentGrid[track.id]?.[step] || currentHolds[track.id])) continue;

          const currentNote = getTrackActiveNote(track);
          const velocity = (trackVelocityRef.current[track.id] ?? 100) / 127;

          try {
            if (usesSoundFont(track)) {
              const gmId = trackGmInstrumentsRef.current[track.id] ?? defaultGmForTrack(track);
              const player = soundFontPlayerRef.current;
              if (player && player.isLoaded(gmId)) {
                player.triggerNote(gmId, currentNote || 'C4', '8n', time, velocity);
              }
            } else {
              fireSynth(track, currentNote, time, velocity);
            }
          } catch {
            // timing collision
          }
        }

        Tone.Draw.schedule(() => {
          let cache = stepColCacheRef.current;
          if (cache.length === 0) {
            refreshStepColCache();
            cache = stepColCacheRef.current;
          }
          const prevStep = (step - 1 + steps) % steps;
          cache[prevStep]?.step.forEach(el => el.classList.remove('step-current'));
          cache[step]?.step.forEach(el => el.classList.add('step-current'));

          const scroller = gridScrollRef.current;
          const activeCell = cache[step]?.step.find(el => el.classList.contains('pad-cell'));
          if (autoFollowRef.current && scroller && activeCell) {
            const scrollerRect = scroller.getBoundingClientRect();
            const cellRect = activeCell.getBoundingClientRect();
            const stickyControlsWidth = 340;
            const safeLeft = scrollerRect.left + stickyControlsWidth;
            const safeRight = scrollerRect.right - 72;
            if (cellRect.left < safeLeft || cellRect.right > safeRight) {
              scroller.scrollTo({
                left: Math.max(0, scroller.scrollLeft + cellRect.left - safeLeft),
                behavior: 'smooth'
              });
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

  const togglePad = (trackId: string, stepIdx: number) => {
    setGrid(prev => {
      const row = [...(prev[trackId] || emptyRow(stepCount))];
      row[stepIdx] = !row[stepIdx];
      return { ...prev, [trackId]: row };
    });
  };

  const toggleTrackSelect = (trackId: string) => {
    setSelectedTracks(prev =>
      prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]
    );
  };

  const toggleHold = (trackId: string) => {
    setHoldTones(prev => {
      const next = { ...prev, [trackId]: !prev[trackId] };
      if (next[trackId] && !isPlaying) {
        const def = tracksRef.current.find(t => t.id === trackId);
        if (def) triggerInstrument(def);
      }
      return next;
    });
  };

  const resizeGrid = (nextSteps: number) => {
    nextSteps = normalizeStepCount(nextSteps);
    setGrid(prev => {
      const next: Record<string, boolean[]> = {};
      Object.keys(prev).forEach(id => {
        const row = emptyRow(nextSteps);
        const src = prev[id] || [];
        for (let i = 0; i < Math.min(src.length, nextSteps); i++) row[i] = src[i];
        next[id] = row;
      });
      return next;
    });
    stepCountRef.current = nextSteps;
    setStepCount(nextSteps);
  };

  const clearGrid = () => {
    const empty: Record<string, boolean[]> = {};
    tracks.forEach(t => {
      empty[t.id] = emptyRow(stepCount);
    });
    setGrid(empty);
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
    setTracks(prev => [...prev, track]);
    setGrid(prev => ({ ...prev, [id]: emptyRow(stepCount) }));
    setSelectedTracks(prev => [...prev, id]);
    setTrackPresets(prev => ({ ...prev, [id]: track.type === 'soundfont' ? track.note : (track.presets[0]?.id || 'C4') }));
    setTrackEngine(prev => ({ ...prev, [id]: 'soundfont' }));
    setTrackGmInstruments(prev => ({ ...prev, [id]: gmId }));
    setTrackVelocity(prev => ({ ...prev, [id]: 100 }));
    loadSoundFontInstrument(gmId);
  };

  const removeChannel = (trackId: string) => {
    if (tracks.length <= 1) return;
    setTracks(prev => prev.filter(t => t.id !== trackId));
    setSelectedTracks(prev => prev.filter(id => id !== trackId));
    setGrid(prev => {
      const next = { ...prev };
      delete next[trackId];
      return next;
    });
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
  };

  const setChannelEngine = (track: TrackDef, engine: TrackEngine) => {
    setTrackEngine(prev => ({ ...prev, [track.id]: engine }));
    if (engine === 'soundfont') {
      const gmId = trackGmInstruments[track.id] ?? defaultGmForTrack(track);
      setTrackGmInstruments(prev => ({ ...prev, [track.id]: gmId }));
      const note = getTrackActiveNote(track);
      const safeNote = note.endsWith('n') ? (track.note && !track.note.endsWith('n') ? track.note : 'C4') : note;
      setTrackPresets(prev => ({ ...prev, [track.id]: safeNote }));
      loadSoundFontInstrument(gmId);
    }
  };

  const setChannelInstrument = async (track: TrackDef, gmId: number) => {
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
    soundFontPlayerRef.current?.triggerNote(gmId, note, '8n');
  };

  const applyInstrumentToAll = async (gmId: number) => {
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
        const vel = (trackVelocity[track.id] ?? 100) / 127;

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
        version: '2.0',
        timestamp: Date.now(),
        bpm,
        stepCount,
        tracks,
        grid,
        trackPresets,
        trackGmInstruments,
        trackEngine,
        trackVelocity,
        selectedTracks,
        holdTones,
        mutedTracks,
        soloTracks
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

  const handleMidiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.app === 'snuzy-workstation') {
          if (typeof data.bpm === 'number') setBpm(data.bpm);
          if (typeof data.stepCount === 'number') {
            const importedStepCount = normalizeStepCount(data.stepCount);
            stepCountRef.current = importedStepCount;
            setStepCount(importedStepCount);
          }
          if (Array.isArray(data.tracks) && data.tracks.length > 0) setTracks(data.tracks);
          if (data.grid) setGrid(data.grid);
          if (data.trackPresets) setTrackPresets(data.trackPresets);
          if (data.trackGmInstruments) setTrackGmInstruments(data.trackGmInstruments);
          if (data.trackEngine) setTrackEngine(data.trackEngine);
          if (data.trackVelocity) setTrackVelocity(data.trackVelocity);
          if (data.selectedTracks) setSelectedTracks(data.selectedTracks);
          if (data.holdTones) setHoldTones(data.holdTones);
          if (data.mutedTracks) setMutedTracks(data.mutedTracks);
          if (data.soloTracks) setSoloTracks(data.soloTracks);

          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          setMidiToast({ visible: true, fileName: `${file.name} (Full Project Restored)` });
          toastTimerRef.current = setTimeout(() => {
            setMidiToast(prev => ({ ...prev, visible: false }));
          }, 3500);
          return;
        }
      }

      const buffer = await file.arrayBuffer();
      const imported = new Midi(buffer);

      if (isPlaying) stopTransport();
      stepColCacheRef.current = [];

      const ppq = imported.header.ppq || 480;
      const ticksPer16th = ppq / 4;
      const lastNoteEndTicks = imported.tracks.reduce((latest, track) => (
        track.notes.reduce((trackLatest, note) => (
          Math.max(trackLatest, note.ticks + note.durationTicks)
        ), latest)
      ), 0);
      const sourceStepCount = Math.ceil(lastNoteEndTicks / ticksPer16th);
      const importedStepCount = normalizeStepCount(sourceStepCount);
      const importWasTruncated = sourceStepCount > importedStepCount;

      if (imported.header.tempos && imported.header.tempos.length > 0) {
        const fileBpm = Math.round(imported.header.tempos[0].bpm);
        if (fileBpm >= 60 && fileBpm <= 180) setBpm(fileBpm);
      }

      const instrumentTracks = imported.tracks.filter(t => t.notes.length > 0);
      const nextTracks: TrackDef[] = [];
      const nextGrid: Record<string, boolean[]> = {};
      const nextGm: Record<string, number> = {};
      const nextEngine: Record<string, TrackEngine> = {};
      const nextPresets: Record<string, string> = {};
      const nextVel: Record<string, number> = {};
      const nextSelected: string[] = [];
      const programsToLoad = new Set<number>();
      const importId = Date.now();

      instrumentTracks.forEach((t, i) => {
        const gmProg = typeof t.instrument?.number === 'number'
          ? Math.max(0, Math.min(127, t.instrument.number))
          : 0;
        const gm = GM_INSTRUMENTS[gmProg];
        const notesByPitch = new Map<number, typeof t.notes>();
        t.notes.forEach(n => {
          const stepIndex = Math.round(n.ticks / ticksPer16th);
          if (stepIndex >= importedStepCount) return;
          const pitchNotes = notesByPitch.get(n.midi) || [];
          pitchNotes.push(n);
          notesByPitch.set(n.midi, pitchNotes);
        });

        [...notesByPitch.entries()].sort(([a], [b]) => a - b).forEach(([pitch, pitchNotes]) => {
          const noteName = midiNoteName(Math.max(24, Math.min(95, pitch)));
          const id = `midi_${importId}_${i}_${pitch}`;
          const velocity = Math.round(
            (pitchNotes.reduce((sum, note) => sum + note.velocity, 0) / pitchNotes.length) * 127
          );
          const channelIndex = nextTracks.length;
          const trackName = t.name || gm?.name || `MIDI Track ${i + 1}`;
          const track: TrackDef = {
            id,
            name: `${trackName} · ${noteName}`,
            category: 'SoundFont Instruments',
            type: 'soundfont',
            note: noteName,
            color: CHANNEL_COLORS[channelIndex % CHANNEL_COLORS.length],
            presets: MIDI_NOTE_PRESETS,
            defaultGmId: gmProg
          };

          nextTracks.push(track);
          nextGrid[id] = emptyRow(importedStepCount);
          pitchNotes.forEach(note => {
            const stepIndex = Math.round(note.ticks / ticksPer16th);
            nextGrid[id][stepIndex] = true;
          });
          nextGm[id] = gmProg;
          nextEngine[id] = 'soundfont';
          nextPresets[id] = noteName;
          nextVel[id] = Math.max(1, Math.min(127, velocity));
          nextSelected.push(id);
          programsToLoad.add(gmProg);
        });
      });

      if (nextTracks.length === 0) {
        alert('No notes found in that MIDI file.');
        return;
      }

      setTracks(nextTracks);
      stepCountRef.current = importedStepCount;
      setStepCount(importedStepCount);
      setGrid(nextGrid);
      setTrackGmInstruments(nextGm);
      setTrackEngine(nextEngine);
      setTrackPresets(nextPresets);
      setTrackVelocity(nextVel);
      setSelectedTracks(nextSelected);
      setHoldTones({});
      setMutedTracks({});
      setSoloTracks({});
      programsToLoad.forEach(program => loadSoundFontInstrument(program));

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setMidiToast({
        visible: true,
        fileName: importWasTruncated
          ? `${file.name} (loaded first ${importedStepCount} of ${sourceStepCount} steps)`
          : file.name
      });
      toastTimerRef.current = setTimeout(() => {
        setMidiToast(prev => ({ ...prev, visible: false }));
      }, 3000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to parse file: ' + (err?.message || err));
    }
  };

  const gridTemplate = `268px 56px repeat(${stepCount}, minmax(18px, 1fr))`;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
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
              min="60"
              max="180"
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

          <button
            onClick={togglePlayback}
            className="btn-playback"
            style={{
              padding: '10px 24px',
              fontSize: 15,
              fontWeight: 800,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isPlaying ? '#ff4b4b' : '#00e676',
              color: '#000',
              boxShadow: isPlaying ? '0 0 16px #ff4b4b' : '0 0 16px #00e676'
            }}
          >
            {isPlaying ? '■ STOP' : '▶ PLAY'}
          </button>
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
        </div>
      </div>

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

      <div ref={gridScrollRef} className="sequencer-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 720 }}>
          {tracks.map((track, channelIndex) => {
            const isSelected = selectedTracks.includes(track.id);
            const isHeld = holdTones[track.id];
            const isMuted = !!mutedTracks[track.id];
            const isSolo = !!soloTracks[track.id];
            const engine = trackEngine[track.id] ?? (track.type === 'soundfont' ? 'soundfont' : 'synth');
            const activePreset = trackPresets[track.id] || track.presets[0]?.id;
            const currentGm = trackGmInstruments[track.id] ?? defaultGmForTrack(track);
            const status = sfStatus[currentGm] || (soundFontPlayerRef.current?.isLoaded(currentGm) ? 'loaded' : 'idle');
            const row = grid[track.id] || emptyRow(stepCount);
            const canUseSynth = track.type !== 'soundfont';

            return (
              <div
                key={track.id}
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
                      onClick={() => setMutedTracks(prev => ({ ...prev, [track.id]: !prev[track.id] }))}
                      title="Mute channel"
                      style={{
                        width: 22, height: 18, fontSize: 9, fontWeight: 800, borderRadius: 3, cursor: 'pointer',
                        border: 'none', background: isMuted ? '#ff5252' : '#2a3144', color: isMuted ? '#000' : '#90a4ae'
                      }}
                    >
                      M
                    </button>
                    <button
                      onClick={() => setSoloTracks(prev => ({ ...prev, [track.id]: !prev[track.id] }))}
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
                        onClick={() => triggerInstrument(track)}
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
                        onChange={() => toggleTrackSelect(track.id)}
                        title="Arm channel"
                        style={{ accentColor: track.color, cursor: 'pointer', flexShrink: 0 }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <select
                        value={engine}
                        onChange={e => setChannelEngine(track, e.target.value as TrackEngine)}
                        style={{ ...selectStyle, color: '#90caf9', width: 52, flexShrink: 0 }}
                        title="Tone synth or SoundFont sampler"
                      >
                        {canUseSynth && <option value="synth">Tone</option>}
                        <option value="soundfont">GM</option>
                      </select>

                      <select
                        value={currentGm}
                        onChange={e => setChannelInstrument(track, Number(e.target.value))}
                        style={{ ...selectStyle, color: track.color, flex: 1 }}
                        title="General MIDI SoundFont (all 128 instruments)"
                      >
                        {Object.entries(groupedGmInstruments).map(([cat, insts]) => (
                          <optgroup key={cat} label={cat}>
                            {insts.map(inst => (
                              <option key={inst.id} value={inst.id}>{inst.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>

                      <select
                        value={activePreset}
                        onChange={e => setTrackPresets(prev => ({ ...prev, [track.id]: e.target.value }))}
                        style={{ ...selectStyle, color: '#b0bec5', width: 58, flexShrink: 0 }}
                        title="Note / pitch"
                      >
                        {(engine === 'soundfont' ? MIDI_NOTE_PRESETS : track.presets).map(p => (
                          <option key={p.id} value={p.id}>{p.note || p.name}</option>
                        ))}
                      </select>

                      <select
                        value={trackVelocity[track.id] ?? 100}
                        onChange={e => setTrackVelocity(prev => ({ ...prev, [track.id]: Number(e.target.value) }))}
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
                  </div>

                  <button
                    onClick={() => removeChannel(track.id)}
                    disabled={tracks.length <= 1}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: tracks.length <= 1 ? '#37474f' : '#546e7a',
                      cursor: tracks.length <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: 16,
                      padding: '0 2px',
                      flexShrink: 0
                    }}
                    title="Remove this channel"
                    onMouseEnter={e => { if (tracks.length > 1) e.currentTarget.style.color = '#ff5252'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = tracks.length <= 1 ? '#37474f' : '#546e7a'; }}
                  >
                    ×
                  </button>
                </div>

                <button
                  className="btn-hold sticky-hold-control"
                  onClick={() => toggleHold(track.id)}
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

                {row.map((active, stepIdx) => {
                  const isGroupFour = stepIdx % 4 === 0;
                  let padBackground = '#202638';
                  if (active) padBackground = track.color;
                  else if (isHeld) padBackground = `${track.color}44`;

                  return (
                    <div
                      key={stepIdx}
                      onClick={() => togglePad(track.id, stepIdx)}
                      className={`pad-cell step-col-${stepIdx}`}
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
            {Array.from({ length: stepCount }).map((_, i) => (
              <div
                key={i}
                className={`step-num step-col-${i} ${i % STEPS_PER_BAR === 0 ? 'bar-start' : ''}`}
                title={`Bar ${Math.floor(i / STEPS_PER_BAR) + 1}, step ${(i % STEPS_PER_BAR) + 1}`}
              >
                {i % STEPS_PER_BAR === 0 ? `B${Math.floor(i / STEPS_PER_BAR) + 1}` : i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

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
              MIDI IMPORTED
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
            <div style={{ color: '#546e7a', fontSize: 10, marginTop: 4 }}>
              Mapped to sequencer channels
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
