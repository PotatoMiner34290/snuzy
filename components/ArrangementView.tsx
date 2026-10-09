'use client';

import React, { useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { GM_INSTRUMENTS, getInstrumentsByCategory } from './SoundFontEngine';
import { SALA_GM_ID, SALA_NAME, CASIO_GM_ID, CASIO_NAME, premiumGmName } from './Salamander';
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

// Damper-pedal region: held from `down` until `up` (song steps).
// up: -1 = endless — once the playhead reaches `down` the pedal never lifts.
export interface SustainRegion {
  down: number;
  up: number;
}

interface Props {
  tracks: TrackDef[];
  stepCount: number;
  clips: InstrumentClip[];
  setClips: React.Dispatch<React.SetStateAction<InstrumentClip[]>>;
  sustain: Record<string, SustainRegion[]>;
  setSustain: React.Dispatch<React.SetStateAction<Record<string, SustainRegion[]>>>;
  onExtend?: (extraSteps: number) => void;
  trackGmInstruments: Record<string, number>;
  onSetClipInstrument: (clipId: string, gmId: number | null) => void;
  onSeekStep?: (step: number) => void;
}

const PITCH_LOW = 21;
const PITCH_HIGH = 108;
const PITCHES = Array.from({ length: PITCH_HIGH - PITCH_LOW + 1 }, (_, index) => PITCH_HIGH - index);
const CLIP_LENGTH_OPTIONS = [8, 16, 32, 64, 128, 256, 512];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchName = (pitch: number) => `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function ArrangementView({ tracks, stepCount, clips, setClips, sustain, setSustain, onExtend, trackGmInstruments, onSetClipInstrument, onSeekStep }: Props) {
  const groupedGm = useMemo(() => ({
    'Premium Keys': [
      { id: SALA_GM_ID, name: SALA_NAME, cdnName: '', category: 'Premium Keys' },
      { id: CASIO_GM_ID, name: CASIO_NAME, cdnName: '', category: 'Premium Keys' },
    ],
    ...getInstrumentsByCategory(),
  }), []);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(clips[0]?.id ?? null);
  const [noteLength, setNoteLength] = useState(1);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  // Typed block length: committed on blur/Enter so half-typed numbers never
  // truncate notes (e.g. clearing the field must not wipe the pattern).
  const [lengthDraft, setLengthDraft] = useState(() => String(clips[0]?.length ?? ''));
  // Marquee multi-select: marked blocks move/delete/duplicate/merge together.
  const [markedIds, setMarkedIds] = useState<string[]>([]);
  // Live damper-pedal region being painted (dashed ghost in the lane strip).
  const [sustainGhost, setSustainGhost] = useState<{ trackId: string; down: number; up: number } | null>(null);
  const markedRef = React.useRef<string[]>([]);
  const clipsRef = React.useRef(clips);
  React.useEffect(() => { markedRef.current = markedIds; }, [markedIds]);
  React.useEffect(() => { clipsRef.current = clips; }, [clips]);
  const pickSingle = (id: string | null) => {
    setSelectedClipId(id);
    setMarkedIds(id ? [id] : []);
  };
  const selectedClip = clips.find(clip => clip.id === selectedClipId) ?? null;
  const selectedNote = selectedClip?.notes.find(note => note.id === selectedNoteId) ?? null;
  React.useEffect(() => { setSelectedNoteId(null); }, [selectedClipId]);
  React.useEffect(() => { setLengthDraft(String(selectedClip?.length ?? '')); }, [selectedClipId, selectedClip?.length]);
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
    pickSingle(clip.id);
  };

  const updateClip = (id: string, update: Partial<InstrumentClip>) => {
    setClips(previous => previous.map(clip => clip.id === id ? { ...clip, ...update } : clip));
  };

  // Loop-fill (the Audacity/DW copy-drag behaviour): growing a block tiles
  // its content — every note repeats each `period` steps until the new end.
  // Shrinking trims notes past the new end. period/baseNotes are frozen at
  // the start of a drag so shrink→grow inside one gesture never compounds.
  const resizeNotes = (baseNotes: ClipNote[], period: number, newLen: number): ClipNote[] => {
    if (newLen <= period) return baseNotes.filter(note => note.start < newLen);
    const tiled: ClipNote[] = [];
    baseNotes.forEach(note => {
      for (let k = 0; ; k++) {
        const start = note.start + k * period;
        if (start >= newLen) break;
        tiled.push(k === 0 ? note : { ...note, id: `${note.id}~${start}` });
      }
    });
    return tiled;
  };

  const applyClipLength = (clip: InstrumentClip, rawLen: number) => {
    const len = Math.max(1, Math.min(stepCount - clip.start, Math.round(rawLen)));
    if (len === clip.length) return;
    updateClip(clip.id, { length: len, notes: resizeNotes(clip.notes, clip.length, len) });
  };

  const commitLengthDraft = () => {
    if (!selectedClip) return;
    const value = Number(lengthDraft);
    if (!lengthDraft.trim() || !Number.isFinite(value)) {
      setLengthDraft(String(selectedClip.length));
      return;
    }
    applyClipLength(selectedClip, value);
  };

  const markedOrSelected = (): InstrumentClip[] => {
    const ids = markedIds.length > 0 ? markedIds : (selectedClip ? [selectedClip.id] : []);
    return ids.map(id => clips.find(c => c.id === id)).filter((c): c is InstrumentClip => !!c);
  };

  const duplicateMarked = () => {
    const targets = markedOrSelected();
    if (targets.length === 0) return;
    const copies = targets.map(clip => ({
      ...clip, id: uid('clip'), name: `${clip.name} copy`,
      start: Math.min(clip.start + clip.length, Math.max(0, stepCount - clip.length)),
      notes: clip.notes.map(note => ({ ...note, id: uid('note') }))
    }));
    setClips(previous => [...previous, ...copies]);
    setSelectedClipId(copies[copies.length - 1].id);
    setMarkedIds(copies.map(c => c.id));
  };

  const mergeMarked = () => {
    const parts = markedOrSelected();
    if (parts.length < 2) return;
    const start = Math.min(...parts.map(c => c.start));
    const end = Math.max(...parts.map(c => c.start + c.length));
    const length = Math.max(1, Math.min(end - start, stepCount - start));
    const merged: InstrumentClip = {
      id: uid('clip'), trackId: parts[0].trackId, name: `${parts[0].name} +${parts.length - 1}`,
      start, length,
      notes: parts.flatMap(c => c.notes.map(n => ({ ...n, id: uid('note'), start: n.start + c.start - start })))
        .filter(n => n.start >= 0 && n.start < length),
    };
    const gone = new Set(parts.map(c => c.id));
    setClips(previous => [...previous.filter(c => !gone.has(c.id)), merged]);
    pickSingle(merged.id);
  };

  const deleteMarked = () => {
    const targets = markedOrSelected();
    if (targets.length === 0) return;
    const gone = new Set(targets.map(c => c.id));
    setClips(previous => previous.filter(c => !gone.has(c.id)));
    pickSingle(null);
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
    pickSingle(right.id);
  };

  const toggleNote = (pitch: number, start: number) => {
    if (!selectedClip) return;
    // Hit the whole held note, not just its first cell — otherwise a long
    // note's body looked empty and clicking it only dropped a note on top.
    const existing = selectedClip.notes.find(note => note.pitch === pitch && note.start === start)
      ?? selectedClip.notes.find(note => note.pitch === pitch && note.start <= start && start < note.start + note.duration);
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

  // Drag a note to move it (time + pitch) or drag its right handle to change
  // how long it is held. Snaps to single steps / semitones; Alt+click deletes;
  // a plain click selects it and a second plain click removes it.
  const onNotePointerDown = (e: React.PointerEvent, note: ClipNote, mode: 'move' | 'resize') => {
    if (e.button !== undefined && e.button !== 0) return;
    if (!selectedClip) return;
    e.preventDefault();
    e.stopPropagation();
    const clipId = selectedClip.id;
    const len = selectedClip.length;
    const wasSelected = selectedNoteId === note.id;
    if (e.altKey) {
      removeNote(clipId, note.id);
      return;
    }
    setSelectedNoteId(note.id);
    const sx = e.clientX;
    const sy = e.clientY;
    const orig = { pitch: note.pitch, start: note.start, duration: note.duration };
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      moved = true;
      if (mode === 'resize') {
        const duration = Math.max(1, Math.min(len - orig.start, orig.duration + Math.round(dx / 28)));
        patchNote(clipId, note.id, { duration });
        return;
      }
      const start = Math.max(0, Math.min(len - orig.duration, orig.start + Math.round(dx / 28)));
      const pitch = Math.max(PITCH_LOW, Math.min(PITCH_HIGH, orig.pitch - Math.round(dy / 24)));
      // Don't let a drag land exactly on another note (that key is taken).
      setClips(previous => previous.map(clip => {
        if (clip.id !== clipId) return clip;
        if (clip.notes.some(n => n.id !== note.id && n.pitch === pitch && n.start === start)) return clip;
        return { ...clip, notes: clip.notes.map(n => n.id === note.id ? { ...n, start, pitch } : n) };
      }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (!moved && mode === 'move' && wasSelected) {
        removeNote(clipId, note.id);
      }
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  const patchNote = (clipId: string, noteId: string, patch: Partial<ClipNote>) => {
    setClips(previous => previous.map(clip => clip.id === clipId
      ? { ...clip, notes: clip.notes.map(note => note.id === noteId ? { ...note, ...patch } : note) }
      : clip));
  };

  const removeNote = (clipId: string, noteId: string) => {
    setClips(previous => previous.map(clip => clip.id === clipId
      ? { ...clip, notes: clip.notes.filter(note => note.id !== noteId) }
      : clip));
    setSelectedNoteId(current => (current === noteId ? null : current));
  };

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [painting, setPainting] = useState<{ trackId: string; start: number; length: number } | null>(null);

  // Piano-roll column window: only the visible slice (+overscan) mounts, so
  // typing a huge block length stays smooth instead of rendering 88×N cells.
  const ROLL_COL = 28;
  const [rollWin, setRollWin] = useState({ start: 0, end: 192 });
  const rollScrollRef = React.useRef<HTMLDivElement | null>(null);
  const rollRafRef = React.useRef(0);
  React.useEffect(() => {
    setRollWin({ start: 0, end: 192 });
    rollScrollRef.current?.scrollTo({ left: 0 });
  }, [selectedClipId]);
  const onRollScroll = () => {
    if (rollRafRef.current) return;
    rollRafRef.current = requestAnimationFrame(() => {
      rollRafRef.current = 0;
      const el = rollScrollRef.current;
      const clip = clipsRef.current.find(c => c.id === selectedClipId);
      if (!el || !clip) return;
      const first = Math.max(0, Math.floor((el.scrollLeft - 62) / ROLL_COL) - 64);
      const count = Math.ceil(el.clientWidth / ROLL_COL) + 128;
      const start = Math.floor(first / 32) * 32;
      const end = Math.min(clip.length, Math.max(start + 32, Math.ceil((first + count) / 32) * 32));
      setRollWin(prev => (prev.start === start && prev.end === end ? prev : { start, end }));
    });
  };

  // O(1) pitch:step lookup — a per-cell find() over tiled notes was O(cells×notes).
  const noteAt = React.useMemo(() => {
    const map = new Map<string, ClipNote>();
    selectedClip?.notes.forEach(note => map.set(`${note.pitch}:${note.start}`, note));
    return map;
  }, [selectedClip]);

  // Del / Backspace removes every marked block (never while typing in a field).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const ids = markedRef.current.length > 0 ? markedRef.current : (selectedClipId ? [selectedClipId] : []);
      if (ids.length === 0) return;
      e.preventDefault();
      const gone = new Set(ids);
      setClips(previous => previous.filter(clip => !gone.has(clip.id)));
      setSelectedClipId(null);
      setMarkedIds([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedClipId, setClips]);

  const stepFromClientX = (laneEl: HTMLElement, clientX: number) => {
    const rect = laneEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    return Math.round(ratio * stepCount);
  };

  // Deliberate creation only: click-drag across empty lane space paints a
  // new block (snapped to bars), double-click drops a quick 1-bar block.
  // A plain single click just deselects — no more accidental block spam.
  const onLanePointerDown = (trackId: string, e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.instrument-clip, .lane-add, .sustain-region')) return;
    // No preventDefault here: it would eat the clicks double-click-to-add needs.
    const laneEl = e.currentTarget as HTMLElement;
    // Bottom 10px of the lane (or Alt+drag anywhere over empty space) paints
    // a damper-pedal region instead of a block — see startSustainCreate.
    if (e.altKey || e.clientY >= laneEl.getBoundingClientRect().bottom - 10) {
      startSustainCreate(trackId, laneEl, e.clientX);
      return;
    }
    const anchor = Math.min(Math.floor(stepFromClientX(laneEl, e.clientX) / 16) * 16, Math.max(0, stepCount - 16));
    const sx = e.clientX;
    const sy = e.clientY;
    let ghost: { trackId: string; start: number; length: number } | null = null;
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      const atStep = Math.min(Math.floor(stepFromClientX(laneEl, ev.clientX) / 16) * 16, Math.max(0, stepCount - 16));
      const start = Math.min(anchor, atStep);
      const length = Math.max(16, Math.abs(atStep - anchor) + 16);
      ghost = { trackId, start, length: Math.min(length, stepCount - start) };
      setPainting(ghost);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setPainting(null);
      const g = ghost;
      if (!g) {
        pickSingle(null);
        return;
      }
      // Marquee over existing blocks MARKS them instead of creating —
      // only a truly empty span grows a new block.
      const hit = (clipsByTrack[g.trackId] || []).filter(
        c => c.start < g.start + g.length && g.start < c.start + c.length
      );
      if (hit.length > 0) {
        setMarkedIds(hit.map(c => c.id));
        setSelectedClipId(hit[0].id);
        return;
      }
      const existing = clipsByTrack[g.trackId] || [];
      const clip: InstrumentClip = {
        id: uid('clip'), trackId: g.trackId, name: `Pattern ${existing.length + 1}`,
        start: g.start, length: g.length, notes: []
      };
      setClips(previous => [...previous, clip]);
      pickSingle(clip.id);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onLaneDoubleClick = (trackId: string, e: React.MouseEvent) => {
    if (e.altKey) return;
    if ((e.target as HTMLElement).closest('.instrument-clip, .lane-add, .sustain-region')) return;
    const laneEl = e.currentTarget as HTMLElement;
    const atStep = stepFromClientX(laneEl, e.clientX);
    const start = Math.min(Math.floor(atStep / 16) * 16, Math.max(0, stepCount - 16));
    const existing = clipsByTrack[trackId] || [];
    const clip: InstrumentClip = {
      id: uid('clip'), trackId, name: `Pattern ${existing.length + 1}`,
      start, length: Math.min(16, stepCount - start), notes: []
    };
    setClips(previous => [...previous, clip]);
    pickSingle(clip.id);
  };

  // Drag a block along the timeline — or onto another lane to move it to
  // that instrument. Snaps to beats (4 steps).
  const onClipPointerDown = (e: React.PointerEvent, clip: InstrumentClip) => {
    if (e.button !== undefined && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.clip-resize')) return;
    e.preventDefault();
    e.stopPropagation();
    const laneEl = (e.currentTarget as HTMLElement).closest('.lane-content') as HTMLElement | null;
    if (!laneEl) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const id = clip.id;
    const origTrackId = clip.trackId;
    setDraggingId(id);
    // Group move: every marked block travels with the dragged one.
    const group: Record<string, { start: number; len: number; track: string }> = {};
    (markedRef.current.includes(id) ? markedRef.current : [id]).forEach((gid: string) => {
      const o = gid === id ? clip : clipsRef.current.find((x: { id: string }) => x.id === gid);
      if (o) group[gid] = { start: o.start, len: o.length, track: o.trackId };
    });
    const move = (ev: PointerEvent) => {
      const rect = laneEl.getBoundingClientRect();
      const dSteps = Math.round(((ev.clientX - sx) / Math.max(1, rect.width)) * stepCount / 4) * 4;
      let newTrack = origTrackId;
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('[data-ctx-track]');
      const tid = under?.getAttribute('data-ctx-track');
      if (tid) newTrack = tid;
      setClips(previous => previous.map(c => {
        const base = group[c.id];
        if (!base) return c;
        const ns = Math.max(0, Math.min(stepCount - base.len, base.start + dSteps));
        const nt = c.id === id ? newTrack : base.track;
        return ns === c.start && nt === c.trackId ? c : { ...c, start: ns, trackId: nt };
      }));
    };
    // preventDefault above eats the click, so a tap without dragging
    // selects here manually (shift-tap toggles the mark). Cancel never selects.
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) {
        if (ev.shiftKey) {
          setMarkedIds(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]));
          setSelectedClipId(id);
        } else {
          pickSingle(id);
        }
      }
      setDraggingId(null);
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setDraggingId(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  // Drag the right edge of a block to resize it — grows/shrinks in beat
  // steps while loop-filling the content (see resizeNotes). A plain click
  // on the handle just selects; no history entry is pushed without a move.
  const onClipResizePointerDown = (e: React.PointerEvent, clip: InstrumentClip) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const laneEl = (e.currentTarget as HTMLElement).closest('.lane-content') as HTMLElement | null;
    if (!laneEl) return;
    pickSingle(clip.id);
    setResizingId(clip.id);
    const sx = e.clientX;
    const baseLen = clip.length;
    const baseNotes = clip.notes;
    let lastLen = baseLen;
    const move = (ev: PointerEvent) => {
      const rect = laneEl.getBoundingClientRect();
      const dSteps = Math.round(((ev.clientX - sx) / Math.max(1, rect.width)) * stepCount / 4) * 4;
      const len = Math.max(1, Math.min(stepCount - clip.start, baseLen + dSteps));
      if (len === lastLen) return;
      lastLen = len;
      setClips(previous => previous.map(c => {
        if (c.id !== clip.id) return c;
        const notes = resizeNotes(baseNotes, baseLen, len);
        return c.length === len && c.notes === notes ? c : { ...c, length: len, notes };
      }));
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      setResizingId(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  // ── Damper-pedal regions (bottom strip of each lane) ─────────────────────
  // Pedal edits snap to single steps — imported CC64 spans are 1-step
  // precise, so beat-snapping would yank them around on every drag.
  const snapStep = (v: number) => Math.max(0, Math.min(stepCount, Math.round(v)));

  // Only genuinely overlapping spans union (stacked bars would be
  // un-selectable). Spans that merely touch stay separate — imported MIDI is
  // full of back-to-back [0,2) [2,4) … regions, and merging those made the
  // whole track collapse into one bar the moment an edit ran.
  const normalizeSustain = (regions: SustainRegion[]): SustainRegion[] => {
    const items = regions
      .map(r => ({
        start: Math.max(0, Math.min(stepCount, r.down)),
        end: r.up < 0 ? Infinity : Math.max(0, Math.min(stepCount, r.up)),
      }))
      .filter(r => r.end > r.start)
      .sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [];
    items.forEach(item => {
      const last = merged[merged.length - 1];
      if (last && item.start < last.end) last.end = Math.max(last.end, item.end);
      else merged.push({ ...item });
    });
    return merged.map(m => ({ down: m.start, up: m.end === Infinity ? -1 : m.end }));
  };

  // Drag across the lane's bottom strip (or Alt+drag empty space) paints a
  // pedal region. Snaps to steps; a tap with no drag just deselects.
  const startSustainCreate = (trackId: string, laneEl: HTMLElement, clientX: number) => {
    const anchor = snapStep(stepFromClientX(laneEl, clientX));
    let cur = anchor;
    const move = (ev: PointerEvent) => {
      cur = snapStep(stepFromClientX(laneEl, ev.clientX));
      setSustainGhost({ trackId, down: Math.min(anchor, cur), up: Math.max(anchor, cur) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setSustainGhost(null);
      if (cur === anchor) {
        pickSingle(null);
        return;
      }
      const down = Math.min(anchor, cur);
      const end = Math.max(anchor, cur);
      setSustain(prev => ({ ...prev, [trackId]: normalizeSustain([...(prev[trackId] ?? []), { down, up: end }]) }));
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setSustainGhost(null);
    };
    setSustainGhost({ trackId, down: anchor, up: anchor });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  // Move a region along the lane, resize it via its edge handles, or delete
  // it with Alt+click. Drags snap to single steps; only genuinely overlapping
  // regions merge on release (normalizeSustain), and edges clamp to a minimum
  // length of 1 step so a nibble can't silently erase an imported span.
  const onSustainRegionPointerDown = (e: React.PointerEvent, trackId: string, index: number, edge?: 'start' | 'end') => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    const laneEl = (e.currentTarget as HTMLElement).closest('.lane-content') as HTMLElement | null;
    if (!laneEl) return;
    if (e.altKey) {
      setSustain(prev => {
        const regs = prev[trackId] ?? [];
        if (!regs[index]) return prev;
        const next = { ...prev };
        next[trackId] = regs.filter((_, i) => i !== index);
        return next;
      });
      return;
    }
    const base = (sustain[trackId] ?? [])[index];
    if (!base) return;
    const sx = e.clientX;
    const endless = base.up < 0;
    const len = endless ? 0 : base.up - base.down;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - sx) < 3) return;
      moved = true;
      const at = snapStep(stepFromClientX(laneEl, ev.clientX));
      setSustain(prev => {
        const regs = prev[trackId] ?? [];
        const r = regs[index];
        if (!r) return prev;
        let nd = r.down;
        let nu = r.up;
        if (!edge) {
          const d = Math.round(((ev.clientX - sx) / Math.max(1, laneEl.getBoundingClientRect().width)) * stepCount);
          nd = Math.max(0, Math.min(endless ? stepCount - 1 : stepCount - len, base.down + d));
          nu = endless ? -1 : nd + len;
        } else if (edge === 'start') {
          nd = Math.max(0, Math.min(endless ? stepCount - 1 : base.up - 1, at));
        } else {
          nu = Math.max(r.down + 1, Math.min(stepCount, at));
        }
        if (nd === r.down && nu === r.up) return prev;
        const next = regs.slice();
        next[index] = { down: nd, up: nu };
        return { ...prev, [trackId]: next };
      });
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (moved) setSustain(prev => ({ ...prev, [trackId]: normalizeSustain(prev[trackId] ?? []) }));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  // Double-click a region: endless on/off. On = up: -1 (holds through the
  // loop wrap and later timeline growth); off = lifts at today's end.
  const toggleSustainEndless = (trackId: string, index: number) => {
    setSustain(prev => {
      const regs = prev[trackId] ?? [];
      const r = regs[index];
      if (!r) return prev;
      const next = regs.slice();
      next[index] = { ...r, up: r.up < 0 ? stepCount : -1 };
      return { ...prev, [trackId]: next };
    });
  };

  return (
    <section className="arrangement-workspace">
      <div className="arrangement-heading">
        <div><strong>Song Timeline</strong><span>{bars} bars · {stepCount} steps · {clips.length} blocks · drag empty lane to paint · drag block edge to resize (grows = repeats content) · drag over blocks to mark them · drag the lane's bottom strip for damper-pedal sustain{markedIds.length > 1 ? ` · ${markedIds.length} marked` : ''}</span></div>
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
            {Array.from({ length: bars }, (_, index) => (
              <div
                key={index}
                onClick={() => onSeekStep?.(index * 16)}
                title={onSeekStep ? `Play from bar ${index + 1}` : undefined}
                style={onSeekStep ? { cursor: 'pointer' } : undefined}
              >
                BAR {index + 1}
              </div>
            ))}
          </div>
          <div className="arrangement-playhead" data-arrangement-playhead />
          {tracks.map(track => (
            <div className="arrangement-lane" key={track.id} data-ctx-track={track.id}>
              <div className="lane-label" style={{ borderLeftColor: track.color }}>
                <span>{track.name}</span>
                <button onClick={() => addClip(track.id)} title={`Add ${track.name} clip`}><Plus size={14} /></button>
              </div>
              <div
                className="lane-content"
                style={{ backgroundSize: `${100 / bars}% 100%` }}
                onPointerDown={e => onLanePointerDown(track.id, e)}
                onDoubleClick={e => onLaneDoubleClick(track.id, e)}
                title="Drag across empty space to paint a block · double-click for a quick 1-bar block · drag blocks to move them · drag the bottom strip (or Alt-drag) for damper-pedal sustain"
              >
                {(clipsByTrack[track.id] || []).map(clip => (
                  <button
                    key={clip.id}
                    data-ctx-track={track.id}
                    data-ctx-clip={clip.id}
                    className={`instrument-clip ${selectedClipId === clip.id ? 'selected' : ''}`}
                    style={{
                      left: `${clip.start / stepCount * 100}%`, width: `${clip.length / stepCount * 100}%`, background: track.color,
                      touchAction: 'none',
                      cursor: draggingId === clip.id ? 'grabbing' : resizingId === clip.id ? 'ew-resize' : 'grab',
                      ...(draggingId === clip.id ? { pointerEvents: 'none' as const, opacity: 0.75 } : {}),
                      ...(markedIds.includes(clip.id) && selectedClipId !== clip.id ? { outline: '2px dashed #fff', outlineOffset: 1 } : {})
                    }}
                    onClick={() => pickSingle(clip.id)}
                    onPointerDown={e => onClipPointerDown(e, clip)}
                    title={`${clip.name}: ${clip.length} steps · ${clip.notes.length} notes${clip.gmId !== undefined ? ` · ${premiumGmName(clip.gmId) ?? GM_INSTRUMENTS[clip.gmId]?.name ?? ''}` : ''} · drag to move · drag right edge to resize · Del removes`}
                  >
                    <strong>{clip.name}</strong>
                    <small>{resizingId === clip.id ? `${clip.length} steps` : `${clip.notes.length} notes${clip.gmId !== undefined ? ' · ✦' : ''}`}</small>
                    <span
                      className="clip-resize"
                      title="Drag to resize — growing repeats the block's content"
                      onPointerDown={e => onClipResizePointerDown(e, clip)}
                    />
                  </button>
                ))}
                <button className="lane-add" onClick={() => addClip(track.id)}><Plus size={14} /> Add block</button>
                {painting && painting.trackId === track.id && (
                  <div
                    style={{
                      position: 'absolute', top: 7, bottom: 7,
                      left: `${painting.start / stepCount * 100}%`, width: `${painting.length / stepCount * 100}%`,
                      border: '1px dashed #00e5ff', borderRadius: 5, background: '#00e5ff22',
                      pointerEvents: 'none', minWidth: 20
                    }}
                  />
                )}
                {/* Damper-pedal strip: 10px at the lane's bottom edge. The
                    container is click-through (lane gestures receive the
                    empty area); region bars run their own pointer events
                    above the clips. */}
                <div className="lane-sustain">
                  {(sustain[track.id] ?? []).map((region, index) => {
                    const endless = region.up < 0;
                    const end = endless ? stepCount : Math.min(region.up, stepCount);
                    return (
                      <div
                        key={index}
                        className={`sustain-region${endless ? ' endless' : ''}`}
                        style={{
                          left: `${region.down / stepCount * 100}%`,
                          width: `${Math.max(0, end - region.down) / stepCount * 100}%`,
                          touchAction: 'none',
                        }}
                        title={`Damper pedal — held notes keep ringing${endless ? ' (endless)' : ''} · drag to move · drag edges to resize · double-click: endless on/off · Alt+click deletes`}
                        onPointerDown={e => onSustainRegionPointerDown(e, track.id, index)}
                        onDoubleClick={e => { e.stopPropagation(); toggleSustainEndless(track.id, index); }}
                      >
                        <span className="sustain-edge sustain-edge-start" onPointerDown={e => onSustainRegionPointerDown(e, track.id, index, 'start')} />
                        <span className="sustain-edge sustain-edge-end" onPointerDown={e => onSustainRegionPointerDown(e, track.id, index, 'end')} />
                        {endless && <span className="sustain-inf">∞</span>}
                      </div>
                    );
                  })}
                  {sustainGhost?.trackId === track.id && (
                    <div
                      className="sustain-region sustain-ghost"
                      style={{
                        left: `${sustainGhost.down / stepCount * 100}%`,
                        width: `${Math.max(0, sustainGhost.up - sustainGhost.down) / stepCount * 100}%`,
                      }}
                    />
                  )}
                </div>
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
            <label title="Block length in steps — type any number, or drag the block's right edge. Growing repeats the block's content.">Length
              <input
                type="number"
                min={1}
                max={stepCount - selectedClip.start}
                list="clip-length-options"
                value={lengthDraft}
                onChange={event => setLengthDraft(event.target.value)}
                onBlur={commitLengthDraft}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    commitLengthDraft();
                    (event.target as HTMLInputElement).blur();
                  }
                }}
              />
              <datalist id="clip-length-options">
                {CLIP_LENGTH_OPTIONS.filter(length => length <= stepCount).map(length => <option key={length} value={length} />)}
              </datalist>
            </label>
            <label title="Instrument for this block only — the rest of the track keeps its sound">Block sound <select value={selectedClip.gmId ?? 'track'} onChange={event => onSetClipInstrument(selectedClip.id, event.target.value === 'track' ? null : Number(event.target.value))}>
              <option value="track">Track: {premiumGmName(trackGmInstruments[selectedClip.trackId] ?? 0) ?? GM_INSTRUMENTS[trackGmInstruments[selectedClip.trackId] ?? 0]?.name}</option>
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
            <button onClick={duplicateMarked} title={markedIds.length > 1 ? `Duplicate ${markedIds.length} marked blocks` : 'Duplicate this block'}><Copy size={14} /> Duplicate{markedIds.length > 1 ? ` (${markedIds.length})` : ''}</button>
            {markedIds.length > 1 && (
              <button onClick={mergeMarked} title={`Merge ${markedIds.length} marked blocks into one`}>Merge ({markedIds.length})</button>
            )}
            <button onClick={() => splitClip(selectedClip)} title="Split this block into two endless blocks">Split</button>
            <button className="danger" onClick={deleteMarked} title={markedIds.length > 1 ? `Delete ${markedIds.length} marked blocks (Del)` : 'Delete this block (Del)'}><Trash2 size={14} /> Delete{markedIds.length > 1 ? ` (${markedIds.length})` : ''}</button>
          </div>
          <div className="piano-roll-scroll" ref={rollScrollRef} onScroll={onRollScroll} title="Click an empty cell to draw a note · drag a note to move it · drag its right edge to hold it longer · click a selected note again (or Alt+click) to remove it">
            <div className="piano-roll" style={{ gridTemplateColumns: `62px repeat(${selectedClip.length}, 28px)` }}>
              {(() => {
                // Windowed columns: spacer columns keep the grid aligned while
                // only the visible slice (+overscan) actually mounts cells.
                const len = selectedClip.length;
                const winStart = Math.min(rollWin.start, Math.max(0, len - 1));
                const winEnd = Math.min(len, Math.max(rollWin.end, winStart + 192));
                return PITCHES.flatMap(pitch => [
                  <div key={`key-${pitch}`} className={`piano-key ${NOTE_NAMES[pitch % 12].includes('#') ? 'black' : ''}`}>{pitchName(pitch)}</div>,
                  ...(winStart > 0 ? [<div key={`padl-${pitch}`} style={{ gridColumn: `span ${winStart}` }} />] : []),
                  ...Array.from({ length: winEnd - winStart }, (_, index) => {
                    const step = winStart + index;
                    const note = noteAt.get(`${pitch}:${step}`);
                    const isSelected = !!note && note.id === selectedNoteId;
                    return <button key={`${pitch}-${step}`} className={`piano-cell ${step % 4 === 0 ? 'beat' : ''} ${note ? 'has-note' : ''}`} onClick={() => { if (!note) toggleNote(pitch, step); }} title={note ? `${pitchName(pitch)} · step ${step + 1} · vel ${note.velocity}` : `${pitchName(pitch)} · step ${step + 1}`} style={isSelected ? { boxShadow: 'inset 0 0 0 2px #fff' } : undefined}>{note && (
                      <span
                        className={`note-bar${isSelected ? ' selected' : ''}`}
                        style={{ width: `${note.duration * 28 - 2}px`, opacity: 0.45 + 0.55 * (note.velocity / 127) }}
                        title={`${pitchName(note.pitch)} · ${note.duration} step${note.duration > 1 ? 's' : ''} · vel ${note.velocity} · drag to move · drag right edge to resize · Alt+click deletes`}
                        onPointerDown={e => onNotePointerDown(e, note, 'move')}
                      >
                        <span className="note-resize" onPointerDown={e => onNotePointerDown(e, note, 'resize')} />
                      </span>
                    )}</button>;
                  }),
                  ...(winEnd < len ? [<div key={`padr-${pitch}`} style={{ gridColumn: `span ${len - winEnd}` }} />] : []),
                ]);
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
