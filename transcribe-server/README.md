# Snuzy transcription server

Heavy AI transcription runs **outside the browser** here — a web page cannot
launch local programs, so this tiny server does it and hands MIDI back to the
studio over `http://127.0.0.1:8765`. Your audio never leaves your machine.

## Run it

```bash
cd transcribe-server
pip install -r requirements-server.txt
python server.py
```

Windows: `run-server.bat`. macOS/Linux: `./run-server.sh`.
Then open Snuzy → MP3 booth → **Local AI server** → Transcribe.

A GPU is used automatically when torch sees one; otherwise the CPU does the
work (slower — minutes for a full song, fine for short clips).

## Engines

| Engine | What | Install |
|---|---|---|
| `transkun` | piano transcription | `pip install transkun` (+ torch) |
| `mt3` | multitrack drums/bass/keys (experimental) | `pip install mt3-infer` (+ torch) |
| `stub` | a C-major scale, no dependencies | always available |

No engine installed? The booth's **Test connection** button runs `stub` to
prove the wiring end to end. `GET /health` lists whatever is actually
importable, so the studio never offers what isn't there.

Set `SNUZY_TRANSCRIBE_PORT=1234 python server.py` to move ports (match it in
the booth's server URL field).

## If the MT3 engine fights installation

These are version traps hit while setting it up — in order:

1. `transkun` needs a C compiler (it builds `ncls`) — skip it if you only
   want `mt3`, or install `build-essential`/`gcc` first.
2. PyPI `torchaudio` is CUDA-linked and fails without CUDA libraries —
   reinstall it from the CPU index so it matches a CPU torch:
   `pip install --force-reinstall --no-deps --index-url https://download.pytorch.org/whl/cpu torchaudio`
3. `mt3-infer` needs `transformers<5` (`T5PreTrainedModel` and
   `transformers.utils.download_url` are gone in v5):
   `pip install "transformers>=4.44,<5"`
4. The checkpoint downloads through git-lfs — the plain `git` install is
   not enough, install the `git-lfs` binary and run `git lfs install` once.
   First run downloads ~180 MB and CPU inference takes a few minutes for a
   full song; the booth just waits.
