# 2026-11-11 — Giọng Mimi: bỏ ký tự markdown khi đọc, giọng Azure HoaiMy (Piper dự phòng)

**Status:** PARTIAL — code xong và đã kiểm với Azure giả; **chưa gọi Azure thật** (chưa có key).

## Goal

1. Mimi không đọc ký tự `*` (và markdown khác) trong câu trả lời.
2. Giọng tự nhiên hơn giọng Piper hiện tại. Người dùng chọn **Azure `vi-VN-HoaiMyNeural`**, giữ Piper làm dự phòng.

Không làm: đổi cách hiển thị chữ (vẫn hiện `**`), đổi nhận dạng giọng nói, thêm thư viện.

## Success criteria

1. `speakable()` bỏ `* _ \` # ~`, gạch đầu dòng và số thứ tự; mỗi dòng là một câu; giá và mã sản phẩm giữ nguyên.
2. Có `AZURE_SPEECH_KEY` → `/v1/audio/speech` đọc bằng Azure (`X-TTS-Engine: azure`).
3. Azure lỗi (401, 429, mạng, trả không phải WAV) → đọc bằng Piper, không lỗi cho khách; bỏ qua Azure 60 giây; log không chứa key.
4. Không có key → hành vi như cũ (Piper).
5. Không thêm dependency; `protocol_checks.py` vẫn 16/16.

## Khảo sát giọng local (trước khi chọn Azure)

- sherpa-onnx chỉ có Piper cho tiếng Việt: vais1000 (medium, int8/fp16/full), 25hours_single (low), vivos (x_low), mimic3 vais1000 low.
- `25hours_single-low`: tokens không có ký hiệu thanh điệu → bỏ 10 phoneme trong câu chào (mất dấu); license dataset "Unknown". Loại.
- `vais1000-medium` bản đầy đủ: cùng người đọc với bản int8 đang chạy, render nhanh ~4x (0.65s vs 2.57s câu chào). Người dùng nghe thấy vẫn chưa ổn → chuyển hướng Azure.
- Đã tải vào `models/`: `vits-piper-vi_VN-vais1000-medium/`, `vits-piper-vi_VN-25hours_single-low/` (đã duyệt tải). Chưa dùng trong code.

## Thay đổi

- `lalaflow/frontend/src/components/useVoice.js`: `withoutMarkdown()` trước khi đọc.
- `speech-service/app/azure_tts.py` (mới): REST Azure theo tài liệu Microsoft (endpoint `https://<region>.tts.speech.microsoft.com/cognitiveservices/v1`,
  header `Ocp-Apim-Subscription-Key`, `Content-Type: application/ssml+xml`, `X-Microsoft-OutputFormat: riff-24khz-16bit-mono-pcm`, `User-Agent`),
  SSML escape chữ, tốc độ → `prosody rate`. Dùng `urllib` như `lalaflow_proxy.py`.
- `config.py`: `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` (mặc định `southeastasia`), `AZURE_TTS_VOICE`, `AZURE_TTS_ENDPOINT` (ghi đè, dùng để kiểm thử).
- `main.py`: Azure trước, lỗi thì Piper + nghỉ Azure 60s; header `X-TTS-Engine`; `/health` có `tts_voice`.
- `tests/azure_tts_checks.py` (mới), `README.md` (cấu hình + lệnh kiểm tra).

## Verification

```
speakable (Vite SSR):
"Mình hiểu bạn cần giấy dán tường chống ẩm cho phòng ngủ. Hiện tại chưa có sản phẩm khớp 100%. Bạn có thể tham khảo các mẫu (đang Có sẵn) dưới đây:"
"Gợi ý. Giấy A4 70gsm: 85000 đồng một ram. Giấy Kraft — 120000 đồng một cuộn. Mẫu MS8-100. Mẫu R-30."
"Giá 2000000 đồng là trọn gói."
npm run build: ✓ built in 1.16s

tests/azure_tts_checks.py: 13/13 checks passed
  (lần chạy đầu 12/13: A7 lỗi do test so tên header phân biệt hoa thường — urllib gửi "X-microsoft-outputformat"; sửa test, không sửa code)

speech-service :8010 với Azure giả:
health tts_voice: vi-VN-HoaiMyNeural
1 azure up      : (200, 'azure', 4844, 0.05s) azure calls [200]
2 azure 429     : (200, 'piper', 50220, 0.27s) azure calls [200, 429]
3 during pause  : (200, 'piper', 52268, 0.23s) azure calls [200, 429] (không gọi Azure thêm)
warning logged  : ['Azure TTS answered 429 for voice vi-VN-HoaiMyNeural, 23 chars; reading with the local voice for the next 60s']
key in log      : False
4 no key health : piper | (200, 'piper', 53804, 0.29s)

protocol_checks.py --base http://127.0.0.1:8010: 16/16 checks passed
```

## Còn lại

- Người dùng tạo tài nguyên Azure Speech, đặt `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`, khởi động lại server :8000 → kiểm `/health`
  (`tts_voice`) và header `X-TTS-Engine: azure`, nghe thử. Khi đó mới chuyển DONE.
- Server :8000 đang chạy là code cũ đến khi khởi động lại.
- Piper dự phòng vẫn là bản int8; có thể đổi sang `vais1000-medium` đầy đủ (nhanh hơn ~4x) — việc riêng, chưa làm.
- `models/vits-piper-vi_VN-25hours_single-low/` (78MB) không dùng — chờ người dùng quyết định xoá.
- Chữ trên màn hình vẫn hiện `**` (khác với phần đọc).
