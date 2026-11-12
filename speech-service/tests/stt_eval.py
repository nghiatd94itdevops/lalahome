"""Word error rate of the speech-to-text path for shop questions, to compare recogniser settings.

Runs in-process (no server needed) through the same StreamingTranscriber the WebSocket uses, so VAD cuts count.
The questions are spoken by the local Piper voices, then made harder (noise, a second voice in the background,
slower, faster). Synthetic voices are not real customers or regional accents: add real recordings with --real.

    python speech-service/tests/stt_eval.py                       # current settings from config.py / env
    python speech-service/tests/stt_eval.py --compare             # greedy vs beam vs beam + shop words
    python speech-service/tests/stt_eval.py --real recordings/    # also score <name>.wav + <name>.txt pairs
"""
import argparse
import json
import re
import sys
import time
import wave
from dataclasses import replace
from pathlib import Path

import numpy as np
import sherpa_onnx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import MODELS_DIR, PROJECT_ROOT, load_settings  # noqa: E402
from app.stt import SAMPLE_RATE, StreamingTranscriber, create_recognizer, create_vad_config  # noqa: E402

FRAME_SAMPLES = 1600
VOICES = ["vits-piper-vi_VN-vais1000-medium-int8", "vits-piper-vi_VN-25hours_single-low"]
CACHE_DIR = PROJECT_ROOT / "logs" / "stt-eval-cache"
LEAD_SILENCE_S = 0.5
TAIL_SILENCE_S = 1.0
NOISE_SNR_DB = 12
BABBLE_SNR_DB = 10
SLOW, FAST = 0.9, 1.12

# What a visitor says, written the way the recogniser writes it (numbers in words, no punctuation).
SHOP_QUESTIONS = [
    "tôi cần giấy dán tường chống ẩm cho phòng ngủ",
    "bên mình có vải dán tường vinyl pvc không",
    "cho tôi xem mẫu giấy dán tường hàn quốc soho",
    "giấy dán tường hàn quốc living giá bao nhiêu một cuộn",
    "có xốp dán tường giả gạch màu xám không",
    "tôi muốn mua giấy in a bốn định lượng bảy mươi",
    "giấy kraft làm bao bì giá thế nào",
    "giấy couche loại nào in đẹp",
    "tôi cần giấy bìa cứng để làm hộp",
    "vải dán tường đáy chữ thập có chống cháy không",
    "giấy dán tường giá rẻ dưới hai trăm nghìn",
    "phòng khách hai mươi mét vuông cần bao nhiêu cuộn giấy dán tường",
    "cho tôi báo giá năm cuộn giấy dán tường hera",
    "giấy dán tường chống nước cho nhà tắm",
    "mẫu giấy dán tường bos còn hàng không",
    "giấy dán tường darae với eroom loại nào bền hơn",
]
EVERYDAY_QUESTIONS = [
    "chào em anh muốn hỏi một chút",
    "cửa hàng mình mở cửa đến mấy giờ",
    "bên em có giao hàng tận nơi không",
    "số điện thoại của tôi là không chín không ba một hai ba bốn năm sáu",
    "tôi ở quận bình thạnh thành phố hồ chí minh",
    "cảm ơn em nhiều nhé",
    "thôi để anh suy nghĩ thêm rồi báo lại",
    "có được thanh toán khi nhận hàng không",
    "nhà tôi tường hay bị thấm nước vào mùa mưa",
    "tôi muốn đặt hàng gửi ra hà nội",
    "giá này đã bao gồm công thi công chưa",
    "khoảng bao lâu thì nhận được hàng",
    "anh tên là minh email là minh a còng gờ meo chấm com",
    "em tư vấn giúp anh loại nào phù hợp nhé",
]


def normalise(text: str) -> list[str]:
    return re.sub(r"[^\w\s]", " ", text.upper()).split()


def word_errors(reference: list[str], hypothesis: list[str]) -> int:
    row = list(range(len(hypothesis) + 1))
    for i, ref_word in enumerate(reference, 1):
        previous, row[0] = row[0], i
        for j, hyp_word in enumerate(hypothesis, 1):
            previous, row[j] = row[j], min(row[j] + 1, row[j - 1] + 1, previous + (ref_word != hyp_word))
    return row[-1]


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path)) as wav:
        rate = wav.getframerate()
        samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").astype(np.float32) / 32768
    return resample(samples, rate / SAMPLE_RATE)


def resample(samples: np.ndarray, factor: float) -> np.ndarray:
    """factor > 1 shortens the audio: faster and higher, like a quicker speaker with a different voice."""
    length = int(len(samples) / factor)
    return np.interp(np.linspace(0, len(samples) - 1, length), np.arange(len(samples)), samples).astype(np.float32)


def write_wav(path: Path, samples: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())


def synthesize(voice: str, group: str, sentences: list[str]) -> dict[str, np.ndarray]:
    """Clean 16 kHz audio per sentence, cached on disk so later runs only decode."""
    folder = CACHE_DIR / voice / group
    cached = folder / "sentences.json"
    if cached.exists() and json.loads(cached.read_text(encoding="utf-8")) != sentences:
        for old in folder.glob("*.wav"):
            old.unlink()
    missing = [s for s in sentences if not (folder / f"{sentences.index(s):02d}.wav").exists()]
    if missing:
        model_dir = MODELS_DIR / voice
        vits = sherpa_onnx.OfflineTtsVitsModelConfig(model=str(next(model_dir.glob("*.onnx"))),
                                                     tokens=str(model_dir / "tokens.txt"),
                                                     data_dir=str(model_dir / "espeak-ng-data"))
        tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=vits, num_threads=2)))
        for sentence in missing:
            audio = tts.generate(sentence, sid=0, speed=1.0)
            write_wav(folder / f"{sentences.index(sentence):02d}.wav",
                      resample(np.asarray(audio.samples, dtype=np.float32), audio.sample_rate / SAMPLE_RATE))
        cached.write_text(json.dumps(sentences, ensure_ascii=False), encoding="utf-8")
    return {s: read_wav(folder / f"{i:02d}.wav") for i, s in enumerate(sentences)}


def with_noise(samples: np.ndarray, noise: np.ndarray, snr_db: float) -> np.ndarray:
    noise = np.resize(noise, len(samples))
    gain = np.sqrt(np.mean(samples ** 2) / (np.mean(noise ** 2) * 10 ** (snr_db / 10) + 1e-12))
    return samples + gain * noise


def variants(clean: dict[str, np.ndarray]) -> list[tuple[str, str, np.ndarray]]:
    rng = np.random.default_rng(7)
    sentences = list(clean)
    out = []
    for i, (sentence, audio) in enumerate(clean.items()):
        other = clean[sentences[(i + 5) % len(sentences)]]
        out += [
            ("clean", sentence, audio),
            ("noise", sentence, with_noise(audio, rng.standard_normal(len(audio)).astype(np.float32), NOISE_SNR_DB)),
            ("babble", sentence, with_noise(audio, other, BABBLE_SNR_DB)),
            ("slow", sentence, resample(audio, SLOW)),
            ("fast", sentence, resample(audio, FAST)),
        ]
    return out


def transcribe(recognizer, vad_config, settings, samples: np.ndarray) -> tuple[str, float]:
    """Returns the joined finals and how long after the last audio frame the last final arrived (ms of compute)."""
    transcriber = StreamingTranscriber(recognizer, vad_config, settings.partial_interval_seconds)
    padded = np.concatenate([np.zeros(int(LEAD_SILENCE_S * SAMPLE_RATE), np.float32), samples,
                             np.zeros(int(TAIL_SILENCE_S * SAMPLE_RATE), np.float32)])
    finals, decode_ms = [], 0.0
    for start in range(0, len(padded), FRAME_SAMPLES):
        began = time.perf_counter()
        events = transcriber.accept(padded[start:start + FRAME_SAMPLES])
        decode_ms = max(decode_ms, (time.perf_counter() - began) * 1000)
        finals += [e.text for e in events if hasattr(e, "segment_id")]
    finals += [e.text for e in transcriber.flush()]
    return " ".join(t for t in finals if t), decode_ms


def score(settings, cases) -> dict:
    recognizer = create_recognizer(settings)
    vad_config = create_vad_config(settings)
    totals: dict[str, list[int]] = {}
    worst_frame_ms = 0.0
    misses = []
    started = time.perf_counter()
    for group, condition, reference, audio in cases:
        hypothesis, frame_ms = transcribe(recognizer, vad_config, settings, audio)
        worst_frame_ms = max(worst_frame_ms, frame_ms)
        ref, hyp = normalise(reference), normalise(hypothesis)
        errors = word_errors(ref, hyp)
        for key in (group, f"{group}/{condition}", "all"):
            totals.setdefault(key, [0, 0])
            totals[key][0] += errors
            totals[key][1] += len(ref)
        if errors and condition == "clean":
            misses.append(f"    [{group}] {reference!r}\n      → {hypothesis.lower()!r}")
    return {"wer": {k: round(100 * e / n, 1) for k, (e, n) in sorted(totals.items())},
            "worst_frame_ms": round(worst_frame_ms), "seconds": round(time.perf_counter() - started, 1), "misses": misses}


def build_cases(real_dir: Path | None):
    cases = []
    for voice in VOICES:
        if not (MODELS_DIR / voice).exists():
            print(f"skip voice {voice}: not in models/")
            continue
        for group, sentences in (("shop", SHOP_QUESTIONS), ("everyday", EVERYDAY_QUESTIONS)):
            for condition, sentence, audio in variants(synthesize(voice, group, sentences)):
                cases.append((group, condition, sentence, audio))
    if real_dir:
        for wav in sorted(real_dir.glob("*.wav")):
            text = wav.with_suffix(".txt")
            if text.exists():
                cases.append(("real", "clean", text.read_text(encoding="utf-8").strip(), read_wav(wav)))
    return cases


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compare", action="store_true", help="score several decoder settings side by side")
    parser.add_argument("--real", type=Path, help="folder of real recordings: name.wav + name.txt (reference text)")
    parser.add_argument("--json", type=Path, help="also write the results here")
    parser.add_argument("--scores", type=float, nargs="+", default=[1.5, 2.5, 3.5],
                        help="hotword boosts to try with --compare")
    args = parser.parse_args()

    cases = build_cases(args.real)
    print(f"{len(cases)} utterances")
    base = load_settings()
    configs = {"current": base}
    if args.compare:
        beam = replace(base, asr_decoding="modified_beam_search")
        configs = {
            "greedy (before)": replace(base, asr_decoding="greedy_search", asr_hotwords_file=None),
            "beam": replace(beam, asr_hotwords_file=None),
            **{f"beam+shop-words {score}": replace(beam, asr_hotwords_score=score) for score in args.scores},
        }
    results = {}
    for name, settings in configs.items():
        results[name] = score(settings, cases)
        r = results[name]
        print(f"\n== {name}: WER all {r['wer']['all']}% | shop {r['wer'].get('shop')}% | everyday {r['wer'].get('everyday')}%"
              f" | real {r['wer'].get('real', '-')}% | slowest 100ms frame {r['worst_frame_ms']}ms | {r['seconds']}s")
        print("   " + "  ".join(f"{k}={v}" for k, v in r["wer"].items() if "/" in k))
        print("   clean-audio misses:\n" + "\n".join(r["misses"][:40]))
    if args.json:
        args.json.write_text(json.dumps({k: {**v} for k, v in results.items()}, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
