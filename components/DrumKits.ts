'use client';

import * as Tone from 'tone';
import type { LoadingState } from './SoundFontEngine';

// Real sampled drum kits (Tone.js official sample CDN). These replace the
// synthesized blips for drum tracks — actual kick/snare/hat recordings.
export const DRUM_KITS = [
  { id: 'acoustic', name: 'Acoustic Kit', base: 'https://tonejs.github.io/audio/drum-samples/acoustic-kit' },
  { id: 'kit8', name: '808 Electro', base: 'https://tonejs.github.io/audio/drum-samples/Kit8' },
  { id: 'cr78', name: 'Vintage CR78', base: 'https://tonejs.github.io/audio/drum-samples/CR78' },
  { id: 'linn', name: 'LINN Drum', base: 'https://tonejs.github.io/audio/drum-samples/LINN' },
  { id: 'techno', name: 'Techno Kit', base: 'https://tonejs.github.io/audio/drum-samples/Techno' },
  { id: 'kpr77', name: 'KPR77', base: 'https://tonejs.github.io/audio/drum-samples/KPR77' },
  { id: 'kit3', name: 'Kit3 Electro', base: 'https://tonejs.github.io/audio/drum-samples/Kit3' },
  { id: 'r8', name: 'R8', base: 'https://tonejs.github.io/audio/drum-samples/R8' },
  { id: 'stark', name: 'Stark', base: 'https://tonejs.github.io/audio/drum-samples/Stark' },
  { id: 'fm4op', name: '4OP FM Drums', base: 'https://tonejs.github.io/audio/drum-samples/4OP-FM' },
  { id: 'bongos', name: 'Bongos', base: 'https://tonejs.github.io/audio/drum-samples/Bongos' },
  { id: 'cheeb1', name: 'Cheebacabra 1', base: 'https://tonejs.github.io/audio/drum-samples/TheCheebacabra1' },
  { id: 'cheeb2', name: 'Cheebacabra 2', base: 'https://tonejs.github.io/audio/drum-samples/TheCheebacabra2' },
] as const;

export type DrumKitId = (typeof DRUM_KITS)[number]['id'];
export const DEFAULT_DRUM_KIT: DrumKitId = 'acoustic';

// Track type -> kit piece file. sub808 reuses the kick pitched way down
// (see trigger note); cowbell has no sample and stays synthesized.
export const DRUM_PIECE_FILE: Record<string, string> = {
  membrane: 'kick.mp3',
  sub808: 'kick.mp3',
  noise: 'snare.mp3',
  synth: 'snare.mp3',
  metal: 'hihat.mp3',
  metal_open: 'hihat.mp3',
  tom: 'tom1.mp3',
  rim: 'snare.mp3',
};

// Note the piece is triggered at: sub808 booms an octave+ down, everything
// else plays the raw recording.
export const DRUM_PIECE_NOTE: Record<string, string> = {
  sub808: 'C1',
};

export interface DrumStatus {
  key: string;
  state: LoadingState;
}

/**
 * DrumKitPlayer loads one-shot drum recordings per kit and mints cheap
 * per-track samplers that share the decoded buffers (same pattern as the
 * SoundFont engine — never dispose() the minted samplers, disconnect them).
 */
export class DrumKitPlayer {
  private keepers: Map<string, Tone.Sampler> = new Map();
  private buffers: Map<string, Tone.ToneAudioBuffers> = new Map();
  private promises: Map<string, Promise<void>> = new Map();
  private states: Map<string, LoadingState> = new Map();
  private disposed = false;

  public onStateChange?: (status: DrumStatus) => void;

  private setState(key: string, state: LoadingState) {
    this.states.set(key, state);
    this.onStateChange?.({ key, state });
  }

  getState(key: string): LoadingState {
    return this.states.get(key) || 'idle';
  }

  private kitBase(kitId: string): string | null {
    return DRUM_KITS.find(k => k.id === kitId)?.base ?? null;
  }

  async loadPiece(kitId: string, piece: string): Promise<void> {
    if (this.disposed) return;
    const key = `${kitId}:${piece}`;
    if (this.states.get(key) === 'loaded') return;
    const existing = this.promises.get(key);
    if (existing) return existing;
    const base = this.kitBase(kitId);
    if (!base) throw new Error(`Unknown drum kit: ${kitId}`);
    const job = new Promise<void>((resolve, reject) => {
      this.setState(key, 'loading');
      try {
        const keeper = new Tone.Sampler({
          urls: { C4: `${base}/${piece}` },
          onload: () => {
            if (this.disposed) {
              keeper.dispose();
              return;
            }
            const decoded = (keeper as unknown as { _buffers?: Tone.ToneAudioBuffers })._buffers;
            if (!decoded) {
              this.setState(key, 'error');
              reject(new Error(`No audio decoded for ${key}`));
              return;
            }
            this.buffers.set(key, decoded);
            this.keepers.set(key, keeper);
            this.setState(key, 'loaded');
            resolve();
          },
          onerror: (err: Error) => {
            this.setState(key, 'error');
            reject(err);
          },
        });
      } catch (err) {
        this.setState(key, 'error');
        reject(err);
      }
    });
    this.promises.set(key, job);
    try {
      await job;
    } finally {
      this.promises.delete(key);
    }
  }

  async createTrackSampler(
    kitId: string,
    piece: string,
    destination: Tone.ToneAudioNode
  ): Promise<Tone.Sampler | null> {
    if (this.disposed) return null;
    try {
      await this.loadPiece(kitId, piece);
    } catch {
      return null;
    }
    if (this.disposed) return null;
    const buffers = this.buffers.get(`${kitId}:${piece}`);
    if (!buffers) return null;
    try {
      const sampler = new Tone.Sampler({ urls: {} });
      (sampler as unknown as { _buffers: Tone.ToneAudioBuffers })._buffers = buffers;
      sampler.connect(destination);
      return sampler;
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.keepers.forEach(s => {
      try { s.dispose(); } catch {}
    });
    this.keepers.clear();
    this.buffers.clear();
    this.promises.clear();
    this.states.clear();
    this.onStateChange = undefined;
  }
}
