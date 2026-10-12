# Snuzy

A browser-based MIDI workstation. Arrange blocks on a timeline, program a step sequencer, edit notes in a piano roll, and play everything back with sampled instruments — no installs, no backend.

## Features

- Arrangement timeline with draggable, resizable blocks
- Step sequencer and per-block piano roll editors
- All 128 General MIDI instruments plus sampled drum kits
- Damper pedal / sustain regions, including per-note pedal hold
- Kit Manager for revoicing whole instrument families at once
- Note sequencer view, MP3-to-MIDI converter, MIDI import/export

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Credits

- [Tone.js](https://github.com/Tonejs/Tone.js) — Web Audio framework, synths, and effects
- [@tonejs/midi](https://github.com/Tonejs/Midi) — MIDI file parsing
- [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) — General MIDI instrument samples (FluidR3 GM)
- [Tone.js audio samples](https://github.com/Tonejs/audio) — drum kits, Salamander grand piano, and Casio samples
- [Next.js](https://nextjs.org), [React](https://react.dev), [Lucide](https://lucide.dev) icons

## License

MIT — see [LICENSE](LICENSE).
