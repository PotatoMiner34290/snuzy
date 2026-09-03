import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';

const TRACK_DEFS = [
  { id: 'kick', name: 'Kick Drum', type: 'membrane', note: 'C1', color: '#ff4b4b' },
  { id: 'snare', name: 'Snare Drum', type: 'noise', note: '', color: '#ff8800' },
  { id: 'hihat', name: 'Closed Hat', type: 'metal', note: '32n', color: '#ffd000' },
  { id: 'openhat', name: 'Open Hat', type: 'metal', note: '8n', color: '#00e5ff' },
  { id: 'clap', name: 'Synth Clap', type: 'synth', note: 'D#4', color: '#7c4dff' },
  { id: 'bass', name: 'Sub Bass Synth', type: 'fm', note: 'C2', color: '#00e676' },
  { id: 'synth_lead', name: 'Lead Synth', type: 'poly', note: 'C4', color: '#ff4081' },
  { id: 'chord_pad', name: 'Keystick / Pad', type: 'am', note: 'G3', color: '#00b0ff' }
];

const DEFAULT_STEPS = 16;
const DEFAULT_BPM = 120;

export default function App() {
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTracks, setSelectedTracks] = useState(TRACK_DEFS.map(t => t.id));
  const [holdTones, setHoldTones] = useState({});

  const [grid, setGrid] = useState(() => {
    const initial = {};
    TRACK_DEFS.forEach(t => {
      initial[t.id] = Array(DEFAULT_STEPS).fill(false);
    });
    // Default starting beat
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

  const instrumentsRef = useRef({});
  const repeatIdRef = useRef(null);
  const stepRef = useRef(0);
  const holdTonesRef = useRef(holdTones);
  const gridRef = useRef(grid);
  const selectedTracksRef = useRef(selectedTracks);

  useEffect(() => { holdTonesRef.current = holdTones; }, [holdTones]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { selectedTracksRef.current = selectedTracks; }, [selectedTracks]);

  // Real-time BPM update without stopping the loop
  useEffect(() => {
    Tone.Transport.bpm.rampTo(bpm, 0.05);
  }, [bpm]);

  useEffect(() => {
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 }
    }).toDestination();

    const snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
    }).toDestination();

    const hihat = new Tone.MetalSynth({
      frequency: 250,
      envelope: { attack: 0.001, decay: 0.05, release: 0.05 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).toDestination();
    hihat.volume.value = -8;

    const openhat = new Tone.MetalSynth({
      frequency: 220,
      envelope: { attack: 0.005, decay: 0.35, release: 0.35 },
      harmonicity: 4.8,
      modulationIndex: 28,
      resonance: 3500,
      octaves: 1.2
    }).toDestination();
    openhat.volume.value = -8;

    const clap = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 }
    }).toDestination();

    const bass = new Tone.FMSynth({
      harmonicity: 1,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.5 }
    }).toDestination();
    bass.volume.value = -3;

    const synthLead = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.2, release: 0.6 }
    }).toDestination();
    synthLead.volume.value = -6;

    const chordPad = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.08, decay: 0.4, sustain: 0.5, release: 0.8 }
    }).toDestination();
    chordPad.volume.value = -6;

    instrumentsRef.current = {
      kick,
      snare,
      hihat,
      openhat,
      clap,
      bass,
      synth_lead: synthLead,
      chord_pad: chordPad
    };

    return () => {
      Object.values(instrumentsRef.current).forEach(inst => inst.dispose());
    };
  }, []);

  const triggerInstrument = (trackDef, time = Tone.now()) => {
    const inst = instrumentsRef.current[trackDef.id];
    if (!inst) return;
    try {
      if (trackDef.type === 'membrane') {
        inst.triggerAttackRelease(trackDef.note || 'C1', '8n', time);
      } else if (trackDef.type === 'noise') {
        inst.triggerAttackRelease('16n', time);
      } else if (trackDef.type === 'metal') {
        inst.triggerAttackRelease(trackDef.note || '32n', time);
      } else if (trackDef.type === 'fm' || trackDef.type === 'synth') {
        inst.triggerAttackRelease(trackDef.note || 'C3', '8n', time);
      } else if (trackDef.type === 'poly' || trackDef.type === 'am') {
        inst.triggerAttackRelease(trackDef.note || 'C4', '8n', time);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const togglePlayback = async () => {
    await Tone.start();
    if (isPlaying) {
      Tone.Transport.stop();
      if (repeatIdRef.current !== null) {
        Tone.Transport.clear(repeatIdRef.current);
        repeatIdRef.current = null;
      }
      setIsPlaying(false);
      setCurrentStep(0);
      stepRef.current = 0;
    } else {
      Tone.Transport.bpm.value = bpm;
      stepRef.current = 0;
      setCurrentStep(0);

      repeatIdRef.current = Tone.Transport.scheduleRepeat(time => {
        const step = stepRef.current;
        setCurrentStep(step);

        TRACK_DEFS.forEach(track => {
          const isSelected = selectedTracksRef.current.includes(track.id);
          const isStepActive = gridRef.current[track.id]?.[step];
          const isHeld = holdTonesRef.current[track.id];

          if (isSelected && (isStepActive || isHeld)) {
            triggerInstrument(track, time);
          }
        });

        stepRef.current = (step + 1) % DEFAULT_STEPS;
      }, '16n');

      Tone.Transport.start();
      setIsPlaying(true);
    }
  };

  const togglePad = (trackId, stepIdx) => {
    setGrid(prev => {
      const row = [...prev[trackId]];
      row[stepIdx] = !row[stepIdx];
      return { ...prev, [trackId]: row };
    });
  };

  const toggleTrackSelect = trackId => {
    setSelectedTracks(prev =>
      prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]
    );
  };

  const toggleHold = trackId => {
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
    const empty = {};
    TRACK_DEFS.forEach(t => {
      empty[t.id] = Array(DEFAULT_STEPS).fill(false);
    });
    setGrid(empty);
  };

  const exportMidi = () => {
    const midi = new Midi();
    midi.header.tempos.push({ bpm: bpm, ticks: 0 });
    midi.header.timeSignatures.push({ timeSignature: [4, 4], ticks: 0 });

    const pitchMapping = {
      kick: 'C1',
      snare: 'D1',
      hihat: 'F#1',
      openhat: 'A#1',
      clap: 'D#1',
      bass: 'C2',
      synth_lead: 'C4',
      chord_pad: 'G3'
    };

    TRACK_DEFS.forEach(track => {
      if (!selectedTracks.includes(track.id)) return;
      const trackNotes = grid[track.id];
      const isHeld = holdTones[track.id];
      const midiTrack = midi.addTrack();
      midiTrack.name = track.name;

      for (let s = 0; s < DEFAULT_STEPS; s++) {
        if (trackNotes[s] || isHeld) {
          const noteName = pitchMapping[track.id] || 'C3';
          midiTrack.addNote({
            name: noteName,
            time: (s * (60 / bpm)) / 4,
            duration: (60 / bpm) / 4,
            velocity: 0.85
          });
        }
      }
    });

    const uint8 = midi.toArray();
    const blob = new Blob([uint8], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snuzy_beat_${Date.now()}.mid`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMidiImport = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const imported = new Midi(buffer);

      const newGrid = {};
      TRACK_DEFS.forEach(t => {
        newGrid[t.id] = Array(DEFAULT_STEPS).fill(false);
      });

      const secondsPer16th = 60 / bpm / 4;

      imported.tracks.forEach((t, i) => {
        const assignedTrackDef = TRACK_DEFS[i % TRACK_DEFS.length];
        t.notes.forEach(n => {
          const stepIndex = Math.round(n.time / secondsPer16th) % DEFAULT_STEPS;
          newGrid[assignedTrackDef.id][stepIndex] = true;
        });
      });

      setGrid(newGrid);
      alert('MIDI imported and mapped to sequencer steps!');
    } catch (err) {
      console.error(err);
      alert('Failed to parse MIDI file: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: '#00e5ff', fontWeight: 800 }}>
            SNUZY DRUM & SYNTH WORKSTATION
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
            style={{ padding: '6px 12px', background: '#262f40', color: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Select All Tracks
          </button>
          <button
            onClick={() => setSelectedTracks([])}
            style={{ padding: '6px 12px', background: '#262f40', color: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Deselect All
          </button>
          <button
            onClick={clearGrid}
            style={{ padding: '6px 12px', background: '#3b242e', color: '#ff8a80', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Clear Pattern
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label
            style={{
              padding: '7px 14px',
              backgroundColor: '#262f40',
              color: '#00e5ff',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              border: '1px solid #37474f'
            }}
          >
            ↑ Load MIDI
            <input type="file" accept=".mid,.midi" onChange={handleMidiImport} style={{ display: 'none' }} />
          </label>

          <button
            onClick={exportMidi}
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
        {TRACK_DEFS.map(track => {
          const isSelected = selectedTracks.includes(track.id);
          const isHeld = holdTones[track.id];

          return (
            <div
              key={track.id}
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
                const isCurrent = isPlaying && currentStep === stepIdx;
                const isGroupFour = stepIdx % 4 === 0;

                let padBackground = '#202638';
                if (active) padBackground = track.color;
                else if (isHeld) padBackground = `${track.color}44`;

                return (
                  <div
                    key={stepIdx}
                    onClick={() => togglePad(track.id, stepIdx)}
                    style={{
                      height: 36,
                      borderRadius: 4,
                      backgroundColor: padBackground,
                      border: isCurrent
                        ? '2px solid #ffffff'
                        : isGroupFour
                        ? '1px solid #455a64'
                        : '1px solid #283145',
                      cursor: 'pointer',
                      transform: isCurrent ? 'scale(1.08)' : 'scale(1)',
                      boxShadow: isCurrent ? `0 0 10px #fff` : active ? `0 0 6px ${track.color}88` : 'none',
                      transition: 'transform 0.05s, box-shadow 0.05s'
                    }}
                    title={`Step ${stepIdx + 1}`}
                  />
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
          gridTemplateColumns: '170px 72px repeat(16, 1fr)',
          gap: 6,
          marginTop: 8,
          padding: '0 16px',
          textAlign: 'center',
          fontSize: 11,
          color: '#78909c'
        }}
      >
        <div></div>
        <div></div>
        {Array.from({ length: DEFAULT_STEPS }).map((_, i) => (
          <div
            key={i}
            style={{
              color: currentStep === i && isPlaying ? '#00e5ff' : '#78909c',
              fontWeight: currentStep === i && isPlaying ? 700 : 400
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
