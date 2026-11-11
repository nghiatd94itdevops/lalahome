"""C1, C2, C4: N concurrent streams replaying TTS-generated Vietnamese speech at real-time pace.

Latency is judged on the client clock: wall time of an event minus the wall time at which the audio it refers to
was sent. That includes server queueing, which the server-side `latency_ms` cannot see.

Measures speed only. TTS voice is cleaner than real speakers, so this says nothing about accuracy (that is C3).
"""

import argparse
import asyncio
import json
import sys
import time

import numpy as np
from websockets.asyncio.client import connect

from common import FRAME_SECONDS, percentile, silence, synthesize, to_pcm16_frames, ws_url

SENTENCES = [
    "Tôi muốn mua nhà ở Thủ Đức",
    "Ngân sách khoảng bốn tỷ rưỡi",
    "Diện tích ít nhất sáu mươi mét vuông",
    "Cho tôi xem căn thứ hai",
]
GAP_SECONDS = 1.2
LATENCY_LIMIT_MS = 1000


def build_audio(base: str) -> np.ndarray:
    parts = [silence(0.5)]
    for sentence in SENTENCES:
        parts += [synthesize(base, sentence), silence(GAP_SECONDS)]
    return np.concatenate(parts)


async def run_stream(base: str, frames: list[bytes], stream_index: int) -> dict:
    result = {"index": stream_index, "partials": 0, "finals": [], "errors": [],
              "client_final_ms": [], "client_first_partial_ms": [], "first_partial_wall": None}
    async with connect(ws_url(base), max_size=None) as socket:
        await socket.send(json.dumps({"type": "start", "sample_rate": 16000}))
        ready = json.loads(await socket.recv())
        if ready.get("type") != "ready":
            result["errors"].append(ready)
            return result

        started = time.perf_counter()
        receiver = asyncio.create_task(collect(socket, result, started))
        for position, frame in enumerate(frames):
            # A microphone frame exists only once its 100 ms have elapsed, so send it at its end time.
            # Scheduling against the start time keeps sleep jitter from accumulating into drift.
            await asyncio.sleep(max(0.0, started + (position + 1) * FRAME_SECONDS - time.perf_counter()))
            await socket.send(frame)
        await socket.send(json.dumps({"type": "stop"}))
        await receiver
    return result


async def collect(socket, result: dict, started: float) -> None:
    async for raw in socket:
        received_ms = (time.perf_counter() - started) * 1000
        event = json.loads(raw)
        if event["type"] == "partial":
            result["partials"] += 1
            if result["first_partial_wall"] is None:
                result["first_partial_wall"] = received_ms
        elif event["type"] == "final":
            result["finals"].append(event)
            result["client_final_ms"].append(round(received_ms - event["end_ms"]))
            if result["first_partial_wall"] is not None:
                result["client_first_partial_ms"].append(round(result["first_partial_wall"] - event["start_ms"]))
            result["first_partial_wall"] = None
        elif event["type"] == "error":
            result["errors"].append(event)
        elif event["type"] == "done":
            return


def report(results: list[dict]) -> bool:
    latencies = [ms for r in results for ms in r["client_final_ms"]]
    first_partials = [ms for r in results for ms in r["client_first_partial_ms"]]
    server_latencies = [f["latency_ms"] for r in results for f in r["finals"]]
    failures = []
    for result in results:
        texts = [f["text"] for f in result["finals"]]
        print(f"stream {result['index']}: partials={result['partials']} finals={len(texts)} errors={result['errors']}")
        if len(texts) != len(SENTENCES):
            failures.append(f"stream {result['index']} got {len(texts)} finals, expected {len(SENTENCES)}")
        if result["errors"]:
            failures.append(f"stream {result['index']} errors {result['errors']}")

    print("finals of stream 0:")
    for final in results[0]["finals"]:
        print(f"  [{final['segment_id']}] {final['text']}  (latency {final['latency_ms']} ms, first partial {final['first_partial_ms']} ms)")

    final_p50, final_p95 = percentile(latencies, 50), percentile(latencies, 95)
    first_p50, first_p95 = percentile(first_partials, 50), percentile(first_partials, 95)
    print(f"client final latency ms: n={len(latencies)} p50={final_p50} p95={final_p95}")
    print(f"client first partial ms: n={len(first_partials)} p50={first_p50} p95={first_p95}")
    print(f"server-side final latency ms: p50={percentile(server_latencies, 50)} p95={percentile(server_latencies, 95)}")
    if final_p95 is None or final_p95 > LATENCY_LIMIT_MS:
        failures.append(f"C2 final p95 {final_p95} > {LATENCY_LIMIT_MS}")
    if first_p95 is None or first_p95 > LATENCY_LIMIT_MS:
        failures.append(f"C1 first partial p95 {first_p95} > {LATENCY_LIMIT_MS}")

    for failure in failures:
        print(f"FAIL: {failure}")
    print("PASS" if not failures else "FAILED")
    return not failures


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    parser.add_argument("--streams", type=int, default=5)
    args = parser.parse_args()

    audio = build_audio(args.base)
    frames = to_pcm16_frames(audio)
    print(f"replaying {len(audio) / 16000:.1f}s of audio on {args.streams} concurrent streams")
    results = await asyncio.gather(*(run_stream(args.base, frames, i) for i in range(args.streams)))
    return 0 if report(list(results)) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
