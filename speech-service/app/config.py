import os
from dataclasses import dataclass
from pathlib import Path

from .azure_tts import endpoint_for

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = PROJECT_ROOT / "models"
SHOP_HOTWORDS = Path(__file__).resolve().parent / "asr_hotwords.txt"


def find_model_file(model_dir: Path, pattern: str) -> str:
    matches = sorted(model_dir.glob(pattern))
    if len(matches) != 1:
        raise FileNotFoundError(f"expected exactly one {pattern} in {model_dir}, found {[m.name for m in matches]}")
    return str(matches[0])


def _env_str(name: str, default: str) -> str:
    return os.environ.get(name, default)


def _env_int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


def _env_float(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


def _env_optional_path(name: str, default: Path) -> Path | None:
    """Unset: the default; set to an empty string: None (the feature is off)."""
    value = os.environ.get(name, str(default))
    return Path(value) if value else None


@dataclass(frozen=True)
class Settings:
    asr_model_dir: Path
    vad_model: Path
    tts_model_dir: Path
    asr_num_threads: int
    asr_decoding: str
    asr_hotwords_file: Path | None
    asr_hotwords_score: float
    asr_cache_dir: Path
    tts_num_threads: int
    max_streams: int
    max_stream_seconds: int
    idle_timeout_seconds: float
    max_frame_bytes: int
    partial_interval_seconds: float
    vad_threshold: float
    vad_min_silence_seconds: float
    vad_min_speech_seconds: float
    vad_max_speech_seconds: float
    max_tts_chars: int
    feedback_log: Path
    lalaflow_api_upstream: str
    public_site_url: str
    azure_speech_key: str
    azure_tts_endpoint: str
    azure_tts_voice: str


def load_settings() -> Settings:
    return Settings(
        asr_model_dir=Path(_env_str("ASR_MODEL_DIR", str(MODELS_DIR / "sherpa-onnx-zipformer-vi-30M-int8-2026-02-09"))),
        vad_model=Path(_env_str("VAD_MODEL", str(MODELS_DIR / "silero_vad.onnx"))),
        tts_model_dir=Path(_env_str("TTS_MODEL_DIR", str(MODELS_DIR / "vits-piper-vi_VN-vais1000-medium-int8"))),
        asr_num_threads=_env_int("ASR_NUM_THREADS", 2),
        # Beam search keeps several guesses per word instead of the single likeliest; needed for hotwords.
        asr_decoding=_env_str("ASR_DECODING", "modified_beam_search"),
        # Empty ASR_HOTWORDS_FILE turns the shop words off.
        asr_hotwords_file=_env_optional_path("ASR_HOTWORDS_FILE", SHOP_HOTWORDS),
        # Measured with tests/stt_eval.py: 5 cut shop-question errors most; 7 was no better and slower.
        asr_hotwords_score=_env_float("ASR_HOTWORDS_SCORE", 5.0),
        asr_cache_dir=PROJECT_ROOT / "logs" / "asr",
        tts_num_threads=_env_int("TTS_NUM_THREADS", 2),
        max_streams=_env_int("MAX_STREAMS", 5),
        max_stream_seconds=_env_int("MAX_STREAM_SECONDS", 300),
        idle_timeout_seconds=_env_float("IDLE_TIMEOUT_SECONDS", 15),
        # 1 s of 16 kHz PCM16; the browser client sends 100 ms frames.
        max_frame_bytes=_env_int("MAX_FRAME_BYTES", 32000),
        partial_interval_seconds=_env_float("PARTIAL_INTERVAL_SECONDS", 0.4),
        vad_threshold=_env_float("VAD_THRESHOLD", 0.5),
        # Shorter than ~0.5 s cuts Vietnamese sentences at natural pauses before numbers ("khoảng... bốn tỷ").
        vad_min_silence_seconds=_env_float("VAD_MIN_SILENCE_SECONDS", 0.5),
        vad_min_speech_seconds=_env_float("VAD_MIN_SPEECH_SECONDS", 0.25),
        vad_max_speech_seconds=_env_float("VAD_MAX_SPEECH_SECONDS", 20),
        max_tts_chars=_env_int("MAX_TTS_CHARS", 500),
        feedback_log=Path(_env_str("FEEDBACK_LOG", str(PROJECT_ROOT / "logs" / "feedback.jsonl"))),
        lalaflow_api_upstream=_env_str("LALAFLOW_API_UPSTREAM", "http://127.0.0.1:4000"),
        # Origin for canonical URLs and the sitemap; empty means "the host the request came in on" (e.g. ngrok).
        public_site_url=_env_str("PUBLIC_SITE_URL", ""),
        # Empty key: every answer is read by the local Piper voice, as before.
        azure_speech_key=_env_str("AZURE_SPEECH_KEY", ""),
        azure_tts_endpoint=_env_str("AZURE_TTS_ENDPOINT", endpoint_for(_env_str("AZURE_SPEECH_REGION", "southeastasia"))),
        azure_tts_voice=_env_str("AZURE_TTS_VOICE", "vi-VN-HoaiMyNeural"),
    )
