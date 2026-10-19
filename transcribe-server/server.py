"""Snuzy local transcription server.

Runs AI transcription outside the browser (the browser cannot launch local
processes) and hands MIDI back to the studio over plain HTTP.

  python server.py [--port 8765]

Then open the MP3 booth in Snuzy → "Local AI server" → Transcribe.
Nothing leaves your machine: audio goes to 127.0.0.1 and back.

Engines live behind a tiny registry. Anything importable is advertised on
/health; anything missing is just absent (no crashes, no dead buttons):
  - "transkun" … piano transcription (pip install transkun, needs torch)
  - "mt3" ……… multitrack drums/bass/keys (pip install mt3-infer, needs torch)
  - "stub" …… plays a C-major scale; only here to test the wiring
"""

import io
import os
import struct
import sys
import tempfile
import threading
import traceback

import numpy as np

try:
    from flask import Flask, jsonify, request, Response
except ImportError:
    print("Flask is missing: pip install -r requirements-server.txt", file=sys.stderr)
    raise

app = Flask(__name__)
PORT = int(os.environ.get("SNUZY_TRANSCRIBE_PORT", "8765"))
_busy = threading.Lock()


@app.after_request
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


# ── audio helpers (stdlib only — no ffmpeg needed; the studio sends WAV) ──

def read_wav_mono(path):
    """Decode PCM WAV (8/16/24/32-bit int or 32-bit float) → (mono float32, sr)."""
    with open(path, "rb") as fh:
        data = fh.read()
    if data[0:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise ValueError("Not a WAV file — the studio always sends WAV.")
    channels, sr, bits, fmt = 1, 44100, 16, 1
    pos, frames = 12, b""
    while pos + 8 <= len(data):
        tag, size = data[pos:pos + 4], int.from_bytes(data[pos + 4:pos + 8], "little")
        body = data[pos + 8:pos + 8 + size]
        if tag == b"fmt ":
            fmt, channels = int.from_bytes(body[0:2], "little"), int.from_bytes(body[2:4], "little")
            sr, bits = int.from_bytes(body[4:8], "little"), int.from_bytes(body[14:16], "little")
        elif tag == b"data":
            frames = body
        pos += 8 + size + (size & 1)
    if fmt not in (1, 3):
        raise ValueError(f"Unsupported WAV format {fmt} (need PCM int or float32).")
    n = len(frames) // (channels * (bits // 8))
    out = np.zeros(n, dtype=np.float32)
    for ch in range(channels):
        for i in range(n):
            off = (i * channels + ch) * (bits // 8)
            if bits == 8:
                v = (frames[off] - 128) / 128.0
            elif bits == 16:
                v = int.from_bytes(frames[off:off + 2], "little", signed=True) / 32768.0
            elif bits == 24:
                v = int.from_bytes(frames[off:off + 3], "little", signed=True) / 8388608.0
            elif fmt == 3:
                (v,) = struct.unpack("<f", frames[off:off + 4])
            else:
                v = int.from_bytes(frames[off:off + 4], "little", signed=True) / 2147483648.0
            out[i] += v / channels
    return out, sr


def resample_mono(x, sr, target=16000):
    if sr == target:
        return x.astype(np.float32)
    n = int(round(len(x) * target / sr))
    old = np.linspace(0, 1, len(x))
    new = np.linspace(0, 1, n)
    return np.interp(new, old, x).astype(np.float32)


def _engine_error(name, err):
    return None, f"{name} failed: {err}"


# ── engines: each takes (mono float32, sr) → MIDI file bytes ──

def engine_stub(mono, sr):
    """C-major scale, two octaves up and down. Dependency-free wiring test."""
    notes = [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60]
    ppq, step = 480, 120
    events = bytearray()
    tick = 0
    for n in notes:
        events += bytes([0x00, 0x90, n, 0x64])
        events += bytes([0x83, 0x60, 0x80, n, 0x00])
        tick += step
    track = bytes([0x00, 0xC0, 0x00]) + bytes(events) + bytes([0x00, 0xFF, 0x2F, 0x00])
    body = (
        b"MThd" + (6).to_bytes(4, "big") + bytes([0x00, 0x01, 0x00, 0x01]) + ppq.to_bytes(2, "big")
        + b"MTrk" + len(track).to_bytes(4, "big") + track
    )
    return bytes(body), ""


def engine_transkun(mono, sr):
    """Piano transcription via the `transkun` package (pip install transkun).

    Mirrors the adapter pattern from LioK251/mp3converter: override the
    package's mp3-only audio reader with our decoded WAV, then drive its
    own CLI entry point.
    """
    try:
        from transkun import transcribe
    except Exception as e:
        return _engine_error("transkun", f"pip install transkun ({e})")
    rate = int(sr)
    stereo = np.stack([mono, mono], axis=1).astype(np.float32)

    def read_audio(path, normalize=True):
        return rate, stereo

    transcribe.readAudio = read_audio
    out_fd, out_path = tempfile.mkstemp(suffix=".mid")
    os.close(out_fd)
    argv = ["transkun", "input-ignored.wav", out_path]
    try:
        import torch
        if torch.cuda.is_available():
            argv += ["--device", "cuda"]
    except Exception:
        pass
    old_argv = sys.argv
    sys.argv = argv
    try:
        transcribe.main()
    except SystemExit as e:
        if e.code not in (None, 0):
            raise RuntimeError(f"transkun exited with code {e.code}")
    finally:
        sys.argv = old_argv
    with open(out_path, "rb") as fh:
        data = fh.read()
    os.unlink(out_path)
    if not data:
        raise RuntimeError("transkun produced an empty MIDI file")
    return data, ""


def engine_mt3(mono, sr, model="default"):
    """Multitrack drums/bass/keys via `mt3-infer` (pip install mt3-infer).

    Experimental: follows the package's documented transcribe(audio, sr)
    call shape; anything unexpected surfaces as a readable error.
    `model` picks the checkpoint: "default" (most accurate, slow on CPU)
    or "mr_mt3" (built for speed).
    """
    try:
        from mt3_infer import transcribe
    except Exception as e:
        return _engine_error("mt3", f"pip install mt3-infer ({e})")
    audio16 = resample_mono(mono, int(sr), 16000)
    try:
        midi_obj = transcribe(audio16, sr=16000, model=model)
    except TypeError:
        midi_obj = transcribe(audio16)
    out_fd, out_path = tempfile.mkstemp(suffix=".mid")
    os.close(out_fd)
    try:
        if hasattr(midi_obj, "save"):
            midi_obj.save(out_path)
        elif hasattr(midi_obj, "write"):
            midi_obj.write(out_path)
        else:
            raise RuntimeError(f"unexpected mt3-infer result type {type(midi_obj)}")
        with open(out_path, "rb") as fh:
            data = fh.read()
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass
    if not data:
        raise RuntimeError("mt3 produced an empty MIDI file")
    return data, ""


ENGINES = {"stub": engine_stub, "transkun": engine_transkun, "mt3": engine_mt3}
MT3_MODELS = {"default", "mr_mt3", "mt3_pytorch", "yourmt3"}


def available_engines():
    """Engines whose third-party packages actually import (stub always)."""
    names = ["stub"]
    try:
        import transkun  # noqa: F401
        names.append("transkun")
    except Exception:
        pass
    try:
        import mt3_infer  # noqa: F401
        names.append("mt3")
    except Exception:
        pass
    return names


def device():
    try:
        import torch
        if torch.cuda.is_available():
            return f"cuda ({torch.cuda.get_device_name(0)})"
        return "cpu (torch present)"
    except Exception:
        return "cpu"


# ── routes ──

@app.get("/")
def index():
    return (
        "<h3>Snuzy transcription server</h3>"
        "<p>POST a WAV file to <code>/transcribe</code> (field <code>file</code>, "
        "form field <code>engine</code>) and get a <code>.mid</code> back. "
        "See <code>/health</code> for engines.</p>"
    )


@app.get("/health")
def health():
    return jsonify(ok=True, engines=available_engines(), device=device())


@app.post("/transcribe")
def transcribe_route():
    engine = (request.form.get("engine") or "auto").lower()
    if engine == "auto":
        for name in ("mt3", "transkun"):
            if name in available_engines():
                engine = name
                break
        else:
            engine = "stub"
    # "mt3-fast" is a client-side alias for the speed-built checkpoint.
    model = (request.form.get("model") or "").strip() or None
    if engine == "mt3-fast":
        engine, model = "mt3", model or "mr_mt3"
    if engine not in ENGINES:
        return jsonify(ok=False, error=f"unknown engine '{engine}'"), 400
    if engine == "mt3" and model is not None and model not in MT3_MODELS:
        return jsonify(ok=False, error=f"unknown mt3 model '{model}'"), 400
    if "file" not in request.files:
        return jsonify(ok=False, error="missing multipart field 'file'"), 400
    if not _busy.acquire(blocking=False):
        return jsonify(ok=False, error="server is already transcribing — wait a moment"), 503
    try:
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".wav")
        try:
            request.files["file"].save(tmp_path)
            mono, sr = read_wav_mono(tmp_path)
        finally:
            os.close(tmp_fd)
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        if mono.size == 0:
            return jsonify(ok=False, error="empty audio"), 400
        try:
            if engine == "mt3":
                data, _ = ENGINES[engine](mono, sr, model or "default")
            else:
                data, _ = ENGINES[engine](mono, sr)
        except Exception:
            traceback.print_exc()
            return jsonify(ok=False, error=f"engine '{engine}' failed — see server log"), 500
        if isinstance(data, tuple):
            data = data[0]
        if not data:
            return jsonify(ok=False, error=f"engine '{engine}' returned nothing usable"), 500
        name = (request.form.get("name") or "transcription").replace('"', "") + ".mid"
        return Response(
            data,
            mimetype="audio/midi",
            headers={"Content-Disposition": f'attachment; filename="{name}"'},
        )
    finally:
        _busy.release()


if __name__ == "__main__":
    # Give CPU inference some threads to work with (autoregressive decoding
    # is mostly single-threaded Python, but the matmuls parallelize).
    try:
        import torch

        torch.set_num_threads(max(4, (os.cpu_count() or 4) // 2))
        torch.set_num_interop_threads(min(4, max(1, (os.cpu_count() or 4) // 4)))
    except Exception:
        pass
    print(f"Snuzy transcription server on http://127.0.0.1:{PORT}  (engines: {', '.join(available_engines())})")
    app.run(host="127.0.0.1", port=PORT, threaded=True)
