'use client';

import React, { useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { GM_INSTRUMENTS, getInstrumentsByCategory } from './SoundFontEngine';
import type { TrackDef } from './SequencerWorkstation';

export interface ClipNote {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
}

export interface InstrumentClip {
  id: string;
  trackId: string;
  name: string;
  start: number;
  length: number;
  notes: ClipNote[];
  // Per-block instrument override. When set, this block plays (and exports)
  // with this GM program instead of its track's instrument.
  gmId?: number;
}

interface Props {
  tracks: TrackDef[];
  stepCount: number;
  clips: InstrumentClip[];
  setClips: React.Dispatch<React.SetStateAction<InstrumentClip[]>>;
  onExtend?: (extraSteps: number) => void;
  trackGmInstruments: Record<string, number>;
  onSetClipInstrument: (clipId: string, gmId: number | null) => void;
}

const PITCH_LOW = 21;
const PITCH_HIGH = 108;
const PITCHES = Array.from({ length: PITCH_HIGH - PITCH_LOW + 1 }, (_, index) => PITCH_HIGH - index);
const CLIP_LENGTH_OPTIONS = [8, 16, 32, 64, 128, 256, 512];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchName = (pitch: number) => `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function ArrangementView({ tracks, stepCount, clips, setClips, onExtend, trackGmInstruments, onSetClipInstrument }: Props) {
  const groupedGm = useMemo(() => getInstrumentsByCategory(), []);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(clips[0]?.id ?? null);
  const [noteLength, setNoteLength] = useState(1);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const selectedClip = clips.find(clip => clip.id === selectedClipId) ?? null;
  const selectedNote = selectedClip?.notes.find(note => note.id === selectedNoteId) ?? null;
  React.useEffect(() => { setSelectedNoteId(null); }, [selectedClipId]);
  const bars = Math.ceil(stepCount / 16);
  const pxPerStep = stepCount > 512 ? 8 : stepCount > 256 ? 12 : stepCount > 128 ? 18 : 28;
  const timelineWidth = Math.max(900, stepCount * pxPerStep);

  const clipsByTrack = useMemo(() => {
    const grouped: Record<string, InstrumentClip[]> = {};
    clips.forEach(clip => (grouped[clip.trackId] ||= []).push(clip));
    return grouped;
  }, [clips]);

  const addClip = (trackId: string) => {
    const existing = clipsByTrack[trackId] || [];
    const latestEnd = existing.reduce((end, clip) => Math.max(end, clip.start + clip.length), 0);
    const start = Math.min(Math.floor(latestEnd / 16) * 16, Math.max(0, stepCount - 16));
    const clip: InstrumentClip = {
      id: uid('clip'), trackId, name: `Pattern ${existing.length + 1}`, start,
      length: Math.min(16, stepCount - start), notes: []
    };
    setClips(previous => [...previous, clip]);
    setSelectedClipId(clip.id);
  };

  const updateClip = (id: string, update: Partial<InstrumentClip>) => {
    setClips(previous => previous.map(clip => clip.id === id ? { ...clip, ...update } : clip));
  };

  const duplicateClip = (clip: InstrumentClip) => {
    const copy: InstrumentClip = {
      ...clip, id: uid('clip'), name: `${clip.name} copy`,
      start: Math.min(clip.start + clip.length, Math.max(0, stepCount - clip.length)),
      notes: clip.notes.map(note => ({ ...note, id: uid('note') }))
    };
    setClips(previous => [...previous, copy]);
    setSelectedClipId(copy.id);
  };

  const splitClip = (clip: InstrumentClip) => {
    if (clip.length < 2) return;
    const mid = Math.floor(clip.length / 2);
    const leftNotes = clip.notes.filter(note => note.start < mid).map(note => ({ ...note, id: uid('note') }));
    const rightNotes = clip.notes
      .filter(note => note.start >= mid)
      .map(note => ({ ...note, id: uid('note'), start: note.start - mid }));
    const left: InstrumentClip = {
      ...clip, id: uid('clip'), name: `${clip.name} A`, length: mid, notes: leftNotes
    };
    const right: InstrumentClip = {
      ...clip, id: uid('clip'), name: `${clip.name} B`, start: clip.start + mid,
      length: clip.length - mid, notes: rightNotes
    };
    setClips(previous => [...previous.filter(c => c.id !== clip.id), left, right]);
    setSelectedClipId(right.id);
  };

  const toggleNote = (pitch: number, start: number) => {
    if (!selectedClip) return;
    const existing = selectedClip.notes.find(note => note.pitch === pitch && note.start === start);
    if (existing) {
      if (selectedNoteId === existing.id) {
        // Second click on the selected note deletes it.
        updateClip(selectedClip.id, { notes: selectedClip.notes.filter(note => note.id !== existing.id) });
        setSelectedNoteId(null);
      } else {
        // First click selects it so velocity can be edited below.
        setSelectedNoteId(existing.id);
      }
      return;
    }
    const note = {
      id: uid('note'), pitch, start,
      duration: Math.min(noteLength, selectedClip.length - start), velocity: 100
    };
    updateClip(selectedClip.id, { notes: [...selectedClip.notes, note] });
    setSelectedNoteId(note.id);
  };

  const setSelectedNoteVelocity = (velocity: number) => {
    if (!selectedClip || !selectedNote) return;
    updateClip(selectedClip.id, {
      notes: selectedClip.notes.map(note =>
        note.id === selectedNote.id ? { ...note, velocity: Math.max(1, Math.min(127, velocity)) } : note
      )
    });
  };

  const deleteSelectedNote = () => {
    if (!selectedClip || !selectedNote) return;
    updateClip(selectedClip.id, { notes: selectedClip.notes.filter(note => note.id !== selectedNote.id) });
    setSelectedNoteId(null);
  };

  return (
    <section className="arrangement-workspace">
      <div className="arrangement-heading">
        <div><strong>Song Timeline</strong><span>{bars} bars · {stepCount} steps · {clips.length} blocks · click a clip to edit its notes</span></div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="arrangement-hint">Endless blocks — full songs welcome</span>
          {onExtend && (
            <>
              <button onClick={() => onExtend(64)} title="Add 4 bars to the timeline" style={{ padding: '5px 9px', borderRadius: 5, border: '1px solid #3b475d', background: '#252e40', color: '#00d9ef', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>+4 bars</button>
              <button onClick={() => onExtend(256)} title="Add 16 bars to the timeline" style={{ padding: '5px 9px', borderRadius: 5, border: '1px solid #3b475d', background: '#252e40', color: '#00d9ef', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>+16 bars</button>
            </>
          )}
        </div>
      </div>

      <div className="arrangement-scroll">
        <div className="arrangement-canvas" style={{ width: timelineWidth }}>
          <div className="arrangement-ruler" style={{ gridTemplateColumns: `180px repeat(${bars}, 1fr)` }}>
            <div className="lane-label">INSTRUMENT</div>
            {Array.from({ length: bars }, (_, index) => <div key={index}>BAR {index + 1}</div>)}
          </div>
          <div className="arrangement-playhead" data-arrangement-playhead />
          {tracks.map(track => (
            <div className="arrangement-lane" key={track.id} data-ctx-track={track.id}>
              <div className="lane-label" style={{ borderLeftColor: track.color }}>
                <span>{track.name}</span>
                <button onClick={() => addClip(track.id)} title={`Add ${track.name} clip`}><Plus size={14} /></button>
              </div>
              <div className="lane-content" style={{ backgroundSize: `${100 / bars}% 100%` }}>
                {(clipsByTrack[track.id] || []).map(clip => (
                  <button
                    key={clip.id}
                    data-ctx-track={track.id}
                    data-ctx-clip={clip.id}
                    className={`instrument-clip ${selectedClipId === clip.id ? 'selected' : ''}`}
                    style={{ left: `${clip.start / stepCount * 100}%`, width: `${clip.length / stepCount * 100}%`, background: track.color }}
                    onClick={() => setSelectedClipId(clip.id)}
                    title={`${clip.name}: ${clip.notes.length} notes${clip.gmId !== undefined ? ` · ${GM_INSTRUMENTS[clip.gmId]?.name ?? ''}` : ''}`}
                  >
                    <strong>{clip.name}</strong><small>{clip.notes.length} notes{clip.gmId !== undefined ? ' · ✦' : ''}</small>
                  </button>
                ))}
                <button className="lane-add" onClick={() => addClip(track.id)}><Plus size={14} /> Add block</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedClip && (
        <div className="piano-roll-panel" data-ctx-track={selectedClip.trackId}>
          <div className="piano-roll-toolbar">
            <div>
              <input value={selectedClip.name} onChange={event => updateClip(selectedClip.id, { name: event.target.value })} />
              <span>{tracks.find(track => track.id === selectedClip.trackId)?.name}</span>
            </div>
            <label>Start <input type="number" min={0} max={stepCount - selectedClip.length} value={selectedClip.start} onChange={event => updateClip(selectedClip.id, { start: Math.max(0, Math.min(stepCount - selectedClip.length, Number(event.target.value))) })} /></label>
            <label>Length <select value={selectedClip.length} onChange={event => updateClip(selectedClip.id, { length: Number(event.target.value), notes: selectedClip.notes.filter(note => note.start < Number(event.target.value)) })}>{CLIP_LENGTH_OPTIONS.filter(length => length <= stepCount).map(length => <option key={length}>{length}</option>)}</select></label>
            <label title="Instrument for this block only — the rest of the track keeps its sound">Block sound <select value={selectedClip.gmId ?? 'track'} onChange={event => onSetClipInstrument(selectedClip.id, event.target.value === 'track' ? null : Number(event.target.value))}>
              <option value="track">Track: {GM_INSTRUMENTS[trackGmInstruments[selectedClip.trackId] ?? 0]?.name}</option>
              {Object.entries(groupedGm).map(([cat, insts]) => (
                <optgroup key={cat} label={cat}>
                  {insts.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                </optgroup>
              ))}
            </select></label>
            <label>Draw <select value={noteLength} onChange={event => setNoteLength(Number(event.target.value))}>{[1, 2, 4, 8].map(length => <option key={length} value={length}>{length} step{length > 1 ? 's' : ''}</option>)}</select></label>
            {selectedNote && (
              <>
                <label title="Velocity of the selected note (click a note to select, click again to delete)">
                  Vel {selectedNote.velocity}
                  <input type="range" min={1} max={127} value={selectedNote.velocity} onChange={event => setSelectedNoteVelocity(Number(event.target.value))} style={{ width: 80, accentColor: '#00e5ff' }} />
                </label>
                <button onClick={deleteSelectedNote} title="Delete the selected note"><Trash2 size={14} /></button>
              </>
            )}
            <button onClick={() => duplicateClip(selectedClip)}><Copy size={14} /> Duplicate</button>
            <button onClick={() => splitClip(selectedClip)} title="Split this block into two endless blocks">Split</button>
            <button className="danger" onClick={() => { setClips(previous => previous.filter(clip => clip.id !== selectedClip.id)); setSelectedClipId(null); }}><Trash2 size={14} /> Delete</button>
          </div>
          <div className="piano-roll-scroll">
            <div className="piano-roll" style={{ gridTemplateColumns: `62px repeat(${selectedClip.length}, 28px)` }}>
              {PITCHES.flatMap(pitch => [
                <div key={`key-${pitch}`} className={`piano-key ${NOTE_NAMES[pitch % 12].includes('#') ? 'black' : ''}`}>{pitchName(pitch)}</div>,
                ...Array.from({ length: selectedClip.length }, (_, step) => {
                  const note = selectedClip.notes.find(item => item.pitch === pitch && item.start === step);
                  const isSelected = !!note && note.id === selectedNoteId;
                  return <button key={`${pitch}-${step}`} className={`piano-cell ${step % 4 === 0 ? 'beat' : ''} ${note ? 'has-note' : ''}`} onClick={() => toggleNote(pitch, step)} title={note ? `${pitchName(pitch)} · step ${step + 1} · vel ${note.velocity}` : `${pitchName(pitch)} · step ${step + 1}`} style={isSelected ? { boxShadow: 'inset 0 0 0 2px #fff' } : undefined}>{note && <span style={{ width: `${note.duration * 28 - 2}px`, opacity: 0.45 + 0.55 * (note.velocity / 127) }} />}</button>;
                })
              ])}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
