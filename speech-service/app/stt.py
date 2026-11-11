import time
from dataclasses import dataclass

import numpy as np
import sherpa_onnx

from .config import Settings, find_model_file

SAMPLE_RATE = 16000
# Audio kept before VAD triggers, so the first syllable is not clipped from the partial.
PRE_ROLL_WINDOWS = 10


@dataclass(frozen=True)
class Partial:
    text: str


@dataclass(frozen=True)
class Final:
    segment_id: int
    text: str
    start_ms: int
    end_ms: int
    duration_ms: int
    latency_ms: int
    first_partial_ms: int | None


def create_recognizer(settings: Settings) -> sherpa_onnx.OfflineRecognizer:
    model_dir = settings.asr_model_dir
    return sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=find_model_file(model_dir, "encoder*.onnx"),
        decoder=find_model_file(model_dir, "decoder*.onnx"),
        joiner=find_model_file(model_dir, "joiner*.onnx"),
        tokens=find_model_file(model_dir, "tokens.txt"),
        num_threads=settings.asr_num_threads,
        sample_rate=SAMPLE_RATE,
    )


def create_vad_config(settings: Settings) -> sherpa_onnx.VadModelConfig:
    config = sherpa_onnx.VadModelConfig()
    config.silero_vad.model = str(settings.vad_model)
    config.silero_vad.threshold = settings.vad_threshold
    config.silero_vad.min_silence_duration = settings.vad_min_silence_seconds
    config.silero_vad.min_speech_duration = settings.vad_min_speech_seconds
    config.silero_vad.max_speech_duration = settings.vad_max_speech_seconds
    config.sample_rate = SAMPLE_RATE
    return config


class StreamingTranscriber:
    """Simulated streaming over an offline model: VAD cuts utterances, the open utterance is re-decoded for partials.

    One instance per connection. Not thread-safe; feed it from one task at a time.
    """

    def __init__(self, recognizer: sherpa_onnx.OfflineRecognizer, vad_config: sherpa_onnx.VadModelConfig,
                 partial_interval_seconds: float):
        self._recognizer = recognizer
        self._vad = sherpa_onnx.VoiceActivityDetector(vad_config, buffer_size_in_seconds=60)
        self._window = vad_config.silero_vad.window_size
        self._partial_interval_samples = int(partial_interval_seconds * SAMPLE_RATE)

        self._buffer = np.zeros(0, dtype=np.float32)
        self._offset = 0
        self._is_speaking = False
        self._samples_since_partial = 0
        self._last_partial = ""
        self._first_partial_received: int | None = None
        self._first_partial_decode_ms = 0.0
        self._next_segment_id = 0
        self.total_samples = 0

    def accept(self, samples: np.ndarray) -> list[Partial | Final]:
        self.total_samples += len(samples)
        self._buffer = np.concatenate([self._buffer, samples])
        self._feed_vad()
        events: list[Partial | Final] = []

        partial = self._maybe_partial(len(samples))
        if partial:
            events.append(partial)
        events.extend(self._drain_segments())
        return events

    def flush(self) -> list[Final]:
        self._vad.flush()
        return self._drain_segments()

    def _feed_vad(self) -> None:
        while self._offset + self._window <= len(self._buffer):
            self._vad.accept_waveform(self._buffer[self._offset:self._offset + self._window])
            self._offset += self._window
            if not self._is_speaking and self._vad.is_speech_detected():
                self._is_speaking = True
                self._samples_since_partial = 0

        if self._is_speaking:
            return
        keep = PRE_ROLL_WINDOWS * self._window
        if len(self._buffer) > keep:
            self._offset -= len(self._buffer) - keep
            self._buffer = self._buffer[-keep:]

    def _maybe_partial(self, new_samples: int) -> Partial | None:
        if not self._is_speaking:
            return None
        self._samples_since_partial += new_samples
        if self._samples_since_partial < self._partial_interval_samples:
            return None

        self._samples_since_partial = 0
        text, decode_ms = self._decode(self._buffer)
        if not text or text == self._last_partial:
            return None
        if self._first_partial_received is None:
            self._first_partial_received = self.total_samples
            self._first_partial_decode_ms = decode_ms
        self._last_partial = text
        return Partial(text=text)

    def _drain_segments(self) -> list[Final]:
        finals = []
        while not self._vad.empty():
            segment = self._vad.front
            samples = np.asarray(segment.samples, dtype=np.float32)
            segment_start = segment.start
            self._vad.pop()

            text, decode_ms = self._decode(samples)
            segment_end = segment_start + len(samples)
            finals.append(Final(
                segment_id=self._next_segment_id,
                text=text,
                start_ms=round(_samples_to_ms(segment_start)),
                end_ms=round(_samples_to_ms(segment_end)),
                duration_ms=round(_samples_to_ms(len(samples))),
                latency_ms=round(_samples_to_ms(self.total_samples - segment_end) + decode_ms),
                first_partial_ms=self._first_partial_latency_ms(segment_start),
            ))
            self._next_segment_id += 1
            self._reset_utterance()
        return finals

    def _first_partial_latency_ms(self, segment_start: int) -> int | None:
        if self._first_partial_received is None:
            return None
        return round(_samples_to_ms(self._first_partial_received - segment_start) + self._first_partial_decode_ms)

    def _reset_utterance(self) -> None:
        self._buffer = np.zeros(0, dtype=np.float32)
        self._offset = 0
        self._is_speaking = False
        self._samples_since_partial = 0
        self._last_partial = ""
        self._first_partial_received = None
        self._first_partial_decode_ms = 0.0

    def _decode(self, samples: np.ndarray) -> tuple[str, float]:
        started = time.perf_counter()
        stream = self._recognizer.create_stream()
        stream.accept_waveform(SAMPLE_RATE, samples)
        self._recognizer.decode_stream(stream)
        return stream.result.text.strip(), (time.perf_counter() - started) * 1000


def _samples_to_ms(samples: int) -> float:
    return samples * 1000 / SAMPLE_RATE
