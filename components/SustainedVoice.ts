import * as Tone from 'tone';

type Buffers = Tone.ToneAudioBuffers;

interface VoiceOptions {
  loopStartFrac?: number;
  loopEndFrac?: number;
  crossfade?: number;
}

const rmsAt = (buf: AudioBuffer, timeSec: number): number => {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  let i0 = Math.floor(Math.max(0, timeSec) * sr);
  if (i0 >= data.length) i0 = Math.max(0, data.length - 1);
  const n = Math.min(2048, data.length - i0);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i0 + i];
    sum += v * v;
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  return rms > 1e-5 ? rms : 1e-5;
};

/**
 * Plays a SoundFont sample so it can ring indefinitely while the damper pedal
 * is held. The sample is a finite one-shot (GM ≈1.6s, premium ≈5s), so once it
 * runs out a held note used to just stop. This voice plays the natural attack,
 * then crossfade-loops the tail region forever. A per-loop gain ramp
 * compensates the sample's decay so the sustain stays level instead of
 * swelling/pumping.
 */
export class SustainedVoice {
  private output: Tone.Gain;
  private passes = new Set<Tone.ToneBufferSource>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStart = 0;
  private passIndex = 0;
  private stopped = false;

  private readonly buffer: Tone.ToneAudioBuffer;
  private readonly raw: AudioBuffer;
  private readonly rate: number;
  private readonly ls: number;
  private readonly le: number;
  private readonly xf: number;
  private readonly velocity: number;
  private readonly attackReal: number;
  private readonly loopReal: number;
  private readonly kTarget: number;

  constructor(
    buffers: Buffers,
    note: string,
    destination: Tone.ToneAudioNode,
    time: number,
    velocity: number,
    opts: VoiceOptions = {}
  ) {
    const midiFloat = Tone.Frequency(note).toMidi();
    const midi = Math.round(midiFloat);
    let interval = 0;
    let closest = -1;
    for (; interval < 96; interval++) {
      if (buffers.has(midi - interval)) { closest = midi - interval; break; }
      if (buffers.has(midi + interval)) { closest = midi + interval; break; }
    }
    if (closest < 0) throw new Error(`No sample for ${note}`);

    this.buffer = buffers.get(closest);
    this.raw = this.buffer.get() as AudioBuffer;
    this.rate = Math.pow(2, (midiFloat - closest) / 12);

    const dur = this.buffer.duration;
    const startFrac = opts.loopStartFrac ?? 0.35;
    const endFrac = opts.loopEndFrac ?? 0.75;
    this.ls = Math.min(Math.max(0.02, dur * startFrac), dur - 0.08);
    this.le = Math.min(Math.max(this.ls + 0.06, dur * endFrac), dur - 0.01);
    const loopBufLen = this.le - this.ls;
    this.xf = Math.max(0.03, Math.min(opts.crossfade ?? 0.15, loopBufLen / (2 * this.rate)));
    this.velocity = Math.max(0.001, velocity);
    this.attackReal = this.le / this.rate;
    this.loopReal = loopBufLen / this.rate;
    this.kTarget = this.velocity * rmsAt(this.raw, this.le);

    this.output = new Tone.Gain(1);
    this.output.connect(destination);

    this.nextStart = time;
    this.schedule();
    this.timer = setInterval(this.schedule, 250);
  }

  private schedule = () => {
    if (this.stopped) return;
    const horizon = Tone.now() + 4;
    while (this.nextStart < horizon) {
      if (this.passIndex === 0) {
        this.scheduleAttack(this.nextStart);
        this.nextStart += this.attackReal - this.xf;
      } else {
        this.scheduleLoop(this.nextStart);
        this.nextStart += this.loopReal - this.xf;
      }
      this.passIndex++;
    }
  };

  private track(src: Tone.ToneBufferSource, g: Tone.Gain) {
    this.passes.add(src);
    src.onended = () => {
      this.passes.delete(src);
      try { src.dispose(); } catch {}
      try { g.dispose(); } catch {}
    };
  }

  private scheduleAttack(start: number) {
    const src = new Tone.ToneBufferSource({
      url: this.buffer,
      context: Tone.getContext(),
      loop: false,
      fadeIn: 0,
      fadeOut: 0,
      playbackRate: this.rate,
    });
    const g = new Tone.Gain(0);
    src.connect(g);
    g.connect(this.output);
    this.track(src, g);
    const p = g.gain;
    const fadeStart = start + this.attackReal - this.xf;
    p.setValueAtTime(this.velocity, start);
    p.setValueAtTime(this.velocity, fadeStart);
    p.linearRampToValueAtTime(0.0001, start + this.attackReal);
    src.start(start, 0);
    src.stop(start + this.attackReal + 0.03);
  }

  private scheduleLoop(start: number) {
    const src = new Tone.ToneBufferSource({
      url: this.buffer,
      context: Tone.getContext(),
      loop: false,
      fadeIn: 0,
      fadeOut: 0,
      playbackRate: this.rate,
    });
    const g = new Tone.Gain(0);
    src.connect(g);
    g.connect(this.output);
    this.track(src, g);
    const p = g.gain;
    const steps = 8;
    const maxGain = this.velocity * 6;
    const fade = Math.min(this.xf, this.loopReal * 0.45);
    p.setValueAtTime(0.0001, start);
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const t = start + f * this.loopReal;
      const bufOff = this.ls + f * (this.le - this.ls);
      const a = rmsAt(this.raw, bufOff);
      let gain = this.kTarget / a;
      const tau = f * this.loopReal;
      if (tau < fade) gain *= tau / fade;
      else if (tau > this.loopReal - fade) gain *= Math.max(0.0001, (this.loopReal - tau) / fade);
      p.linearRampToValueAtTime(Math.min(maxGain, Math.max(0.0001, gain)), t);
    }
    src.start(start, this.ls);
    src.stop(start + this.loopReal + 0.03);
  }

  release(time?: number) {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const t = time ?? Tone.now();
    const fade = 0.18;
    try {
      const p = this.output.gain;
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(0.0001, t + fade);
    } catch {}
    const stopAt = t + fade + 0.05;
    this.passes.forEach(src => { try { src.stop(stopAt); } catch {} });
    setTimeout(() => this.dispose(), (fade + 0.4) * 1000);
  }

  dispose() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.passes.forEach(src => {
      try { src.stop(); } catch {}
      try { src.dispose(); } catch {}
    });
    this.passes.clear();
    try { this.output.disconnect(); } catch {}
    try { this.output.dispose(); } catch {}
  }
}

export function createSustainedVoice(
  buffers: Buffers,
  note: string,
  destination: Tone.ToneAudioNode,
  time: number,
  velocity: number,
  opts?: VoiceOptions
): SustainedVoice | null {
  try {
    return new SustainedVoice(buffers, note, destination, time, velocity, opts);
  } catch {
    return null;
  }
}
