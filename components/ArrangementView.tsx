'use client';

import React, { useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
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
}

interface Props {
  tracks: TrackDef[];
  stepCount: number;
  clips: InstrumentClip[];
  setClips: React.Dispatch<React.SetStateAction<InstrumentClip[]>>;
}

const PITCHES = Array.from({ length: 60 }, (_, index) => 95 - index);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchName = (pitch: number) => `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function ArrangementView({ tracks, stepCount, clips, setClips }: Props) {
  const [selectedClipId, setSelectedClipId] = useState<string | null>(clips[0]?.id ?? null);
  const [noteLength, setNoteLength] = useState(1);
  const selectedClip = clips.find(clip => clip.id === selectedClipId) ?? null;
  const bars = Math.ceil(stepCount / 16);
  const timelineWidth = Math.max(900, stepCount * 28);

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

  const toggleNote = (pitch: number, start: number) => {
    if (!selectedClip) return;
    const existing = selectedClip.notes.find(note => note.pitch === pitch && note.start === start);
    const notes = existing
      ? selectedClip.notes.filter(note => note.id !== existing.id)
      : [...selectedClip.notes, {
          id: uid('note'), pitch, start,
          duration: Math.min(noteLength, selectedClip.length - start), velocity: 100
        }];
    updateClip(selectedClip.id, { notes });
  };

  return (
    <section className="arrangement-workspace">
      <div className="arrangement-heading">
        <div><strong>Song Timeline</strong><span>{bars} bars · click a clip to edit its notes</span></div>
        <span className="arrangement-hint">Each block is an independent instrument pattern</span>
      </div>

      <div className="arrangement-scroll">
        <div className="arrangement-canvas" style={{ width: timelineWidth }}>
          <div className="arrangement-ruler" style={{ gridTemplateColumns: `180px repeat(${bars}, 1fr)` }}>
            <div className="lane-label">INSTRUMENT</div>
            {Array.from({ length: bars }, (_, index) => <div key={index}>BAR {index + 1}</div>)}
          </div>
          <div className="arrangement-playhead" data-arrangement-playhead />
          {tracks.map(track => (
            <div className="arrangement-lane" key={track.id}>
              <div className="lane-label" style={{ borderLeftColor: track.color }}>
                <span>{track.name}</span>
                <button onClick={() => addClip(track.id)} title={`Add ${track.name} clip`}><Plus size={14} /></button>
              </div>
              <div className="lane-content" style={{ backgroundSize: `${100 / bars}% 100%` }}>
                {(clipsByTrack[track.id] || []).map(clip => (
                  <button
                    key={clip.id}
                    className={`instrument-clip ${selectedClipId === clip.id ? 'selected' : ''}`}
                    style={{ left: `${clip.start / stepCount * 100}%`, width: `${clip.length / stepCount * 100}%`, background: track.color }}
                    onClick={() => setSelectedClipId(clip.id)}
                    title={`${clip.name}: ${clip.notes.length} notes`}
                  >
                    <strong>{clip.name}</strong><small>{clip.notes.length} notes</small>
                  </button>
                ))}
                <button className="lane-add" onClick={() => addClip(track.id)}><Plus size={14} /> Add block</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedClip && (
        <div className="piano-roll-panel">
          <div className="piano-roll-toolbar">
            <div>
              <input value={selectedClip.name} onChange={event => updateClip(selectedClip.id, { name: event.target.value })} />
              <span>{tracks.find(track => track.id === selectedClip.trackId)?.name}</span>
            </div>
            <label>Start <input type="number" min={0} max={stepCount - selectedClip.length} value={selectedClip.start} onChange={event => updateClip(selectedClip.id, { start: Math.max(0, Math.min(stepCount - selectedClip.length, Number(event.target.value))) })} /></label>
            <label>Length <select value={selectedClip.length} onChange={event => updateClip(selectedClip.id, { length: Number(event.target.value), notes: selectedClip.notes.filter(note => note.start < Number(event.target.value)) })}>{[8, 16, 32, 64].filter(length => length <= stepCount).map(length => <option key={length}>{length}</option>)}</select></label>
            <label>Draw <select value={noteLength} onChange={event => setNoteLength(Number(event.target.value))}>{[1, 2, 4, 8].map(length => <option key={length} value={length}>{length} step{length > 1 ? 's' : ''}</option>)}</select></label>
            <button onClick={() => duplicateClip(selectedClip)}><Copy size={14} /> Duplicate</button>
            <button className="danger" onClick={() => { setClips(previous => previous.filter(clip => clip.id !== selectedClip.id)); setSelectedClipId(null); }}><Trash2 size={14} /> Delete</button>
          </div>
          <div className="piano-roll-scroll">
            <div className="piano-roll" style={{ gridTemplateColumns: `62px repeat(${selectedClip.length}, 28px)` }}>
              {PITCHES.flatMap(pitch => [
                <div key={`key-${pitch}`} className={`piano-key ${NOTE_NAMES[pitch % 12].includes('#') ? 'black' : ''}`}>{pitchName(pitch)}</div>,
                ...Array.from({ length: selectedClip.length }, (_, step) => {
                  const note = selectedClip.notes.find(item => item.pitch === pitch && item.start === step);
                  return <button key={`${pitch}-${step}`} className={`piano-cell ${step % 4 === 0 ? 'beat' : ''} ${note ? 'has-note' : ''}`} onClick={() => toggleNote(pitch, step)} title={`${pitchName(pitch)} · step ${step + 1}`}>{note && <span style={{ width: `${note.duration * 28 - 2}px` }} />}</button>;
                })
              ])}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
