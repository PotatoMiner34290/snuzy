'use client';

import * as Tone from 'tone';
import type { LoadingState } from './SoundFontEngine';

// Premium pitched sample banks (virtual GM programs past 127): a concert
// grand and a lo-fi bass keyboard, both with per-note recordings.
export const SALA_GM_ID = 128;
export const SALA_NAME = 'Salamander Grand Piano';
export const CASIO_GM_ID = 129;
export const CASIO_NAME = 'Casio Bass Keys';

interface BankConfig {
  gmId: number;
  name: string;
  base: string;
  notes: string[];
}

const fileFor = (base: string, note: string) => `${base}/${note.replace('#', 's')}.mp3`;

const CASIO_NOTES = [
  'G#1', 'A1', 'A#1', 'B1',
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2',
];

const SALA_NOTES = [
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'D#1', 'D#2', 'D#3', 'D#4', 'D#5', 'D#6', 'D#7',
  'F#1', 'F#2', 'F#3', 'F#4', 'F#5', 'F#6', 'F#7',
];

export const PREMIUM_BANKS: Record<number, BankConfig> = {
  [SALA_GM_ID]: {
    gmId: SALA_GM_ID,
    name: SALA_NAME,
    base: 'https://tonejs.github.io/audio/salamander',
    notes: SALA_NOTES,
  },
  [CASIO_GM_ID]: {
    gmId: CASIO_GM_ID,
    name: CASIO_NAME,
    base: 'https://tonejs.github.io/audio/casio',
    notes: CASIO_NOTES,
  },
};

export const premiumGmName = (gmId: number): string | null =>
  PREMIUM_BANKS[gmId]?.name ?? null;

// MIDI programs are 7-bit: map virtual programs back to a stock program so
// exported files stay valid everywhere.
export const exportGmForMidi = (gmId: number): number => {
  if (gmId === SALA_GM_ID) return 0;
  if (gmId === CASIO_GM_ID) return 33;
  return Math.min(127, gmId);
};

/**
 * One decoded copy per bank, shared by every per-track sampler.
 * Never dispose() minted samplers — disconnect them instead.
 */
export class NoteBank {
  private keeper: Tone.Sampler | null = null;
  private buffers: Tone.ToneAudioBuffers | null = null;
  private promise: Promise<void> | null = null;
  private state: LoadingState = 'idle';
  private disposed = false;

  public onStateChange?: (state: LoadingState) => void;

  constructor(private config: BankConfig) {}

  private setState(state: LoadingState) {
    this.state = state;
    this.onStateChange?.(state);
  }

  getState(): LoadingState {
    return this.state;
  }

  isLoaded(): boolean {
    return this.state === 'loaded' && !!this.buffers;
  }

  load(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.isLoaded()) return Promise.resolve();
    if (this.promise) return this.promise;
    const job = new Promise<void>((resolve, reject) => {
      this.setState('loading');
      try {
        const urls: Record<string, string> = {};
        this.config.notes.forEach(n => { urls[n] = fileFor(this.config.base, n); });
        const keeper = new Tone.Sampler({
          urls,
          onload: () => {
            if (this.disposed) {
              keeper.dispose();
              return;
            }
            const decoded = (keeper as unknown as { _buffers?: Tone.ToneAudioBuffers })._buffers;
            if (!decoded) {
              this.setState('error');
              reject(new Error(`${this.config.name} samples failed to decode`));
              return;
            }
            this.keeper = keeper;
            this.buffers = decoded;
            this.setState('loaded');
            resolve();
          },
          onerror: (err: Error) => {
            this.setState('error');
            reject(err);
          },
        });
      } catch (err) {
        this.setState('error');
        reject(err);
      }
    });
    this.promise = job;
    job.catch(() => {}).finally(() => {
      if (this.promise === job) this.promise = null;
    });
    return job;
  }

  async createTrackSampler(destination: Tone.ToneAudioNode): Promise<Tone.Sampler | null> {
    if (this.disposed) return null;
    try {
      await this.load();
    } catch {
      return null;
    }
    if (this.disposed || !this.buffers) return null;
    try {
      const sampler = new Tone.Sampler({ urls: {} });
      (sampler as unknown as { _buffers: Tone.ToneAudioBuffers })._buffers = this.buffers;
      sampler.connect(destination);
      return sampler;
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.keeper) {
      try { this.keeper.dispose(); } catch {}
      this.keeper = null;
    }
    this.buffers = null;
    this.promise = null;
    this.onStateChange = undefined;
  }
}
