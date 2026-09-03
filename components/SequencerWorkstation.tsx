'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import {
  GM_INSTRUMENTS,
  getInstrumentsByCategory,
  SoundFontPlayer,
  GMInstrument
} from './SoundFontEngine';

export interface SoundPreset {
  id: string;
  name: string;
  note?: string;
  engine?: string; // override engine or timbre setting
}

export interface TrackDef {
  id: string;
  name: string;
  category: 'Drums' | 'Bass' | 'Synth' | 'SoundFont Instruments';
  type: 'membrane' | 'sub808' | 'noise' | 'synth' | 'metal' | 'metal_open' | 'tom' | 'rim' | 'cowbell' | 'fm' | 'acid' | 'poly' | 'pluck' | 'am' | 'space' | 'wobble' | 'soundfont';
  note: string;
  color: string;
  presets: SoundPreset[];
  defaultGmId?: number;
}

export const TRACK_DEFS: TrackDef[] = [
  // Drums & Percussion
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

  // Bass & Leads
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

  // Realistic General MIDI SoundFont Instruments (FluidR3 GM Sampler)
  {
    id: 'sf_piano',
    name: 'Concert Piano',
    category: 'SoundFont Instruments',
    type: 'soundfont',
    note: 'C4',
    color: '#f9a825',
    defaultGmId: 0, // Acoustic Grand Piano
    presets: [
      { id: 'c4', name: 'Middle C4', note: 'C4' },
      { id: 'e4', name: 'Bright E4', note: 'E4' },
      { id: 'g4', name: 'Fifth G4', note: 'G4' },
      { id: 'c3', name: 'Warm C3', note: 'C3' },
      { id: 'c5', name: 'High C5', note: 'C5' }
    ]
  },
  {
    id: 'sf_guitar',
    name: 'Acoustic Guitar',
    category: 'SoundFont Instruments',
    type: 'soundfont',
    note: 'E3',
    color: '#fb8c00',
    defaultGmId: 24, // Acoustic Guitar (nylon)
    presets: [
      { id: 'e3', name: 'Root E3', note: 'E3' },
      { id: 'a3', name: 'Strum A3', note: 'A3' },
      { id: 'd4', name: 'Lead D4', note: 'D4' },
      { id: 'g3', name: 'Warm G3', note: 'G3' }
    ]
  },
  {
    id: 'sf_strings',
    name: 'Orchestral Strings',
    category: 'SoundFont Instruments',
    type: 'soundfont',
    note: 'G3',
    color: '#ab47bc',
    defaultGmId: 48, // String Ensemble 1
    presets: [
      { id: 'g3', name: 'Ensemble G3', note: 'G3' },
      { id: 'c3', name: 'Deep C3', note: 'C3' },
      { id: 'e4', name: 'Lush E4', note: 'E4' },
      { id: 'a3', name: 'Airy A3', note: 'A3' }
    ]
  },
  {
    id: 'sf_brass',
    name: 'Brass Section',
    category: 'SoundFont Instruments',
    type: 'soundfont',
    note: 'C4',
    color: '#ffd600',
    defaultGmId: 61, // Brass Section
    presets: [
      { id: 'c4', name: 'Hit C4', note: 'C4' },
      { id: 'f3', name: 'Low F3', note: 'F3' },
      { id: 'g4', name: 'Fanfare G4', note: 'G4' },
      { id: 'a#3', name: 'Stab A#3', note: 'A#3' }
    ]
  }
];

export const DEFAULT_STEPS = 16;
export const DEFAULT_BPM = 120;

export default function SequencerWorkstation() {
  const [bpm, setBpm] = useState<number>(DEFAULT_BPM);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedTracks, setSelectedTracks] = useState<string[]>(TRACK_DEFS.map(t => t.id));
  const [holdTones, setHoldTones] = useState<Record<string, boolean>>({});
  const [midiToast, setMidiToast] = useState<{ visible: boolean; fileName: string }>({ visible: false, fileName: '' });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active track sound preset selections { [trackId]: presetId }
  const [trackPresets, setTrackPresets] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    TRACK_DEFS.forEach(t => {
      initial[t.id] = t.presets[0]?.id || '';
    });
    return initial;
  });

  // Track lines removed/hidden by user { [trackId]: boolean }
  const [removedTracks, setRemovedTracks] = useState<Record<string, boolean>>({});

  // Category collapse state { 'Drums': false, 'Bass': false, 'Synth': false }
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const trackPresetsRef = useRef(trackPresets);
  useEffect(() => { trackPresetsRef.current = trackPresets; }, [trackPresets]);

  const [grid, setGrid] = useState<Record<string, boolean[]>>(() => {
    const initial: Record<string, boolean[]> = {};
    TRACK_DEFS.forEach(t => {
      initial[t.id] = Array(DEFAULT_STEPS).fill(false);
    });
    // Default starting pattern
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
  // Cached DOM columns so Tone.Draw never runs querySelectorAll on every tick
  const stepColCacheRef = useRef<Array<{ step: HTMLElement[]; }>>([]);
  // Set for O(1) track-active lookup instead of Array.includes per step
  const selectedTracksSetRef = useRef<Set<string>>(new Set(selectedTracks));
  // Master limiter ref for cleanup
  const limiterRef = useRef<Tone.Limiter | null>(null);

  // Memoized GM instruments grouped by category for selection
  const groupedGmInstruments = React.useMemo(() => getInstrumentsByCategory(), []);

  // SoundFont General MIDI program selection per track: { [trackId]: gmInstrumentId (0-127) }
  const [trackGmInstruments, setTrackGmInstruments] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    TRACK_DEFS.forEach(t => {
      if (t.defaultGmId !== undefined) {
        initial[t.id] = t.defaultGmId;
      }
    });
    return initial;
  });

  const trackGmInstrumentsRef = useRef(trackGmInstruments);
  useEffect(() => { trackGmInstrumentsRef.current = trackGmInstruments; }, [trackGmInstruments]);

  // Loading indicator states for soundfont instruments: { [gmId]: 'loading' | 'loaded' | 'error' }
  const [sfStatus, setSfStatus] = useState<Record<number, string>>({});

  const soundFontPlayerRef = useRef<SoundFontPlayer | null>(null);

  // Helper to ensure an instrument is loaded
  const loadSoundFontInstrument = async (gmId: number) => {
    const player = soundFontPlayerRef.current;
    if (!player) return;
    if (player.isLoaded(gmId)) return;
    try {
      setSfStatus(prev => ({ ...prev, [gmId]: 'loading' }));
      await player.loadInstrument(gmId);
      setSfStatus(prev => ({ ...prev, [gmId]: 'loaded' }));
    } catch (e: any) {
      setSfStatus(prev => ({ ...prev, [gmId]: 'error' }));
    }
  };

  // Pre-load default instruments on initial mount once Audio is available
  useEffect(() => {
    if (soundFontPlayerRef.current) {
      const defaultIds = [0, 24, 48, 61]; // Piano, Guitar, Strings, Brass
      defaultIds.forEach(id => {
        loadSoundFontInstrument(id);
      });
    }
  }, []);

  const refreshStepColCache = () => {
    stepColCacheRef.current = Array.from({ length: DEFAULT_STEPS }, (_, i) => ({
      step: Array.from(document.querySelectorAll<HTMLElement>(`.step-col-${i}`))
    }));
  };

  useEffect(() => { holdTonesRef.current = holdTones; }, [holdTones]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => {
    selectedTracksRef.current = selectedTracks;
    selectedTracksSetRef.current = new Set(selectedTracks);
  }, [selectedTracks]);

  // When categories collapse/expand or tracks are removed/restored, refresh cached pad DOM elements
  useEffect(() => {
    if (isPlaying) {
      // Allow DOM to finish mounting/unmounting new track rows
      requestAnimationFrame(() => {
        refreshStepColCache();
      });
    }
  }, [collapsedCategories, removedTracks, isPlaying]);

  // Real-time BPM update
  useEffect(() => {
    try {
      Tone.Transport.bpm.rampTo(bpm, 0.05);
    } catch (e) {
      // ignore before audio context is initialized
    }
  }, [bpm]);

  // Audio synths initialization on client side
  useEffect(() => {
    // Configure Web Audio latency & lookahead to prevent audio starvation during heavy load
    try {
      Tone.getContext().lookAhead = 0.1;
    } catch (e) {}

    // Master limiter prevents clipping when multiple voices play simultaneously
    const masterLimiter = new Tone.Limiter(-1).toDestination();
    limiterRef.current = masterLimiter;

    // Initialize General MIDI SoundFont Player
    const sfPlayer = new SoundFontPlayer(masterLimiter);
    soundFontPlayerRef.current = sfPlayer;
    sfPlayer.onStateChange = ({ instrumentId, state }) => {
      setSfStatus(prev => ({ ...prev, [instrumentId]: state }));
    };

    // Preload default SoundFont instruments (Piano, Guitar, Strings, Brass)
    [0, 24, 48, 61].forEach(id => {
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
      kick,
      sub_808: sub808,
      snare,
      clap,
      hihat,
      openhat,
      tom,
      rimshot,
      cowbell,
      bass,
      acid_bass: acidBass,
      synth_lead: synthLead,
      pluck,
      chord_pad: chordPad,
      space_pad: spacePad,
      wobble
    };

    return () => {
      try {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      } catch (e) {}
      Object.values(instrumentsRef.current).forEach(inst => {
        try {
          inst.dispose();
        } catch {
          // ignore
        }
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
    const preset = trackDef.presets.find(p => p.id === selectedPresetId);
    return preset?.note || trackDef.note;
  };

  const triggerInstrument = async (trackDef: TrackDef, time?: number) => {
    try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
      if (trackDef.type === 'soundfont') {
        const gmId = trackGmInstrumentsRef.current[trackDef.id] ?? trackDef.defaultGmId ?? 0;
        const player = soundFontPlayerRef.current;
        if (player) {
          if (!player.isLoaded(gmId)) {
            loadSoundFontInstrument(gmId).then(() => {
              player.triggerNote(gmId, currentNote || 'C4', '8n');
            });
          } else {
            player.triggerNote(gmId, currentNote || 'C4', '8n', triggerTime);
          }
        }
        return;
      }

      const inst = instrumentsRef.current[trackDef.id];
      if (!inst) return;
      const triggerTime = time !== undefined ? Math.max(time, Tone.now()) : Tone.now();
      const currentNote = getTrackActiveNote(trackDef);

      if (trackDef.type === 'membrane' || trackDef.type === 'sub808' || trackDef.type === 'tom') {
        inst.triggerAttackRelease(currentNote || 'C1', '8n', triggerTime);
      } else if (trackDef.type === 'noise') {
        inst.triggerAttackRelease(currentNote || '16n', triggerTime);
      } else if (trackDef.type === 'metal' || trackDef.type === 'metal_open' || trackDef.type === 'cowbell') {
        inst.triggerAttackRelease(currentNote || '32n', triggerTime);
      } else if (trackDef.type === 'fm' || trackDef.type === 'synth' || trackDef.type === 'rim') {
        inst.triggerAttackRelease(currentNote || 'C3', '8n', triggerTime);
      } else if (trackDef.type === 'acid' || trackDef.type === 'wobble') {
        inst.triggerAttackRelease(currentNote || 'C2', '8n', triggerTime);
      } else if (trackDef.type === 'pluck') {
        inst.triggerAttackRelease(currentNote || 'C4', '16n', triggerTime);
      } else if (trackDef.type === 'poly' || trackDef.type === 'am' || trackDef.type === 'space') {
        inst.triggerAttackRelease(currentNote || 'C4', '8n', triggerTime);
      }
    } catch (e) {
      // Catch any overlapping audio thread collision
    }
  };

  const togglePlayback = async () => {
    try {
      if (isPlaying) {
        Tone.Transport.stop();
        if (repeatIdRef.current !== null) {
          Tone.Transport.clear(repeatIdRef.current);
          repeatIdRef.current = null;
        }
        setIsPlaying(false);
        stepRef.current = 0;
        // Clear playhead from cached or fallback DOM
        const cache = stepColCacheRef.current;
        if (cache.length > 0) {
          cache.forEach(c => c.step.forEach(el => el.classList.remove('step-current')));
        } else {
          document.querySelectorAll('.step-current').forEach(el => el.classList.remove('step-current'));
        }
        return;
      }

      await Tone.start();
      Tone.Transport.bpm.value = bpm;
      stepRef.current = 0;

      // Pre-cache all step-col DOM elements once so Tone.Draw never queries the DOM per tick
      refreshStepColCache();

      repeatIdRef.current = Tone.Transport.scheduleRepeat((time: number) => {
        const step = stepRef.current;
        const activeSet = selectedTracksSetRef.current;
        const currentGrid = gridRef.current;
        const currentHolds = holdTonesRef.current;

        for (let i = 0; i < TRACK_DEFS.length; i++) {
          const track = TRACK_DEFS[i];
          if (activeSet.has(track.id)) {
            if (currentGrid[track.id]?.[step] || currentHolds[track.id]) {
              if (track.type === 'soundfont') {
                const gmId = trackGmInstrumentsRef.current[track.id] ?? track.defaultGmId ?? 0;
                const player = soundFontPlayerRef.current;
                if (player && player.isLoaded(gmId)) {
                  try {
                    const currentNote = getTrackActiveNote(track);
                    player.triggerNote(gmId, currentNote || 'C4', '8n', time);
                  } catch (err) {}
                }
              } else {
                const inst = instrumentsRef.current[track.id];
                if (inst) {
                  try {
                    const currentNote = getTrackActiveNote(track);
                    if (track.type === 'membrane' || track.type === 'sub808' || track.type === 'tom') {
                      inst.triggerAttackRelease(currentNote || 'C1', '8n', time);
                    } else if (track.type === 'noise') {
                      inst.triggerAttackRelease(currentNote || '16n', time);
                    } else if (track.type === 'metal' || track.type === 'metal_open' || track.type === 'cowbell') {
                      inst.triggerAttackRelease(currentNote || '32n', time);
                    } else if (track.type === 'fm' || track.type === 'synth' || track.type === 'rim') {
                      inst.triggerAttackRelease(currentNote || 'C3', '8n', time);
                    } else if (track.type === 'acid' || track.type === 'wobble') {
                      inst.triggerAttackRelease(currentNote || 'C2', '8n', time);
                    } else if (track.type === 'pluck') {
                      inst.triggerAttackRelease(currentNote || 'C4', '16n', time);
                    } else if (track.type === 'poly' || track.type === 'am' || track.type === 'space') {
                      inst.triggerAttackRelease(currentNote || 'C4', '8n', time);
                    }
                  } catch (err) {
                    // Catch any timing collision silently
                  }
                }
              }
            }
          }
        }

        // Use cached DOM arrays — zero querySelectorAll cost in the hot path
        Tone.Draw.schedule(() => {
          let cache = stepColCacheRef.current;
          if (cache.length === 0) {
            refreshStepColCache();
            cache = stepColCacheRef.current;
          }
          const prevStep = (step - 1 + DEFAULT_STEPS) % DEFAULT_STEPS;
          cache[prevStep]?.step.forEach(el => el.classList.remove('step-current'));
          cache[step]?.step.forEach(el => el.classList.add('step-current'));
        }, time);

        stepRef.current = (step + 1) % DEFAULT_STEPS;
      }, '16n');

      Tone.Transport.start();
      setIsPlaying(true);
    } catch (err) {
      console.error('Playback failed to start:', err);
    }
  };

  const togglePad = (trackId: string, stepIdx: number) => {
    setGrid(prev => {
      const row = [...prev[trackId]];
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
        const def = TRACK_DEFS.find(t => t.id === trackId);
        if (def) triggerInstrument(def);
      }
      return next;
    });
  };

  const clearGrid = () => {
    const empty: Record<string, boolean[]> = {};
    TRACK_DEFS.forEach(t => {
      empty[t.id] = Array(DEFAULT_STEPS).fill(false);
    });
    setGrid(empty);
  };

  // Helper to convert note names (e.g. 'C2', 'D#4', 'A#0') into standard MIDI pitch numbers (0-127)
  const getMidiPitchForTrack = (track: TrackDef): number => {
    const activeNote = getTrackActiveNote(track);
    // If it's a rhythmic length like '16n', '32n', fallback to default pitch mapping
    if (!activeNote || activeNote.endsWith('n')) {
      const fallbackPitchMapping: Record<string, number> = {
        kick: 36,
        sub_808: 34,
        snare: 38,
        clap: 39,
        hihat: 42,
        openhat: 46,
        tom: 45,
        rimshot: 37,
        cowbell: 56,
        bass: 36,
        acid_bass: 41,
        synth_lead: 60,
        pluck: 64,
        chord_pad: 55,
        space_pad: 48,
        wobble: 38
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

      TRACK_DEFS.forEach(track => {
        if (!selectedTracks.includes(track.id)) return;
        if (removedTracks[track.id]) return; // Skip tracks removed by user

        const trackNotes = grid[track.id];
        const isHeld = holdTones[track.id];
        const midiTrack = midi.addTrack();
        const activePreset = trackPresets[track.id] || track.presets[0]?.id;
        
        if (track.type === 'soundfont') {
          const gmId = trackGmInstruments[track.id] ?? track.defaultGmId ?? 0;
          const gmInst = GM_INSTRUMENTS[gmId];
          midiTrack.name = gmInst ? `${gmInst.name} (${activePreset})` : `${track.name} (${activePreset})`;
          midiTrack.instrument.number = gmId;
        } else {
          midiTrack.name = `${track.name} (${activePreset})`;
        }

        const midiPitch = getMidiPitchForTrack(track);

        for (let s = 0; s < DEFAULT_STEPS; s++) {
          if (trackNotes[s] || isHeld) {
            midiTrack.addNote({
              midi: midiPitch,
              ticks: s * ticksPer16th,
              durationTicks: Math.max(1, Math.round(ticksPer16th * 0.85)),
              velocity: 0.85
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

  // Export full project file (.json) that saves 100% of sequencer settings:
  // BPM, grid patterns, sound presets for all instruments, active tracks, holds, and collapsed categories!
  const exportProject = () => {
    try {
      const projectData = {
        app: 'snuzy-workstation',
        version: '1.0',
        timestamp: Date.now(),
        bpm,
        grid,
        trackPresets,
        trackGmInstruments,
        selectedTracks,
        holdTones,
        removedTracks,
        collapsedCategories
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

    // Reset input so the same file can be re-imported later
    e.target.value = '';

    try {
      // Check if user uploaded a complete Snuzy project JSON file
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.app === 'snuzy-workstation') {
          if (typeof data.bpm === 'number') setBpm(data.bpm);
          if (data.grid) setGrid(data.grid);
          if (data.trackPresets) setTrackPresets(data.trackPresets);
          if (data.trackGmInstruments) setTrackGmInstruments(data.trackGmInstruments);
          if (data.selectedTracks) setSelectedTracks(data.selectedTracks);
          if (data.holdTones) setHoldTones(data.holdTones);
          if (data.removedTracks) setRemovedTracks(data.removedTracks);
          if (data.collapsedCategories) setCollapsedCategories(data.collapsedCategories);

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

      // --- Stop sequencer cleanly before touching the grid ---
      if (isPlaying) {
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
        stepColCacheRef.current = [];
      }

      // --- Tick-based quantization (no BPM drift, no float errors) ---
      const ppq = imported.header.ppq || 480;
      const ticksPer16th = ppq / 4;

      const newGrid: Record<string, boolean[]> = {};
      TRACK_DEFS.forEach(t => {
        newGrid[t.id] = Array(DEFAULT_STEPS).fill(false);
      });

      // Also restore BPM if embedded in MIDI file
      if (imported.header.tempos && imported.header.tempos.length > 0) {
        const fileBpm = Math.round(imported.header.tempos[0].bpm);
        if (fileBpm >= 60 && fileBpm <= 180) {
          setBpm(fileBpm);
        }
      }

      const instrumentTracks = imported.tracks.filter(t => t.notes.length > 0);
      const updatedGmMap = { ...trackGmInstrumentsRef.current };

      instrumentTracks.forEach((t, i) => {
        const assignedTrackDef = TRACK_DEFS[i % TRACK_DEFS.length];
        if (assignedTrackDef.type === 'soundfont' && typeof t.instrument?.number === 'number') {
          const gmProg = Math.max(0, Math.min(127, t.instrument.number));
          updatedGmMap[assignedTrackDef.id] = gmProg;
          loadSoundFontInstrument(gmProg);
        }
        t.notes.forEach(n => {
          const stepIndex = Math.round(n.ticks / ticksPer16th) % DEFAULT_STEPS;
          newGrid[assignedTrackDef.id][stepIndex] = true;
        });
      });

      setTrackGmInstruments(updatedGmMap);
      setGrid(newGrid);

      // Show toast — auto-dismiss after 3 s
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setMidiToast({ visible: true, fileName: file.name });
      toastTimerRef.current = setTimeout(() => {
        setMidiToast(prev => ({ ...prev, visible: false }));
      }, 3000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to parse file: ' + (err?.message || err));
    }
  };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: '#00e5ff', fontWeight: 800, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 0 }}>
            {(() => {
              const text = 'SNUZY DRUM & SYNTH WORKSTATION';
              const len = text.length; // 30
              const stepSec = 0.115; // ~65 BPM step per letter
              const pauseSec = 0.2; // Turnaround pause at each end
              const fwdTime = len * stepSec; // ~3.45s
              const revTime = len * stepSec; // ~3.45s
              const totalCycle = fwdTime + pauseSec + revTime + pauseSec; // ~7.3s

              // Keyframe definition injected once
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
            Tone.js Synths + 128 General MIDI SoundFont Instruments • Multi-layer Looper • MIDI Exporter & Importer
          </p>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
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
            {isPlaying ? '■ STOP' : '▶ PLAY LOOP'}
          </button>
        </div>
      </header>

      {/* Action Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#171b26',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setSelectedTracks(TRACK_DEFS.map(t => t.id))}
            className="btn-toolbar"
            style={{ padding: '6px 12px', background: '#262f40', color: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Select All Tracks
          </button>
          <button
            onClick={() => setSelectedTracks([])}
            className="btn-toolbar"
            style={{ padding: '6px 12px', background: '#262f40', color: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Deselect All
          </button>
          <button
            onClick={clearGrid}
            className="btn-toolbar"
            style={{ padding: '6px 12px', background: '#3b242e', color: '#ff8a80', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Clear Pattern
          </button>
          {Object.values(removedTracks).some(Boolean) && (
            <button
              onClick={() => setRemovedTracks({})}
              className="btn-toolbar"
              style={{ padding: '6px 12px', background: '#1c313a', color: '#00e5ff', border: '1px solid #00e5ff55', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
              title="Restore all hidden track lines"
            >
              ↺ Restore Hidden Tracks ({Object.values(removedTracks).filter(Boolean).length})
            </button>
          )}
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
            ↑ Load File
            <input type="file" accept=".mid,.midi,.json" onChange={handleMidiImport} style={{ display: 'none' }} />
          </label>

          <button
            onClick={exportProject}
            className="btn-toolbar"
            style={{
              padding: '7px 16px',
              backgroundColor: '#00e676',
              color: '#000',
              fontWeight: 700,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            ↓ Save Project (.json)
          </button>

          <button
            onClick={exportMidi}
            className="btn-toolbar"
            style={{
              padding: '7px 16px',
              backgroundColor: '#00b0ff',
              color: '#000',
              fontWeight: 700,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13
            }}
          >
            ↓ Export MIDI (.mid)
          </button>
        </div>
      </div>

      {/* Sequencer Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, backgroundColor: '#131620', padding: 16, borderRadius: 10 }}>
        {(['Drums', 'Bass', 'Synth', 'SoundFont Instruments'] as const).map(category => {
          const categoryTracks = TRACK_DEFS.filter(t => t.category === category);
          const isCollapsed = !!collapsedCategories[category];
          const activeCategoryTracks = categoryTracks.filter(t => !removedTracks[t.id]);
          const catColor = category === 'Drums' ? '#ff9100' : category === 'Bass' ? '#00e676' : category === 'Synth' ? '#00e5ff' : '#f9a825';

          return (
            <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Category Expand/Collapse Header */}
              <div
                onClick={() => setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  backgroundColor: '#191e2b',
                  borderRadius: 5,
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderLeft: `4px solid ${catColor}`,
                  marginTop: category === 'Drums' ? 0 : 8
                }}
                title="Click to collapse / expand this section"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: catColor }}>
                  <span>{isCollapsed ? '▶' : '▼'}</span>
                  <span>{category}</span>
                  <span style={{ fontSize: 10, color: '#90a4ae', fontWeight: 500, textTransform: 'none' }}>
                    ({activeCategoryTracks.length} tracks{categoryTracks.length > activeCategoryTracks.length ? ` • ${categoryTracks.length - activeCategoryTracks.length} hidden` : ''})
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#78909c' }}>
                  {isCollapsed ? 'Click to expand' : 'Collapse'}
                </div>
              </div>

              {/* Tracks in Category */}
              {!isCollapsed && activeCategoryTracks.map(track => {
                const isSelected = selectedTracks.includes(track.id);
                const isHeld = holdTones[track.id];
                const activePreset = trackPresets[track.id] || track.presets[0]?.id;

                return (
                  <div
                    key={track.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '200px 72px repeat(16, 1fr)',
                      gap: 6,
                      alignItems: 'center',
                      opacity: isSelected ? 1 : 0.4,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    {/* Track Info, Sound Preset Picker & Remove Line Button */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 6px',
                        backgroundColor: '#1b2030',
                        borderRadius: 6,
                        borderLeft: `4px solid ${track.color}`,
                        minWidth: 0,
                        overflow: 'hidden'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTrackSelect(track.id)}
                        title="Enable/Disable Track in mix"
                        style={{ accentColor: track.color, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
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
                            textOverflow: 'ellipsis'
                          }}
                          title="Click to preview synth sound"
                        >
                          {track.name}
                        </button>
                        {track.type === 'soundfont' ? (
                          <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center' }}>
                            {/* 128 GM Instrument Picker organized by Category */}
                            <select
                              value={trackGmInstruments[track.id] ?? track.defaultGmId ?? 0}
                              onChange={async (e) => {
                                const newGmId = Number(e.target.value);
                                setTrackGmInstruments(prev => ({ ...prev, [track.id]: newGmId }));
                                await loadSoundFontInstrument(newGmId);
                                const currentNote = getTrackActiveNote(track);
                                soundFontPlayerRef.current?.triggerNote(newGmId, currentNote || 'C4', '8n');
                              }}
                              style={{
                                background: '#131722',
                                color: track.color,
                                border: '1px solid #2e384d',
                                borderRadius: 3,
                                fontSize: 10,
                                padding: '1px 3px',
                                cursor: 'pointer',
                                outline: 'none',
                                flex: 1,
                                minWidth: 0,
                                textOverflow: 'ellipsis'
                              }}
                              title="Select any of the 128 General MIDI instruments"
                            >
                              {Object.entries(groupedGmInstruments).map(([cat, insts]) => (
                                <optgroup key={cat} label={cat} style={{ background: '#171b26', color: '#00e5ff', fontWeight: 'bold' }}>
                                  {insts.map(inst => (
                                    <option key={inst.id} value={inst.id} style={{ background: '#171b26', color: '#fff' }}>
                                      {inst.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>

                            {/* Pitch / Octave Note selector */}
                            <select
                              value={activePreset}
                              onChange={e => setTrackPresets(prev => ({ ...prev, [track.id]: e.target.value }))}
                              style={{
                                background: '#131722',
                                color: '#b0bec5',
                                border: '1px solid #2e384d',
                                borderRadius: 3,
                                fontSize: 9,
                                padding: '1px 2px',
                                cursor: 'pointer',
                                outline: 'none',
                                flexShrink: 0
                              }}
                              title="Select base pitch octave"
                            >
                              {track.presets.map(p => (
                                <option key={p.id} value={p.id} style={{ background: '#171b26', color: '#fff' }}>
                                  {p.note || p.name}
                                </option>
                              ))}
                            </select>

                            {/* Loading / Ready status badge */}
                            {(() => {
                              const currentGm = trackGmInstruments[track.id] ?? track.defaultGmId ?? 0;
                              const status = sfStatus[currentGm] || (soundFontPlayerRef.current?.isLoaded(currentGm) ? 'loaded' : 'idle');
                              if (status === 'loading') {
                                return (
                                  <span
                                    title="Downloading high-quality SoundFont samples..."
                                    style={{
                                      fontSize: 9,
                                      color: '#ffd600',
                                      padding: '1px 3px',
                                      borderRadius: 2,
                                      background: '#ffd60022',
                                      animation: 'pulse 1s infinite'
                                    }}
                                  >
                                    ⏳
                                  </span>
                                );
                              }
                              return (
                                <span
                                  title="SoundFont sampler ready"
                                  style={{
                                    fontSize: 8,
                                    color: '#00e676',
                                    fontWeight: 700
                                  }}
                                >
                                  HD
                                </span>
                              );
                            })()}
                          </div>
                        ) : (
                          /* Sound Variant Dropdown for Standard Synth tracks */
                          <select
                            value={activePreset}
                            onChange={e => setTrackPresets(prev => ({ ...prev, [track.id]: e.target.value }))}
                            style={{
                              background: '#131722',
                              color: track.color,
                              border: '1px solid #2e384d',
                              borderRadius: 3,
                              fontSize: 10,
                              padding: '1px 3px',
                              marginTop: 2,
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                            title="Change sound timbre / pitch preset"
                          >
                            {track.presets.map(p => (
                              <option key={p.id} value={p.id} style={{ background: '#171b26', color: '#fff' }}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Remove Track Line Button */}
                      <button
                        onClick={() => setRemovedTracks(prev => ({ ...prev, [track.id]: true }))}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#546e7a',
                          cursor: 'pointer',
                          fontSize: 14,
                          padding: '0 2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title="Remove track line (can be restored from toolbar)"
                        onMouseEnter={e => (e.currentTarget.style.color = '#ff5252')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#546e7a')}
                      >
                        ×
                      </button>
                    </div>

                    {/* Hold / Key-Stick Toggle */}
                    <button
                      onClick={() => toggleHold(track.id)}
                      className="btn-hold"
                      style={{
                        padding: '6px 0',
                        fontSize: 11,
                        fontWeight: 800,
                        borderRadius: 6,
                        border: isHeld ? `1px solid ${track.color}` : '1px solid #37474f',
                        backgroundColor: isHeld ? track.color : '#1c2130',
                        color: isHeld ? '#000' : '#b0bec5',
                        cursor: 'pointer',
                        textTransform: 'uppercase'
                      }}
                      title="Continuous hold / key-stick note sustain for every step"
                    >
                      {isHeld ? 'HELD' : 'HOLD'}
                    </button>

                    {/* 16 Step Pads */}
                    {grid[track.id].map((active, stepIdx) => {
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
            </div>
          );
        })}
      </div>

      {/* Step Numbers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 72px repeat(16, 1fr)',
          gap: 6,
          marginTop: 8,
          padding: '0 16px',
          textAlign: 'center'
        }}
      >
        <div></div>
        <div></div>
        {Array.from({ length: DEFAULT_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`step-num step-col-${i}`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* MIDI Import Toast */}
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
            transition: 'opacity 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* Checkmark circle */}
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
              Mapped to sequencer steps
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}