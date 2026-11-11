import io
import json
import urllib.request
import wave

import numpy as np

SAMPLE_RATE = 16000
FRAME_SAMPLES = 1600
FRAME_SECONDS = FRAME_SAMPLES / SAMPLE_RATE


def http_url(base: str, path: str) -> str:
    return base.rstrip("/") + path


def ws_url(base: str) -> str:
    return base.rstrip("/").replace("http://", "ws://").replace("https://", "wss://") + "/v1/stt/stream"


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.load(response)


def synthesize(base: str, text: str) -> np.ndarray:
    """Vietnamese speech from the service's own TTS, resampled to 16 kHz float32."""
    request = urllib.request.Request(
        http_url(base, "/v1/audio/speech"),
        data=json.dumps({"input": text}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()
    with wave.open(io.BytesIO(payload)) as wav:
        source_rate = wav.getframerate()
        samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").astype(np.float32) / 32768
    target_length = int(len(samples) * SAMPLE_RATE / source_rate)
    return np.interp(np.linspace(0, len(samples) - 1, target_length), np.arange(len(samples)), samples).astype(np.float32)


def to_pcm16_frames(samples: np.ndarray) -> list[bytes]:
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    return [pcm[i:i + FRAME_SAMPLES].tobytes() for i in range(0, len(pcm), FRAME_SAMPLES)]


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(seconds * SAMPLE_RATE), dtype=np.float32)


def percentile(values: list[int], q: int) -> int | None:
    return int(np.percentile(values, q)) if values else None
