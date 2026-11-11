# 2026-10-12 — speech-service: STT streaming qua WebSocket + TTS tiếng Việt (POC, máy dev)

**Status:** PARTIAL — C3 và kiểm tra trên trình duyệt cần người dùng nói thử

## Goal

Một service chạy trên máy dev (CPU) cho phép người dùng nói trực tiếp trên trang web và thấy chữ hiện dần
(partial) rồi chốt câu (final); chiều ngược lại đọc text tiếng Việt thành audio.

Không làm: gọi LLM/vLLM, điều phối hội thoại, search, auth, lưu audio, deploy Docker/K8s, barge-in.

## Decisions

- Model tiếng Việt chuyên dụng của sherpa-onnx đều là **offline** → giả lập streaming: Silero VAD cắt câu,
  nhận dạng lại đoạn đang nói mỗi 0.4 s audio để ra `partial`, nhận dạng lần cuối khi VAD chốt để ra `final`.
- STT và TTS chung một dependency (sherpa-onnx) nên gộp một service.
- Model đang dùng để test: ASR `zipformer-vi-30M-int8-2026-02-09` (nguồn hynt/Zipformer-30M-RNNT-6000h,
  **license CC-BY-NC-ND-4.0 — không dùng thương mại**), TTS `vits-piper-vi_VN-vais1000-medium-int8`
  (dataset CC-BY-4.0), VAD `silero_vad.onnx`.

## Success criteria

| # | Tiêu chí | Cách đo |
|---|---|---|
| C1 | Đang nói thì trang web hiện `partial`; partial đầu tiên p95 ≤ 1000 ms tính từ đầu câu | `first_partial_ms` trong event `final`, load test |
| C2 | `final` p95 ≤ 1000 ms tính từ lúc dứt lời (gồm cả khoảng im lặng VAD cần để chốt) | `latency_ms` trong event `final`, load test |
| C3 | Người dùng nói trực tiếp: ≥ 85% câu `final` được đánh dấu Đúng | `logs/feedback.jsonl` + `eval/feedback_report.py` — **người dùng chạy** |
| C4 | 5 stream đồng thời, phát audio đúng tốc độ thật: mọi stream nhận đủ `final`, không lỗi, C1/C2 vẫn đạt | `eval/load_test.py --streams 5` (audio do TTS sinh — đo tốc độ, không đo độ chính xác) |
| C5 | Stream thứ 6 khi `MAX_STREAMS=5` bị đóng với code 1013; 5 stream kia không bị ảnh hưởng | `eval/protocol_checks.py` |
| C6 | Client ngắt kết nối giữa chừng → `active_streams` về 0 | `eval/protocol_checks.py` qua `GET /metrics` |
| C7 | Message đầu không phải `start`, `sample_rate` ≠ 16000, frame lẻ byte/quá lớn → event `error` + close code tương ứng, server không crash | `eval/protocol_checks.py` |
| C8 | `POST /v1/audio/speech` trả WAV hợp lệ cho câu tiếng Việt; input rỗng/quá dài → 400/413 | `eval/protocol_checks.py` + người dùng nghe thử |

Ngoài phạm vi trên máy dev: ảnh hưởng tới vLLM (máy dev không chạy vLLM).

## Result

| # | Kết quả | Ghi chú |
|---|---|---|
| C1 | PASS | first partial p95 692 ms (client clock, 5 stream) |
| C2 | PASS | final p95 678 ms (client clock, 5 stream); ~500 ms trong đó là `VAD_MIN_SILENCE_SECONDS` |
| C3 | **PENDING — người dùng chạy** | Chưa có lượt nói thật nào. `feedback_report.py` đã chạy với dữ liệu giả để kiểm tra script |
| C4 | PASS | 5/5 stream, mỗi stream 4/4 final, 0 lỗi |
| C5 | PASS | Test âm: chạy server với `MAX_STREAMS=6` thì check C5 FAIL như mong đợi (stream thứ 6 bị nhận vào) |
| C6 | PASS | cả close sạch và abort TCP |
| C7 | PASS | 7 case lỗi, server vẫn healthy, log không có traceback |
| C8 | PASS (tự động) | WAV hợp lệ; chất lượng giọng cần người dùng nghe |

**Chưa được kiểm chứng bằng máy:** đường đi mic → AudioWorklet → WebSocket trên trình duyệt thật. Mới kiểm tra
`node --check` cho JS và trang/asset trả 200. Phải mở trình duyệt nói thử mới biết resampler và half-duplex chạy đúng.

**Quan sát:** câu "Cho tôi xem căn thứ hai" (giọng TTS) bị nghe thành "CHO TÔI/TUỔI SANG CĂN THỨ HAI" ở mọi lần chạy —
đúng loại lỗi khiến bước LLM sau này phải xác nhận lại ý định chọn căn.

### Raw output

```
## protocol_checks.py
PASS  C5 stream beyond limit refused with 1013: close=1013 error={'type': 'error', 'code': 'server_busy', 'message': 'max 5 concurrent streams'}
PASS  C5 existing streams unaffected: 5/5 streams finished with done
PASS  C6 clean close mid-stream releases stream: active_streams=0
PASS  C6 aborted TCP mid-stream releases stream: active_streams=0
PASS  C7 binary before start: error=expected_start close=1008 (expected expected_start/1008)
PASS  C7 wrong first message type: error=expected_start close=1008 (expected expected_start/1008)
PASS  C7 first message not JSON: error=invalid_json close=1008 (expected invalid_json/1008)
PASS  C7 unsupported sample rate: error=unsupported_sample_rate close=1003 (expected unsupported_sample_rate/1003)
PASS  C7 odd-length PCM frame: error=invalid_frame close=1003 (expected invalid_frame/1003)
PASS  C7 frame larger than limit: error=frame_too_large close=1009 (expected frame_too_large/1009)
PASS  C7 text other than stop after start: error=unexpected_message close=1008 (expected unexpected_message/1008)
PASS  C7 service still healthy after bad input: {'status': 'ok', 'asr_model': 'sherpa-onnx-zipformer-vi-30M-int8-2026-02-09', 'tts_model': 'vits-piper-vi_VN-vais1000-medium-int8'}
PASS  C8 Vietnamese text returns valid WAV: status=200 rate=22050 channels=1 seconds=1.92
PASS  C8 empty input rejected: status=400 expected=400
PASS  C8 input over 500 chars rejected: status=413 expected=413
PASS  C8 unsupported format rejected: status=400 expected=400

16/16 checks passed
exit=0

## load_test.py --streams 5
replaying 11.1s of audio on 5 concurrent streams
stream 0: partials=14 finals=4 errors=[]
stream 1: partials=14 finals=4 errors=[]
stream 2: partials=14 finals=4 errors=[]
stream 3: partials=14 finals=4 errors=[]
stream 4: partials=14 finals=4 errors=[]
finals of stream 0:
  [0] TÔI MUỐN MUA NHÀ Ở THỦ ĐỨC  (latency 545 ms, first partial 676 ms)
  [1] NGÂN SÁCH KHOẢNG BỐN TỶ RƯỠI  (latency 581 ms, first partial 672 ms)
  [2] DIỆN TÍCH ÍT NHẤT SÁU MƯƠI MÉT VUÔNG  (latency 567 ms, first partial 696 ms)
  [3] CHO TUỔI SANG CĂN THỨ HAI  (latency 634 ms, first partial 669 ms)
client final latency ms: n=20 p50=583 p95=678
client first partial ms: n=20 p50=674 p95=692
server-side final latency ms: p50=578 p95=634
PASS
exit=0

## negative test (server MAX_STREAMS=6)
FAIL  C5 stream beyond limit refused with 1013: close=1008 error={'type': 'error', 'code': 'idle_timeout', 'message': 'no data for 15.0s'}
PASS  C5 existing streams unaffected: 5/5 streams finished with done
15/16 checks passed
exit=1

## web assets
node --check web/app.js && node --check web/pcm-worklet.js -> ok
/ 200 text/html; charset=utf-8
/app.js 200 application/javascript
/pcm-worklet.js 200 application/javascript
```

## Follow-ups

- Duyệt tải ASR `zipformer-vi-int8-2025-04-20` (Apache-2.0, ~60 MB) để thay model 30M non-commercial; so sánh qua C3.
- Chưa đo giới hạn tải thật của máy dev (> 5 stream).
- Dockerfile / deploy chưa làm.
