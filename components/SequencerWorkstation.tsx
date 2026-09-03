'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';

export interface TrackDef {
  id: string;
  name: string;
  category: 'Drums' | 'Bass' | 'Synth';
  type: 'membrane' | 'sub808' | 'noise' | 'synth' | 'metal' | 'metal_open' | 'tom' | 'rim' | 'cowbell' | 'fm' | 'acid' | 'poly' | 'pluck' | 'am' | 'space' | 'wobble';
  note: string;
  color: string;
}

export const TRACK_DEFS: TrackDef[] = [
  // Drums & Percussion
  { id: 'kick', name: 'Punch Kick', category: 'Drums', type: 'membrane', note: 'C1', color: '#ff4b4b' },
  { id: 'sub_808', name: '808 Sub Boom', category: 'Drums', type: 'sub808', note: 'A#0', color: '#ff1744' },
  { id: 'snare', name: 'Snare Drum', category: 'Drums', type: 'noise', note: '', color: '#ff8800' },
  { id: 'clap', name: 'Stereo Clap', category: 'Drums', type: 'synth', note: 'D#4', color: '#ff9100' },
  { id: 'hihat', name: 'Closed Hat', category: 'Drums', type: 'metal', note: '32n', color: '#ffd000' },
  { id: 'openhat', name: 'Open Hat', category: 'Drums', type: 'metal_open', note: '8n', color: '#ffea00' },
  { id: 'tom', name: 'Low/Mid Tom', category: 'Drums', type: 'tom', note: 'G1', color: '#d500f9' },
  { id: 'rimshot', name: 'Wood Rimshot', category: 'Drums', type: 'rim', note: 'F4', color: '#e040fb' },
  { id: 'cowbell', name: '808 Cowbell', category: 'Drums', type: 'cowbell', note: 'G#4', color: '#651fff' },

  // Bass & Leads
  { id: 'bass', name: 'Sub Bass FM', category: 'Bass', type: 'fm', note: 'C2', color: '#00e676' },
  { id: 'acid_bass', name: 'Acid Reso Bass', category: 'Bass', type: 'acid', note: 'F1', color: '#76ff03' },
  { id: 'synth_lead', name: 'Lead Saw Synth', category: 'Synth', type: 'poly', note: 'C4', color: '#ff4081' },
  { id: 'pluck', name: 'Hyper Pluck', category: 'Synth', type: 'pluck', note: 'E4', color: '#f50057' },
  { id: 'chord_pad', name: 'Keystick / Pad', category: 'Synth', type: 'am', note: 'G3', color: '#00b0ff' },
  { id: 'space_pad', name: 'Ambient Cosmos', category: 'Synth', type: 'space', note: 'C3', color: '#00e5ff' },
  { id: 'wobble', name: 'LFO Wobble Synth', category: 'Synth', type: 'wobble', note: 'D2', color: '#1de9b6' }
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

  useEffect(() => { holdTonesRef.current = holdTones; }, [holdTones]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => {
    selectedTracksRef.current = selectedTracks;
    selectedTracksSetRef.current = new Set(selectedTracks);
  }, [selectedTracks]);

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
      maxPolyphony: 4,
      oscillator: { type: 'sawtooth' },
      filter: { Q: 6, type: 'lowpass' },
      envelope: { attack: 0.01, decay: 0.18, sustain: 0.2, release: 0.2 },
      filterEnvelope: { attack: 0.02, decay: 0.12, sustain: 0.1, release: 0.15, baseFrequency: 80, octaves: 4 }
    }).connect(masterLimiter);
    acidBass.volume.value = -3;

    const synthLead = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 4,
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.3 }
    }).connect(masterLimiter);
    synthLead.volume.value = -6;

    const pluck = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 4,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.1 }
    }).connect(masterLimiter);
    pluck.volume.value = -3;

    const chordPad = new Tone.PolySynth(Tone.AMSynth, {
      maxPolyphony: 4,
      harmonicity: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.4 }
    }).connect(masterLimiter);
    chordPad.volume.value = -6;

    const spacePad = new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 4,
      harmonicity: 3,
      modulationIndex: 10,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.1, decay: 0.35, sustain: 0.5, release: 0.5 }
    }).connect(masterLimiter);
    spacePad.volume.value = -8;

    const wobble = new Tone.PolySynth(Tone.MonoSynth, {
      maxPolyphony: 4,
      oscillator: { type: 'square' },
      filter: { Q: 4, type: 'lowpass' },
      envelope: { attack: 0.03, decay: 0.18, sustain: 0.4, release: 0.25 },
      filterEnvelope: { attack: 0.08, decay: 0.15, sustain: 0.2, release: 0.2, baseFrequency: 120, octaves: 3 }
    }).connect(masterLimiter);
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
      stepColCacheRef.current = [];
    };
  }, []);

  const triggerInstrument = async (trackDef: TrackDef, time?: number) => {
    try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
      const inst = instrumentsRef.current[trackDef.id];
      if (!inst) return;
      const triggerTime = time !== undefined ? Math.max(time, Tone.now()) : Tone.now();

      if (trackDef.type === 'membrane' || trackDef.type === 'sub808' || trackDef.type === 'tom') {
        inst.triggerAttackRelease(trackDef.note || 'C1', '8n', triggerTime);
      } else if (trackDef.type === 'noise') {
        inst.triggerAttackRelease('16n', triggerTime);
      } else if (trackDef.type === 'metal' || trackDef.type === 'metal_open' || trackDef.type === 'cowbell') {
        inst.triggerAttackRelease(trackDef.note || '32n', triggerTime);
      } else if (trackDef.type === 'fm' || trackDef.type === 'synth' || trackDef.type === 'rim') {
        inst.triggerAttackRelease(trackDef.note || 'C3', '8n', triggerTime);
      } else if (trackDef.type === 'acid' || trackDef.type === 'wobble') {
        inst.triggerAttackRelease(trackDef.note || 'C2', '8n', triggerTime);
      } else if (trackDef.type === 'pluck') {
        inst.triggerAttackRelease(trackDef.note || 'C4', '16n', triggerTime);
      } else if (trackDef.type === 'poly' || trackDef.type === 'am' || trackDef.type === 'space') {
        inst.triggerAttackRelease(trackDef.note || 'C4', '8n', triggerTime);
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
      stepColCacheRef.current = Array.from({ length: DEFAULT_STEPS }, (_, i) => ({
        step: Array.from(document.querySelectorAll<HTMLElement>(`.step-col-${i}`))
      }));

      repeatIdRef.current = Tone.Transport.scheduleRepeat((time: number) => {
        const step = stepRef.current;
        const activeSet = selectedTracksSetRef.current;
        const currentGrid = gridRef.current;
        const currentHolds = holdTonesRef.current;

        for (let i = 0; i < TRACK_DEFS.length; i++) {
          const track = TRACK_DEFS[i];
          if (activeSet.has(track.id)) {
            if (currentGrid[track.id]?.[step] || currentHolds[track.id]) {
              const inst = instrumentsRef.current[track.id];
              if (inst) {
                try {
                  if (track.type === 'membrane' || track.type === 'sub808' || track.type === 'tom') {
                    inst.triggerAttackRelease(track.note || 'C1', '8n', time);
                  } else if (track.type === 'noise') {
                    inst.triggerAttackRelease('16n', time);
                  } else if (track.type === 'metal' || track.type === 'metal_open' || track.type === 'cowbell') {
                    inst.triggerAttackRelease(track.note || '32n', time);
                  } else if (track.type === 'fm' || track.type === 'synth' || track.type === 'rim') {
                    inst.triggerAttackRelease(track.note || 'C3', '8n', time);
                  } else if (track.type === 'acid' || track.type === 'wobble') {
                    inst.triggerAttackRelease(track.note || 'C2', '8n', time);
                  } else if (track.type === 'pluck') {
                    inst.triggerAttackRelease(track.note || 'C4', '16n', time);
                  } else if (track.type === 'poly' || track.type === 'am' || track.type === 'space') {
                    inst.triggerAttackRelease(track.note || 'C4', '8n', time);
                  }
                } catch (err) {
                  // Catch any timing collision silently
                }
              }
            }
          }
        }

        // Use cached DOM arrays — zero querySelectorAll cost in the hot path
        Tone.Draw.schedule(() => {
          const cache = stepColCacheRef.current;
          if (cache.length === 0) return;
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

  const exportMidi = () => {
    try {
      const midi = new Midi();
      midi.header.tempos = [{ bpm: bpm, ticks: 0 }];
      midi.header.timeSignatures = [{ timeSignature: [4, 4], ticks: 0 }];
      midi.header.update();

      const ppq = midi.header.ppq || 480;
      const ticksPer16th = Math.round(ppq / 4);

      const pitchMapping: Record<string, number> = {
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

      let notesAdded = 0;

      TRACK_DEFS.forEach(track => {
        if (!selectedTracks.includes(track.id)) return;
        const trackNotes = grid[track.id];
        const isHeld = holdTones[track.id];
        const midiTrack = midi.addTrack();
        midiTrack.name = track.name;

        const midiPitch = pitchMapping[track.id] || 60;

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

  const handleMidiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-imported later
    e.target.value = '';

    try {
      const buffer = await file.arrayBuffer();
      const imported = new Midi(buffer);

      // --- Stop sequencer cleanly before touching the grid ---
      // This prevents the playback loop from reading a half-updated grid
      // and scrambling the playhead / step counters.
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
      // @tonejs/midi exposes n.ticks (integer) and header.ppq (ticks per quarter).
      // A 16th note = ppq / 4 ticks. This is immune to BPM mismatch between
      // the MIDI file's embedded tempo and the current slider value.
      const ppq = imported.header.ppq || 480;
      const ticksPer16th = ppq / 4;

      const newGrid: Record<string, boolean[]> = {};
      TRACK_DEFS.forEach(t => {
        newGrid[t.id] = Array(DEFAULT_STEPS).fill(false);
      });

      // Filter out meta/tempo tracks (0 notes) BEFORE indexing,
      // so the slot counter i is never thrown off by skipped tracks.
      // Your stress test has 1 empty tempo track + 16 instrument tracks —
      // without this filter every track would be shifted one slot to the right.
      const instrumentTracks = imported.tracks.filter(t => t.notes.length > 0);

      instrumentTracks.forEach((t, i) => {
        const assignedTrackDef = TRACK_DEFS[i % TRACK_DEFS.length];
        t.notes.forEach(n => {
          // Use integer ticks — no floating point rounding error
          const stepIndex = Math.round(n.ticks / ticksPer16th) % DEFAULT_STEPS;
          newGrid[assignedTrackDef.id][stepIndex] = true;
        });
      });

      setGrid(newGrid);

      // Show toast — auto-dismiss after 3 s
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setMidiToast({ visible: true, fileName: file.name });
      toastTimerRef.current = setTimeout(() => {
        setMidiToast(prev => ({ ...prev, visible: false }));
      }, 3000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to parse MIDI file: ' + (err?.message || err));
    }
  };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: '#00e5ff', fontWeight: 800, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 0 }}>
            {'SNUZY DRUM & SYNTH WORKSTATION'.split('').map((char, i) => (
              <span
                key={i}
                className="title-wave-letter"
                style={{ animationDelay: `${i * 0.1}s`, display: 'inline-block', whiteSpace: 'pre' }}
              >
                {char}
              </span>
            ))}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#90a4ae', fontSize: 13 }}>
            Tone.js Audio Synthesis • Multi-layer Looper • MIDI File Exporter & Importer
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
        <div style={{ display: 'flex', gap: 8 }}>
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
            ↑ Load MIDI
            <input type="file" accept=".mid,.midi" onChange={handleMidiImport} style={{ display: 'none' }} />
          </label>

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
            ↓ Export to MIDI (.mid)
          </button>
        </div>
      </div>

      {/* Sequencer Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, backgroundColor: '#131620', padding: 16, borderRadius: 10 }}>
        {TRACK_DEFS.map((track, trackIdx) => {
          const isSelected = selectedTracks.includes(track.id);
          const isHeld = holdTones[track.id];
          const prevTrack = trackIdx > 0 ? TRACK_DEFS[trackIdx - 1] : null;
          const isNewCategory = !prevTrack || prevTrack.category !== track.category;

          return (
            <React.Fragment key={track.id}>
              {isNewCategory && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: track.category === 'Drums' ? '#ff9100' : track.category === 'Bass' ? '#00e676' : '#00e5ff',
                    marginTop: trackIdx > 0 ? 10 : 0,
                    marginBottom: 2,
                    paddingLeft: 4
                  }}
                >
                  ● {track.category}
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '170px 72px repeat(16, 1fr)',
                  gap: 6,
                  alignItems: 'center',
                  opacity: isSelected ? 1 : 0.4,
                  transition: 'opacity 0.2s'
                }}
              >
                {/* Track Info & Enable */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    backgroundColor: '#1b2030',
                    borderRadius: 6,
                    borderLeft: `4px solid ${track.color}`
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTrackSelect(track.id)}
                    title="Enable/Disable Track in mix"
                    style={{ accentColor: track.color, cursor: 'pointer' }}
                  />
                  <button
                    onClick={() => triggerInstrument(track)}
                    className="track-label-btn"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f0f3f6',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      textAlign: 'left',
                      padding: 0,
                      flex: 1
                    }}
                    title="Click to preview synth sound"
                  >
                    {track.name}
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
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Numbers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '170px 72px repeat(16, 1fr)',
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