import asyncio
import json
import logging
import os
import re
import time
from collections import deque
from contextlib import asynccontextmanager
from dataclasses import asdict

import numpy as np
from fastapi import FastAPI, HTTPException, Response, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from starlette.staticfiles import PathLike
from starlette.types import Scope

from .config import PROJECT_ROOT, load_settings
from .lalaflow_pages import create_lalaflow_pages_router
from .lalaflow_proxy import create_lalaflow_router
from .stt import SAMPLE_RATE, Final, Partial, StreamingTranscriber, create_recognizer, create_vad_config
from .tts import create_tts, synthesize_wav

logger = logging.getLogger("speech-service")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

LATENCY_WINDOW = 500


class CloseCode:
    NORMAL = 1000
    UNSUPPORTED_DATA = 1003
    POLICY_VIOLATION = 1008
    MESSAGE_TOO_BIG = 1009
    TRY_AGAIN_LATER = 1013


class ProtocolError(Exception):
    def __init__(self, code: str, message: str, close_code: int):
        super().__init__(message)
        self.code = code
        self.message = message
        self.close_code = close_code


class Metrics:
    def __init__(self) -> None:
        self.active_streams = 0
        self.total_streams = 0
        self.rejected_streams = 0
        self.finals = 0
        self.final_latency_ms: deque[int] = deque(maxlen=LATENCY_WINDOW)
        self.first_partial_ms: deque[int] = deque(maxlen=LATENCY_WINDOW)

    def record_final(self, final: Final) -> None:
        self.finals += 1
        self.final_latency_ms.append(final.latency_ms)
        if final.first_partial_ms is not None:
            self.first_partial_ms.append(final.first_partial_ms)

    def snapshot(self) -> dict:
        return {
            "active_streams": self.active_streams,
            "total_streams": self.total_streams,
            "rejected_streams": self.rejected_streams,
            "finals": self.finals,
            "final_latency_ms": _percentiles(self.final_latency_ms),
            "first_partial_ms": _percentiles(self.first_partial_ms),
        }


def _percentiles(values: deque[int]) -> dict:
    if not values:
        return {"count": 0}
    array = np.asarray(values)
    return {"count": len(array), "p50": int(np.percentile(array, 50)), "p95": int(np.percentile(array, 95))}


settings = load_settings()
metrics = Metrics()
models: dict = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    started = time.perf_counter()
    models["recognizer"] = create_recognizer(settings)
    models["vad_config"] = create_vad_config(settings)
    models["tts"] = create_tts(settings)
    models["tts_lock"] = asyncio.Lock()
    logger.info("models loaded in %.1fs (asr=%s, tts=%s)", time.perf_counter() - started,
                settings.asr_model_dir.name, settings.tts_model_dir.name)
    yield
    models.clear()


app = FastAPI(title="speech-service", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "asr_model": settings.asr_model_dir.name, "tts_model": settings.tts_model_dir.name}


@app.get("/metrics")
def get_metrics() -> dict:
    return metrics.snapshot()


@app.websocket("/v1/stt/stream")
async def stt_stream(websocket: WebSocket) -> None:
    # Accept before refusing: a close code can only be sent on an open WebSocket.
    await websocket.accept()
    if metrics.active_streams >= settings.max_streams:
        metrics.rejected_streams += 1
        await _send_error_and_close(websocket, ProtocolError(
            "server_busy", f"max {settings.max_streams} concurrent streams", CloseCode.TRY_AGAIN_LATER))
        return

    metrics.active_streams += 1
    metrics.total_streams += 1
    try:
        await _run_stream(websocket)
    except WebSocketDisconnect:
        logger.info("client disconnected mid-stream")
    except ProtocolError as error:
        logger.info("protocol error %s: %s", error.code, error.message)
        await _send_error_and_close(websocket, error)
    finally:
        metrics.active_streams -= 1


async def _run_stream(websocket: WebSocket) -> None:
    await _expect_start(websocket)
    transcriber = StreamingTranscriber(models["recognizer"], models["vad_config"], settings.partial_interval_seconds)
    await websocket.send_json({"type": "ready"})

    max_samples = settings.max_stream_seconds * SAMPLE_RATE
    while True:
        message = await _receive(websocket)
        if message.get("text") is not None:
            if _parse_control(message["text"]).get("type") != "stop":
                raise ProtocolError("unexpected_message", "only binary audio or {\"type\":\"stop\"} allowed after start",
                                    CloseCode.POLICY_VIOLATION)
            await _send_events(websocket, await asyncio.to_thread(transcriber.flush))
            await websocket.send_json({"type": "done"})
            await websocket.close(CloseCode.NORMAL)
            return

        samples = _decode_pcm16(message.get("bytes") or b"")
        events = await asyncio.to_thread(transcriber.accept, samples)
        await _send_events(websocket, events)
        if transcriber.total_samples > max_samples:
            await _send_events(websocket, await asyncio.to_thread(transcriber.flush))
            raise ProtocolError("stream_too_long", f"stream exceeded {settings.max_stream_seconds}s",
                                CloseCode.POLICY_VIOLATION)


async def _expect_start(websocket: WebSocket) -> None:
    message = await _receive(websocket)
    if message.get("text") is None:
        raise ProtocolError("expected_start", "first message must be JSON {\"type\":\"start\"}", CloseCode.POLICY_VIOLATION)
    control = _parse_control(message["text"])
    if control.get("type") != "start":
        raise ProtocolError("expected_start", f"first message type was {control.get('type')!r}, expected 'start'",
                            CloseCode.POLICY_VIOLATION)
    if control.get("sample_rate") != SAMPLE_RATE:
        raise ProtocolError("unsupported_sample_rate",
                            f"sample_rate {control.get('sample_rate')!r} not supported, send {SAMPLE_RATE}",
                            CloseCode.UNSUPPORTED_DATA)


async def _receive(websocket: WebSocket) -> dict:
    try:
        message = await asyncio.wait_for(websocket.receive(), timeout=settings.idle_timeout_seconds)
    except asyncio.TimeoutError:
        raise ProtocolError("idle_timeout", f"no data for {settings.idle_timeout_seconds}s", CloseCode.POLICY_VIOLATION)
    if message["type"] == "websocket.disconnect":
        raise WebSocketDisconnect(message.get("code", CloseCode.NORMAL))
    return message


def _parse_control(text: str) -> dict:
    try:
        control = json.loads(text)
    except json.JSONDecodeError:
        raise ProtocolError("invalid_json", f"control message is not JSON: {text[:80]!r}", CloseCode.POLICY_VIOLATION)
    if not isinstance(control, dict):
        raise ProtocolError("invalid_json", "control message must be a JSON object", CloseCode.POLICY_VIOLATION)
    return control


def _decode_pcm16(frame: bytes) -> np.ndarray:
    if len(frame) > settings.max_frame_bytes:
        raise ProtocolError("frame_too_large", f"frame {len(frame)} bytes > {settings.max_frame_bytes}",
                            CloseCode.MESSAGE_TOO_BIG)
    if len(frame) % 2:
        raise ProtocolError("invalid_frame", f"PCM16 frame must have even length, got {len(frame)}",
                            CloseCode.UNSUPPORTED_DATA)
    return np.frombuffer(frame, dtype="<i2").astype(np.float32) / 32768


async def _send_events(websocket: WebSocket, events: list[Partial | Final]) -> None:
    for event in events:
        if isinstance(event, Final):
            metrics.record_final(event)
            await websocket.send_json({"type": "final", **asdict(event)})
            continue
        await websocket.send_json({"type": "partial", "text": event.text})


async def _send_error_and_close(websocket: WebSocket, error: ProtocolError) -> None:
    try:
        await websocket.send_json({"type": "error", "code": error.code, "message": error.message})
        await websocket.close(error.close_code, reason=error.code)
    except (WebSocketDisconnect, RuntimeError):
        # The client already went away; there is nobody left to tell.
        logger.info("could not deliver error %s: client gone", error.code)


class SpeechRequest(BaseModel):
    input: str
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    response_format: str = "wav"


@app.post("/v1/audio/speech")
async def speech(request: SpeechRequest) -> Response:
    text = request.input.strip()
    if not text:
        raise HTTPException(400, "input must not be empty")
    if len(text) > settings.max_tts_chars:
        raise HTTPException(413, f"input has {len(text)} chars, max {settings.max_tts_chars}")
    if request.response_format != "wav":
        raise HTTPException(400, f"response_format {request.response_format!r} not supported, use 'wav'")

    async with models["tts_lock"]:
        wav = await asyncio.to_thread(synthesize_wav, models["tts"], text, request.speed)
    return Response(content=wav, media_type="audio/wav")


class FeedbackRequest(BaseModel):
    segment_id: int
    transcript: str = Field(max_length=2000)
    is_correct: bool
    corrected_text: str | None = Field(default=None, max_length=2000)


@app.post("/v1/feedback", status_code=204)
def feedback(request: FeedbackRequest) -> Response:
    settings.feedback_log.parent.mkdir(parents=True, exist_ok=True)
    record = {"ts": time.time(), "asr_model": settings.asr_model_dir.name, **request.model_dump()}
    with settings.feedback_log.open("a", encoding="utf-8") as log:
        log.write(json.dumps(record, ensure_ascii=False) + "\n")
    return Response(status_code=204)


# Vite build output: the content hash is in the file name, so a file at a given URL never changes.
HASHED_BUILD_ASSET = re.compile(r"[\\/]lalaflow[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{8}\.(js|css)$")
ONE_YEAR_SECONDS = 365 * 24 * 60 * 60
GZIP_MIN_BYTES = 1024
GZIP_LEVEL = 6


class RevalidatingStaticFiles(StaticFiles):
    """Without Cache-Control, browsers guess a freshness lifetime and keep showing an old page on
    navigation until a manual reload. `no-cache` keeps the cached copy but revalidates it by ETag
    on every visit, so an unchanged file costs a 304 and a changed one is picked up immediately.
    Hashed build assets are the exception: their URL changes with their content, so they cache for a year."""

    def file_response(
        self, full_path: PathLike, stat_result: os.stat_result, scope: Scope, status_code: int = 200
    ) -> Response:
        response = super().file_response(full_path, stat_result, scope, status_code)
        if HASHED_BUILD_ASSET.search(str(full_path)):
            response.headers["Cache-Control"] = f"public, max-age={ONE_YEAR_SECONDS}, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response


# Images and audio are already compressed and are skipped by the middleware's default exclusions.
app.add_middleware(GZipMiddleware, minimum_size=GZIP_MIN_BYTES, compresslevel=GZIP_LEVEL)


# Before the static mount: a mount on "/" matches every path, so routes registered after it never run.
app.include_router(create_lalaflow_router(settings.lalaflow_api_upstream))
app.include_router(create_lalaflow_pages_router(settings.lalaflow_api_upstream, PROJECT_ROOT / "web", settings.public_site_url))
app.mount("/", RevalidatingStaticFiles(directory=PROJECT_ROOT / "web", html=True), name="web")
