"""C5-C8: admission limit, disconnect cleanup, protocol errors and TTS contract against a running service.

Assumes the service runs with the default MAX_STREAMS=5 and MAX_FRAME_BYTES=32000.
"""

import argparse
import asyncio
import io
import json
import sys
import time
import urllib.error
import urllib.request
import wave

from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

from common import fetch_json, http_url, silence, to_pcm16_frames, ws_url

MAX_STREAMS = 5
START = json.dumps({"type": "start", "sample_rate": 16000})
SILENT_FRAME = to_pcm16_frames(silence(0.1))[0]

results: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str) -> None:
    results.append((name, passed, detail))
    print(f"{'PASS' if passed else 'FAIL'}  {name}: {detail}")


async def expect_error(socket) -> tuple[dict | None, int | None]:
    """Read until the server closes; return the error event it sent and the close code."""
    error = None
    try:
        async for raw in socket:
            event = json.loads(raw)
            if event["type"] == "error":
                error = event
    except ConnectionClosed:
        pass
    return error, socket.close_code


async def open_ready_stream(base: str):
    socket = await connect(ws_url(base))
    await socket.send(START)
    ready = json.loads(await socket.recv())
    if ready.get("type") != "ready":
        raise RuntimeError(f"expected ready, got {ready}")
    return socket


async def keep_sending_silence(socket, stop: asyncio.Event) -> None:
    while not stop.is_set():
        await socket.send(SILENT_FRAME)
        await asyncio.sleep(0.1)


async def check_admission_limit(base: str) -> None:
    sockets = [await open_ready_stream(base) for _ in range(MAX_STREAMS)]
    stop = asyncio.Event()
    senders = [asyncio.create_task(keep_sending_silence(s, stop)) for s in sockets]

    async with connect(ws_url(base)) as extra:
        error, code = await expect_error(extra)
    check("C5 stream beyond limit refused with 1013", code == 1013 and error and error["code"] == "server_busy",
          f"close={code} error={error}")

    await asyncio.sleep(0.5)
    stop.set()
    await asyncio.gather(*senders)
    finished = 0
    for socket in sockets:
        await socket.send(json.dumps({"type": "stop"}))
        async for raw in socket:
            if json.loads(raw)["type"] == "done":
                finished += 1
        await socket.close()
    check("C5 existing streams unaffected", finished == MAX_STREAMS, f"{finished}/{MAX_STREAMS} streams finished with done")


async def wait_for_no_active_streams(base: str, timeout: float = 3.0) -> int:
    deadline = time.monotonic() + timeout
    active = fetch_json(http_url(base, "/metrics"))["active_streams"]
    while active and time.monotonic() < deadline:
        await asyncio.sleep(0.1)
        active = fetch_json(http_url(base, "/metrics"))["active_streams"]
    return active


async def check_disconnect_cleanup(base: str) -> None:
    clean = await open_ready_stream(base)
    for _ in range(5):
        await clean.send(SILENT_FRAME)
    await clean.close()
    active = await wait_for_no_active_streams(base)
    check("C6 clean close mid-stream releases stream", active == 0, f"active_streams={active}")

    aborted = await open_ready_stream(base)
    for _ in range(5):
        await aborted.send(SILENT_FRAME)
    aborted.transport.abort()
    active = await wait_for_no_active_streams(base)
    check("C6 aborted TCP mid-stream releases stream", active == 0, f"active_streams={active}")


PROTOCOL_CASES = [
    ("binary before start", [SILENT_FRAME], "expected_start", 1008),
    ("wrong first message type", [json.dumps({"type": "hello"})], "expected_start", 1008),
    ("first message not JSON", ["not json"], "invalid_json", 1008),
    ("unsupported sample rate", [json.dumps({"type": "start", "sample_rate": 44100})], "unsupported_sample_rate", 1003),
    ("odd-length PCM frame", [START, b"\x00\x01\x02"], "invalid_frame", 1003),
    ("frame larger than limit", [START, b"\x00" * 32002], "frame_too_large", 1009),
    ("text other than stop after start", [START, json.dumps({"type": "start"})], "unexpected_message", 1008),
]


async def check_protocol_errors(base: str) -> None:
    for name, messages, expected_code, expected_close in PROTOCOL_CASES:
        async with connect(ws_url(base), max_size=None) as socket:
            for message in messages:
                await socket.send(message)
            error, close_code = await expect_error(socket)
        error_code = error["code"] if error else None
        check(f"C7 {name}", error_code == expected_code and close_code == expected_close,
              f"error={error_code} close={close_code} (expected {expected_code}/{expected_close})")
    health = fetch_json(http_url(base, "/health"))
    check("C7 service still healthy after bad input", health["status"] == "ok", str(health))


def post_speech(base: str, body: dict) -> tuple[int, bytes]:
    request = urllib.request.Request(http_url(base, "/v1/audio/speech"), data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def check_tts(base: str) -> None:
    status, payload = post_speech(base, {"input": "Em tìm được năm căn phù hợp ở Thủ Đức."})
    detail = f"status={status}"
    is_valid_wav = False
    if status == 200:
        with wave.open(io.BytesIO(payload)) as wav:
            seconds = wav.getnframes() / wav.getframerate()
            detail += f" rate={wav.getframerate()} channels={wav.getnchannels()} seconds={seconds:.2f}"
            is_valid_wav = wav.getnchannels() == 1 and seconds > 0.5
    check("C8 Vietnamese text returns valid WAV", is_valid_wav, detail)

    for name, body, expected in [
        ("empty input", {"input": "   "}, 400),
        ("input over 500 chars", {"input": "a" * 501}, 413),
        ("unsupported format", {"input": "xin chào", "response_format": "mp3"}, 400),
    ]:
        status, _ = post_speech(base, body)
        check(f"C8 {name} rejected", status == expected, f"status={status} expected={expected}")


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    args = parser.parse_args()

    await check_admission_limit(args.base)
    await check_disconnect_cleanup(args.base)
    await check_protocol_errors(args.base)
    check_tts(args.base)

    failed = [name for name, passed, _ in results if not passed]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
