import io
import wave

import numpy as np
import sherpa_onnx

from .config import Settings, find_model_file


def create_tts(settings: Settings) -> sherpa_onnx.OfflineTts:
    model_dir = settings.tts_model_dir
    vits = sherpa_onnx.OfflineTtsVitsModelConfig(
        model=find_model_file(model_dir, "*.onnx"),
        tokens=find_model_file(model_dir, "tokens.txt"),
        data_dir=str(model_dir / "espeak-ng-data"),
    )
    model = sherpa_onnx.OfflineTtsModelConfig(vits=vits, num_threads=settings.tts_num_threads)
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=model))


def synthesize_wav(tts: sherpa_onnx.OfflineTts, text: str, speed: float) -> bytes:
    audio = tts.generate(text, sid=0, speed=speed)
    if len(audio.samples) == 0:
        raise ValueError(f"TTS produced no audio for text of length {len(text)}")
    return _to_wav(np.asarray(audio.samples, dtype=np.float32), audio.sample_rate)


def _to_wav(samples: np.ndarray, sample_rate: int) -> bytes:
    pcm16 = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm16.tobytes())
    return buffer.getvalue()
