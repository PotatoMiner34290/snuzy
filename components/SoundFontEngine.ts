'use client';

import * as Tone from 'tone';

// ─── General MIDI Instrument Definition ──────────────────────────────────────

export interface GMInstrument {
  id: number;        // GM program number 0-127
  name: string;      // Display name
  cdnName: string;   // CDN filename slug (used in URL)
  category: string;  // Instrument family
}

/**
 * Complete General MIDI Level 1 instrument list (128 instruments).
 * CDN names match the FluidR3_GM SoundFont hosted at:
 * https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/
 */
export const GM_INSTRUMENTS: GMInstrument[] = [
  // ── Piano (0-7) ──
  { id: 0,   name: 'Acoustic Grand Piano',    cdnName: 'acoustic_grand_piano',    category: 'Piano' },
  { id: 1,   name: 'Bright Acoustic Piano',   cdnName: 'bright_acoustic_piano',   category: 'Piano' },
  { id: 2,   name: 'Electric Grand Piano',    cdnName: 'electric_grand_piano',    category: 'Piano' },
  { id: 3,   name: 'Honky-tonk Piano',        cdnName: 'honkytonk_piano',         category: 'Piano' },
  { id: 4,   name: 'Electric Piano 1',        cdnName: 'electric_piano_1',        category: 'Piano' },
  { id: 5,   name: 'Electric Piano 2',        cdnName: 'electric_piano_2',        category: 'Piano' },
  { id: 6,   name: 'Harpsichord',             cdnName: 'harpsichord',             category: 'Piano' },
  { id: 7,   name: 'Clavinet',                cdnName: 'clavinet',                category: 'Piano' },

  // ── Chromatic Percussion (8-15) ──
  { id: 8,   name: 'Celesta',                 cdnName: 'celesta',                 category: 'Chromatic Percussion' },
  { id: 9,   name: 'Glockenspiel',            cdnName: 'glockenspiel',            category: 'Chromatic Percussion' },
  { id: 10,  name: 'Music Box',               cdnName: 'music_box',               category: 'Chromatic Percussion' },
  { id: 11,  name: 'Vibraphone',              cdnName: 'vibraphone',              category: 'Chromatic Percussion' },
  { id: 12,  name: 'Marimba',                 cdnName: 'marimba',                 category: 'Chromatic Percussion' },
  { id: 13,  name: 'Xylophone',               cdnName: 'xylophone',               category: 'Chromatic Percussion' },
  { id: 14,  name: 'Tubular Bells',           cdnName: 'tubular_bells',           category: 'Chromatic Percussion' },
  { id: 15,  name: 'Dulcimer',                cdnName: 'dulcimer',                category: 'Chromatic Percussion' },

  // ── Organ (16-23) ──
  { id: 16,  name: 'Drawbar Organ',           cdnName: 'drawbar_organ',           category: 'Organ' },
  { id: 17,  name: 'Percussive Organ',        cdnName: 'percussive_organ',        category: 'Organ' },
  { id: 18,  name: 'Rock Organ',              cdnName: 'rock_organ',              category: 'Organ' },
  { id: 19,  name: 'Church Organ',            cdnName: 'church_organ',            category: 'Organ' },
  { id: 20,  name: 'Reed Organ',              cdnName: 'reed_organ',              category: 'Organ' },
  { id: 21,  name: 'Accordion',               cdnName: 'accordion',               category: 'Organ' },
  { id: 22,  name: 'Harmonica',               cdnName: 'harmonica',               category: 'Organ' },
  { id: 23,  name: 'Tango Accordion',         cdnName: 'tango_accordion',         category: 'Organ' },

  // ── Guitar (24-31) ──
  { id: 24,  name: 'Acoustic Guitar (nylon)', cdnName: 'acoustic_guitar_nylon',   category: 'Guitar' },
  { id: 25,  name: 'Acoustic Guitar (steel)', cdnName: 'acoustic_guitar_steel',   category: 'Guitar' },
  { id: 26,  name: 'Electric Guitar (jazz)',  cdnName: 'electric_guitar_jazz',    category: 'Guitar' },
  { id: 27,  name: 'Electric Guitar (clean)', cdnName: 'electric_guitar_clean',   category: 'Guitar' },
  { id: 28,  name: 'Electric Guitar (muted)', cdnName: 'electric_guitar_muted',   category: 'Guitar' },
  { id: 29,  name: 'Overdriven Guitar',       cdnName: 'overdriven_guitar',       category: 'Guitar' },
  { id: 30,  name: 'Distortion Guitar',       cdnName: 'distortion_guitar',       category: 'Guitar' },
  { id: 31,  name: 'Guitar Harmonics',        cdnName: 'guitar_harmonics',        category: 'Guitar' },

  // ── Bass (32-39) ──
  { id: 32,  name: 'Acoustic Bass',           cdnName: 'acoustic_bass',           category: 'Bass' },
  { id: 33,  name: 'Electric Bass (finger)',  cdnName: 'electric_bass_finger',    category: 'Bass' },
  { id: 34,  name: 'Electric Bass (pick)',    cdnName: 'electric_bass_pick',      category: 'Bass' },
  { id: 35,  name: 'Fretless Bass',           cdnName: 'fretless_bass',           category: 'Bass' },
  { id: 36,  name: 'Slap Bass 1',             cdnName: 'slap_bass_1',             category: 'Bass' },
  { id: 37,  name: 'Slap Bass 2',             cdnName: 'slap_bass_2',             category: 'Bass' },
  { id: 38,  name: 'Synth Bass 1',            cdnName: 'synth_bass_1',            category: 'Bass' },
  { id: 39,  name: 'Synth Bass 2',            cdnName: 'synth_bass_2',            category: 'Bass' },

  // ── Strings (40-47) ──
  { id: 40,  name: 'Violin',                  cdnName: 'violin',                  category: 'Strings' },
  { id: 41,  name: 'Viola',                   cdnName: 'viola',                   category: 'Strings' },
  { id: 42,  name: 'Cello',                   cdnName: 'cello',                   category: 'Strings' },
  { id: 43,  name: 'Contrabass',              cdnName: 'contrabass',              category: 'Strings' },
  { id: 44,  name: 'Tremolo Strings',         cdnName: 'tremolo_strings',         category: 'Strings' },
  { id: 45,  name: 'Pizzicato Strings',       cdnName: 'pizzicato_strings',       category: 'Strings' },
  { id: 46,  name: 'Orchestral Harp',         cdnName: 'orchestral_harp',         category: 'Strings' },
  { id: 47,  name: 'Timpani',                 cdnName: 'timpani',                 category: 'Strings' },

  // ── Ensemble (48-55) ──
  { id: 48,  name: 'String Ensemble 1',       cdnName: 'string_ensemble_1',       category: 'Ensemble' },
  { id: 49,  name: 'String Ensemble 2',       cdnName: 'string_ensemble_2',       category: 'Ensemble' },
  { id: 50,  name: 'Synth Strings 1',         cdnName: 'synth_strings_1',         category: 'Ensemble' },
  { id: 51,  name: 'Synth Strings 2',         cdnName: 'synth_strings_2',         category: 'Ensemble' },
  { id: 52,  name: 'Choir Aahs',              cdnName: 'choir_aahs',              category: 'Ensemble' },
  { id: 53,  name: 'Voice Oohs',              cdnName: 'voice_oohs',              category: 'Ensemble' },
  { id: 54,  name: 'Synth Voice',             cdnName: 'synth_choir',             category: 'Ensemble' },
  { id: 55,  name: 'Orchestra Hit',           cdnName: 'orchestra_hit',           category: 'Ensemble' },

  // ── Brass (56-63) ──
  { id: 56,  name: 'Trumpet',                 cdnName: 'trumpet',                 category: 'Brass' },
  { id: 57,  name: 'Trombone',                cdnName: 'trombone',                category: 'Brass' },
  { id: 58,  name: 'Tuba',                    cdnName: 'tuba',                    category: 'Brass' },
  { id: 59,  name: 'Muted Trumpet',           cdnName: 'muted_trumpet',           category: 'Brass' },
  { id: 60,  name: 'French Horn',             cdnName: 'french_horn',             category: 'Brass' },
  { id: 61,  name: 'Brass Section',           cdnName: 'brass_section',           category: 'Brass' },
  { id: 62,  name: 'Synth Brass 1',           cdnName: 'synthbrass_1',            category: 'Brass' },
  { id: 63,  name: 'Synth Brass 2',           cdnName: 'synthbrass_2',            category: 'Brass' },

  // ── Reed (64-71) ──
  { id: 64,  name: 'Soprano Sax',             cdnName: 'soprano_sax',             category: 'Reed' },
  { id: 65,  name: 'Alto Sax',                cdnName: 'alto_sax',                category: 'Reed' },
  { id: 66,  name: 'Tenor Sax',               cdnName: 'tenor_sax',               category: 'Reed' },
  { id: 67,  name: 'Baritone Sax',            cdnName: 'baritone_sax',            category: 'Reed' },
  { id: 68,  name: 'Oboe',                    cdnName: 'oboe',                    category: 'Reed' },
  { id: 69,  name: 'English Horn',            cdnName: 'english_horn',            category: 'Reed' },
  { id: 70,  name: 'Bassoon',                 cdnName: 'bassoon',                 category: 'Reed' },
  { id: 71,  name: 'Clarinet',                cdnName: 'clarinet',                category: 'Reed' },

  // ── Pipe (72-79) ──
  { id: 72,  name: 'Piccolo',                 cdnName: 'piccolo',                 category: 'Pipe' },
  { id: 73,  name: 'Flute',                   cdnName: 'flute',                   category: 'Pipe' },
  { id: 74,  name: 'Recorder',                cdnName: 'recorder',                category: 'Pipe' },
  { id: 75,  name: 'Pan Flute',               cdnName: 'pan_flute',               category: 'Pipe' },
  { id: 76,  name: 'Blown Bottle',            cdnName: 'blown_bottle',            category: 'Pipe' },
  { id: 77,  name: 'Shakuhachi',              cdnName: 'shakuhachi',              category: 'Pipe' },
  { id: 78,  name: 'Whistle',                 cdnName: 'whistle',                 category: 'Pipe' },
  { id: 79,  name: 'Ocarina',                 cdnName: 'ocarina',                 category: 'Pipe' },

  // ── Synth Lead (80-87) ──
  { id: 80,  name: 'Lead 1 (square)',          cdnName: 'lead_1_square',           category: 'Synth Lead' },
  { id: 81,  name: 'Lead 2 (sawtooth)',        cdnName: 'lead_2_sawtooth',         category: 'Synth Lead' },
  { id: 82,  name: 'Lead 3 (calliope)',        cdnName: 'lead_3_calliope',         category: 'Synth Lead' },
  { id: 83,  name: 'Lead 4 (chiff)',           cdnName: 'lead_4_chiff',            category: 'Synth Lead' },
  { id: 84,  name: 'Lead 5 (charang)',         cdnName: 'lead_5_charang',          category: 'Synth Lead' },
  { id: 85,  name: 'Lead 6 (voice)',           cdnName: 'lead_6_voice',            category: 'Synth Lead' },
  { id: 86,  name: 'Lead 7 (fifths)',          cdnName: 'lead_7_fifths',           category: 'Synth Lead' },
  { id: 87,  name: 'Lead 8 (bass + lead)',     cdnName: 'lead_8_bass__lead',       category: 'Synth Lead' },

  // ── Synth Pad (88-95) ──
  { id: 88,  name: 'Pad 1 (new age)',          cdnName: 'pad_1_new_age',           category: 'Synth Pad' },
  { id: 89,  name: 'Pad 2 (warm)',             cdnName: 'pad_2_warm',              category: 'Synth Pad' },
  { id: 90,  name: 'Pad 3 (polysynth)',        cdnName: 'pad_3_polysynth',         category: 'Synth Pad' },
  { id: 91,  name: 'Pad 4 (choir)',            cdnName: 'pad_4_choir',             category: 'Synth Pad' },
  { id: 92,  name: 'Pad 5 (bowed)',            cdnName: 'pad_5_bowed',             category: 'Synth Pad' },
  { id: 93,  name: 'Pad 6 (metallic)',         cdnName: 'pad_6_metallic',          category: 'Synth Pad' },
  { id: 94,  name: 'Pad 7 (halo)',             cdnName: 'pad_7_halo',              category: 'Synth Pad' },
  { id: 95,  name: 'Pad 8 (sweep)',            cdnName: 'pad_8_sweep',             category: 'Synth Pad' },

  // ── Synth Effects (96-103) ──
  { id: 96,  name: 'FX 1 (rain)',              cdnName: 'fx_1_rain',               category: 'Synth Effects' },
  { id: 97,  name: 'FX 2 (soundtrack)',        cdnName: 'fx_2_soundtrack',          category: 'Synth Effects' },
  { id: 98,  name: 'FX 3 (crystal)',           cdnName: 'fx_3_crystal',            category: 'Synth Effects' },
  { id: 99,  name: 'FX 4 (atmosphere)',        cdnName: 'fx_4_atmosphere',          category: 'Synth Effects' },
  { id: 100, name: 'FX 5 (brightness)',        cdnName: 'fx_5_brightness',          category: 'Synth Effects' },
  { id: 101, name: 'FX 6 (goblins)',           cdnName: 'fx_6_goblins',             category: 'Synth Effects' },
  { id: 102, name: 'FX 7 (echoes)',            cdnName: 'fx_7_echoes',              category: 'Synth Effects' },
  { id: 103, name: 'FX 8 (sci-fi)',            cdnName: 'fx_8_scifi',               category: 'Synth Effects' },

  // ── Ethnic (104-111) ──
  { id: 104, name: 'Sitar',                   cdnName: 'sitar',                   category: 'Ethnic' },
  { id: 105, name: 'Banjo',                   cdnName: 'banjo',                   category: 'Ethnic' },
  { id: 106, name: 'Shamisen',                cdnName: 'shamisen',                category: 'Ethnic' },
  { id: 107, name: 'Koto',                    cdnName: 'koto',                    category: 'Ethnic' },
  { id: 108, name: 'Kalimba',                 cdnName: 'kalimba',                 category: 'Ethnic' },
  { id: 109, name: 'Bagpipe',                 cdnName: 'bagpipe',                 category: 'Ethnic' },
  { id: 110, name: 'Fiddle',                  cdnName: 'fiddle',                  category: 'Ethnic' },
  { id: 111, name: 'Shanai',                  cdnName: 'shanai',                  category: 'Ethnic' },

  // ── Percussive (112-119) ──
  { id: 112, name: 'Tinkle Bell',             cdnName: 'tinkle_bell',             category: 'Percussive' },
  { id: 113, name: 'Agogo',                   cdnName: 'agogo',                   category: 'Percussive' },
  { id: 114, name: 'Steel Drums',             cdnName: 'steel_drums',             category: 'Percussive' },
  { id: 115, name: 'Woodblock',               cdnName: 'woodblock',               category: 'Percussive' },
  { id: 116, name: 'Taiko Drum',              cdnName: 'taiko_drum',              category: 'Percussive' },
  { id: 117, name: 'Melodic Tom',             cdnName: 'melodic_tom',             category: 'Percussive' },
  { id: 118, name: 'Synth Drum',              cdnName: 'synth_drum',              category: 'Percussive' },
  { id: 119, name: 'Reverse Cymbal',          cdnName: 'reverse_cymbal',          category: 'Percussive' },

  // ── Sound Effects (120-127) ──
  { id: 120, name: 'Guitar Fret Noise',       cdnName: 'guitar_fret_noise',       category: 'Sound Effects' },
  { id: 121, name: 'Breath Noise',            cdnName: 'breath_noise',            category: 'Sound Effects' },
  { id: 122, name: 'Seashore',                cdnName: 'seashore',                category: 'Sound Effects' },
  { id: 123, name: 'Bird Tweet',              cdnName: 'bird_tweet',              category: 'Sound Effects' },
  { id: 124, name: 'Telephone Ring',          cdnName: 'telephone_ring',          category: 'Sound Effects' },
  { id: 125, name: 'Helicopter',              cdnName: 'helicopter',              category: 'Sound Effects' },
  { id: 126, name: 'Applause',                cdnName: 'applause',                category: 'Sound Effects' },
  { id: 127, name: 'Gunshot',                 cdnName: 'gunshot',                 category: 'Sound Effects' },
];

// ─── Category list for UI grouping ───────────────────────────────────────────

export const GM_CATEGORIES = [
  'Piano', 'Chromatic Percussion', 'Organ', 'Guitar', 'Bass', 'Strings',
  'Ensemble', 'Brass', 'Reed', 'Pipe', 'Synth Lead', 'Synth Pad',
  'Synth Effects', 'Ethnic', 'Percussive', 'Sound Effects'
] as const;

export type GMCategory = (typeof GM_CATEGORIES)[number];

/**
 * Get instruments grouped by category for UI rendering
 */
export function getInstrumentsByCategory(): Record<GMCategory, GMInstrument[]> {
  const grouped = {} as Record<GMCategory, GMInstrument[]>;
  GM_CATEGORIES.forEach(cat => { grouped[cat] = []; });
  GM_INSTRUMENTS.forEach(inst => {
    const cat = inst.category as GMCategory;
    if (grouped[cat]) grouped[cat].push(inst);
  });
  return grouped;
}

// ─── CDN SoundFont Loader ────────────────────────────────────────────────────

const CDN_BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM';

/**
 * Parse the JS file from the CDN to extract note → data URI mappings.
 * The format is a JS assignment like: MIDI.Soundfont.instrument_name = { "A0": "data:audio/mp3;base64,...", ... };
 * We use regex to extract key-value pairs safely (no eval).
 */
function parseSoundFontJS(jsText: string): Record<string, string> {
  const samples: Record<string, string> = {};

  // Match each "NoteName": "data:audio/..." pair
  const noteRegex = /"([A-Ga-g][b#]?\d)"\s*:\s*"(data:audio\/(?:mp3|ogg|wav);base64,[A-Za-z0-9+/=]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = noteRegex.exec(jsText)) !== null) {
    const noteName = match[1];
    const dataUri = match[2];
    samples[noteName] = dataUri;
  }

  return samples;
}

// ─── SoundFont Player Class ──────────────────────────────────────────────────

export type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

export interface InstrumentStatus {
  instrumentId: number;
  state: LoadingState;
  error?: string;
}

/**
 * SoundFontPlayer manages loading and playing General MIDI instruments
 * using real audio samples from the FluidR3_GM SoundFont CDN.
 *
 * Usage:
 * ```ts
 * const player = new SoundFontPlayer(masterLimiter);
 * await player.loadInstrument(0); // Load Acoustic Grand Piano
 * player.triggerNote(0, 'C4', '8n');
 * ```
 */
export class SoundFontPlayer {
  private samplers: Map<number, Tone.Sampler> = new Map();
  private loadingStates: Map<number, LoadingState> = new Map();
  private loadingErrors: Map<number, string> = new Map();
  private loadPromises: Map<number, Promise<void>> = new Map();
  private outputNode: Tone.ToneAudioNode;
  private disposed = false;

  // Event callback for UI updates when loading state changes
  public onStateChange?: (status: InstrumentStatus) => void;

  constructor(outputNode: Tone.ToneAudioNode) {
    this.outputNode = outputNode;
  }

  /**
   * Get the current loading state for an instrument
   */
  getState(instrumentId: number): LoadingState {
    return this.loadingStates.get(instrumentId) || 'idle';
  }

  /**
   * Check if an instrument's samples are fully loaded and ready to play
   */
  isLoaded(instrumentId: number): boolean {
    return this.loadingStates.get(instrumentId) === 'loaded';
  }

  /**
   * Get all currently loaded instrument IDs
   */
  getLoadedInstruments(): number[] {
    const loaded: number[] = [];
    this.loadingStates.forEach((state, id) => {
      if (state === 'loaded') loaded.push(id);
    });
    return loaded;
  }

  /**
   * Get the error message for a failed instrument load
   */
  getError(instrumentId: number): string | undefined {
    return this.loadingErrors.get(instrumentId);
  }

  private setState(instrumentId: number, state: LoadingState, error?: string) {
    this.loadingStates.set(instrumentId, state);
    if (error) this.loadingErrors.set(instrumentId, error);
    else this.loadingErrors.delete(instrumentId);

    this.onStateChange?.({ instrumentId, state, error });
  }

  /**
   * Load an instrument from the CDN. Returns immediately if already loaded.
   * Multiple calls for the same instrument will share the same Promise.
   */
  async loadInstrument(instrumentId: number): Promise<void> {
    if (this.disposed) return;

    // Already loaded
    if (this.isLoaded(instrumentId)) return;

    // Already loading — return the existing promise
    const existing = this.loadPromises.get(instrumentId);
    if (existing) return existing;

    const instrument = GM_INSTRUMENTS[instrumentId];
    if (!instrument) {
      throw new Error(`Invalid instrument ID: ${instrumentId}`);
    }

    const loadPromise = this._doLoad(instrumentId, instrument);
    this.loadPromises.set(instrumentId, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.loadPromises.delete(instrumentId);
    }
  }

  private async _doLoad(instrumentId: number, instrument: GMInstrument): Promise<void> {
    this.setState(instrumentId, 'loading');

    try {
      const url = `${CDN_BASE}/${instrument.cdnName}-mp3.js`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch ${instrument.name}`);
      }

      const jsText = await response.text();
      const samples = parseSoundFontJS(jsText);

      const noteCount = Object.keys(samples).length;
      if (noteCount === 0) {
        throw new Error(`No samples found in SoundFont data for ${instrument.name}`);
      }

      if (this.disposed) return;

      // Create a Tone.Sampler with the parsed samples
      await new Promise<void>((resolve, reject) => {
        try {
          const sampler = new Tone.Sampler({
            urls: samples,
            onload: () => {
              if (this.disposed) {
                sampler.dispose();
                return;
              }
              this.samplers.set(instrumentId, sampler);
              this.setState(instrumentId, 'loaded');
              resolve();
            },
            onerror: (err) => {
              sampler.dispose();
              reject(err);
            }
          }).connect(this.outputNode);
        } catch (err) {
          reject(err);
        }
      });

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.setState(instrumentId, 'error', errMsg);
      console.error(`[SoundFontPlayer] Failed to load "${instrument.name}":`, errMsg);
      throw err;
    }
  }

  /**
   * Trigger a note on a loaded instrument.
   * If the instrument isn't loaded yet, this is a no-op (won't crash).
   */
  triggerNote(
    instrumentId: number,
    note: string,
    duration: string | number = '8n',
    time?: number,
    velocity: number = 0.85
  ): void {
    if (this.disposed) return;

    const sampler = this.samplers.get(instrumentId);
    if (!sampler) return;

    try {
      const triggerTime = time !== undefined ? Math.max(time, Tone.now()) : Tone.now();
      sampler.triggerAttackRelease(note, duration, triggerTime, velocity);
    } catch (err) {
      // Silently catch timing collisions during rapid playback
    }
  }

  /**
   * Trigger attack only (for sustained notes)
   */
  triggerAttack(
    instrumentId: number,
    note: string,
    time?: number,
    velocity: number = 0.85
  ): void {
    if (this.disposed) return;
    const sampler = this.samplers.get(instrumentId);
    if (!sampler) return;

    try {
      const triggerTime = time !== undefined ? Math.max(time, Tone.now()) : Tone.now();
      sampler.triggerAttack(note, triggerTime, velocity);
    } catch (err) {
      // ignore
    }
  }

  /**
   * Release a sustained note
   */
  triggerRelease(
    instrumentId: number,
    note: string,
    time?: number
  ): void {
    if (this.disposed) return;
    const sampler = this.samplers.get(instrumentId);
    if (!sampler) return;

    try {
      const triggerTime = time !== undefined ? Math.max(time, Tone.now()) : Tone.now();
      sampler.triggerRelease(note, triggerTime);
    } catch (err) {
      // ignore
    }
  }

  /**
   * Unload a specific instrument to free memory
   */
  unloadInstrument(instrumentId: number): void {
    const sampler = this.samplers.get(instrumentId);
    if (sampler) {
      try { sampler.dispose(); } catch {}
      this.samplers.delete(instrumentId);
    }
    this.loadingStates.delete(instrumentId);
    this.loadingErrors.delete(instrumentId);
    this.loadPromises.delete(instrumentId);
  }

  /**
   * Dispose all loaded instruments and clean up
   */
  dispose(): void {
    this.disposed = true;
    this.samplers.forEach(sampler => {
      try { sampler.dispose(); } catch {}
    });
    this.samplers.clear();
    this.loadingStates.clear();
    this.loadingErrors.clear();
    this.loadPromises.clear();
    this.onStateChange = undefined;
  }
}
