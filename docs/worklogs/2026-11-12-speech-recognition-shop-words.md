# 2026-11-12 — Nhận giọng nói: từ ưu tiên của shop, chờ khi khách ngừng giữa câu

**Status:** DONE

Một điểm cần lưu ý: mốc C2 có sẵn của dự án (`load_test.py`, 5 luồng, p95 ≤ 1000ms) **không ổn định trên máy này
ngay cả với cấu hình cũ**. Chi tiết ở phần Verification.

## Goal

Người dùng thấy ba vấn đề khi nói với Mimi:
- nghe sai chữ, nhất là tên hàng, và với giọng các vùng miền;
- cắt câu khi khách ngừng để nghĩ;
- chữ hiện chậm hoặc giật.

Người dùng chọn cải thiện bản chạy trên máy, giữ nguyên mô hình.

**Không làm:**
- đổi sang Azure;
- đổi mô hình hoặc tải mô hình mới;
- huấn luyện lại mô hình;
- sửa Dockerfile.

## Success criteria

5. Có bộ câu thử đo tỉ lệ chữ sai (WER) trước và sau. Câu có tên hàng phải giảm rõ, câu thường không được tệ hơn.
6. Câu có chỗ ngừng để nghĩ, ví dụ "tôi cần giấy dán tường giá khoảng … hai trăm nghìn", không bị gửi đi giữa chừng.
7. Thời gian từ lúc khách nói xong tới lúc có chữ cuối không chậm hơn trước quá 150ms.

## Thay đổi

- `speech-service/app/hotwords.py` (mới): đọc danh sách mảnh từ (BPE) và điểm của chúng từ `bpe.model`.
  - Dùng một hàm đọc protobuf nhỏ, không cài thêm thư viện `sentencepiece`.
  - Ghi ra `logs/asr/bpe.vocab` và danh sách từ viết hoa vào `logs/asr/hotwords.txt`, vì sherpa-onnx cần hai file này.
- `speech-service/app/asr_hotwords.txt` (mới): danh sách từ của shop, chủ shop tự sửa được.
  - Gồm loại hàng, thương hiệu trong danh mục, và các từ khách hay hỏi.
  - Đặt trong `app/` vì Dockerfile chỉ chép thư mục này.
- `config.py`: thêm `ASR_DECODING` (mặc định `modified_beam_search`), `ASR_HOTWORDS_FILE` (đặt rỗng để tắt) và
  `ASR_HOTWORDS_SCORE` (mặc định 5).
- `stt.py`: truyền cách giải mã và danh sách từ vào bộ nhận giọng. Danh sách từ chỉ có tác dụng với beam search.
- `lalaflow/frontend/src/components/useVoice.js`: sau mỗi đoạn câu, trình duyệt chờ 1,5 giây như trước. Riêng hai
  trường hợp sau thì chờ 3,5 giây:
  - mới nói dưới 3 chữ;
  - câu đang dừng ở một từ chưa thể kết thúc câu hỏi: "khoảng", "và", "loại", "cho", số đếm, "ờ", "ừm"…
- `speech-service/tests/stt_eval.py` (mới): bộ đo WER, chạy không cần server.
  - 30 câu (16 câu có tên hàng, 14 câu thường) × 2 giọng Piper × 5 dạng (sạch, ồn, có người nói lẫn, chậm, nhanh).
  - `--real` để thêm file ghi âm thật.
- `README.md`: thêm các biến cấu hình mới và lệnh đo.

**Đã thử rồi bỏ:** dùng greedy cho chữ hiện tạm và beam cho câu chốt. Đo 3 lần, p95 là 1079, 1012 và 1021ms, không
nhanh hơn, nên đã gỡ ra.

**Không đổi:** `PARTIAL_INTERVAL_SECONDS` (chữ hiện tạm). Mình không có số đo cho thấy đổi nó sẽ mượt hơn, trong khi
độ trễ đã sát mốc.

## Verification

### 5. Tỉ lệ chữ sai: `stt_eval.py --compare --scores 5 7` (300 câu nói)

```
== greedy (before): WER all 24.9% | shop 30.7% | everyday 18.2% | real -% | slowest 100ms frame 556ms | 166.6s
   everyday/babble=23.4  everyday/clean=16.0  everyday/fast=17.2  everyday/noise=16.0  everyday/slow=18.4  shop/babble=35.3  shop/clean=29.3  shop/fast=28.3  shop/noise=31.3  shop/slow=29.0
== beam: WER all 25.0% | shop 30.9% | everyday 18.0% | real -% | slowest 100ms frame 467ms | 193.0s
   everyday/babble=22.3  everyday/clean=16.0  everyday/fast=17.6  everyday/noise=16.4  everyday/slow=17.6  shop/babble=36.3  shop/clean=28.7  shop/fast=28.3  shop/noise=31.0  shop/slow=30.3
== beam+shop-words 5.0: WER all 22.1% | shop 25.9% | everyday 17.7% | real -% | slowest 100ms frame 446ms | 140.6s
   everyday/babble=22.7  everyday/clean=16.0  everyday/fast=16.4  everyday/noise=16.0  everyday/slow=17.6  shop/babble=31.7  shop/clean=22.0  shop/fast=25.7  shop/noise=26.3  shop/slow=23.7
== beam+shop-words 7.0: WER all 22.2% | shop 25.9% | everyday 17.9% | real -% | slowest 100ms frame 1145ms | 155.6s
```

Lần chạy trước với mức 1,5 / 2,5 / 3,5 cho tỉ lệ sai câu có tên hàng lần lượt 28,5 / 27,9 / 26,9%.

**Kết quả: PASS.**
- Câu có tên hàng: 30,7% → 25,9%. Riêng câu sạch: 29,3% → 22,0%.
- Câu thường: 18,2% → 17,7%, không tệ hơn.

**Giới hạn của phép đo:**
- Giọng dùng để thử là giọng máy, không phải khách thật, cũng không phải giọng vùng miền.
- Ba file giọng người thật đi kèm mô hình không có câu đúng để so.
- Tên thương hiệu nước ngoài (soho, living, kraft, couche, eroom) vẫn hay sai, vì mô hình tiếng Việt không có cách viết
  cho những từ đó.

### 6. Ngừng 2,5 giây giữa câu, micro giả trong Chromium, giọng thật từ server

```
# bản mới (chờ 3,5s khi câu dừng ở "khoảng")
pause 2.5s: first question sent = 'Cần giấy dán tường giá khoảng Hai trăm nghìn một cuộn'
    10.37s ← final CẦN GIẤY DÁN TƯỜNG GIÁ KHOẢNG
    13.67s ← final HAI TRĂM NGHÌN MỘT CUỘN
    15.18s → {"type":"stop"}
# đối chứng: tạm đặt MID_THOUGHT_MS = 1500 (như cũ), build, chạy lại, rồi trả về 3500 và build lại
pause 2.5s: first question sent = 'Cần giấy dán tường giá khoảng'
    10.16s ← final CẦN GIẤY DÁN TƯỜNG GIÁ KHOẢNG
    11.66s → {"type":"stop"}
```

**Kết quả: PASS.**

Hai lần chạy đầu bị cắt, nhưng nguyên nhân là bộ thử:
- micro giả của Chrome làm méo file 22,05kHz;
- file phát trước khi micro mở.

Gửi thẳng file đó tới server thì nhận đủ hai đoạn. Đã sửa bộ thử: chuyển file sang 48kHz và thêm 8 giây im lặng ở đầu.

### 7. Độ trễ: `load_test.py --streams 5`, đo xen kẽ cũ/mới, mỗi cấu hình 6 lần

```
round 1 old: client final latency ms: n=20 p50=810 p95=1017
round 1 old: client final latency ms: n=20 p50=914 p95=1011
round 1 new: client final latency ms: n=20 p50=816 p95=1047
round 1 new: client final latency ms: n=20 p50=797 p95=1064
round 2 old: client final latency ms: n=20 p50=856 p95=969
round 2 old: client final latency ms: n=20 p50=911 p95=973
round 2 new: client final latency ms: n=20 p50=822 p95=1011
round 2 new: client final latency ms: n=20 p50=893 p95=1092
round 3 old: client final latency ms: n=20 p50=772 p95=908
round 3 old: client final latency ms: n=20 p50=856 p95=1044
round 3 new: client final latency ms: n=20 p50=820 p95=1049
round 3 new: client final latency ms: n=20 p50=864 p95=1036
```

| Cấu hình | p50 trung bình | p95 trung bình |
|---|---|---|
| Cũ | 853ms | 987ms |
| Mới | 835ms | 1050ms |

**Kết quả: PASS** (p95 chậm thêm 63ms, dưới mức 150ms).

Tuy vậy, mốc C2 của dự án (p95 ≤ 1000ms) thì cấu hình cũ vượt 3/6 lần, cấu hình mới vượt 6/6 lần. Với 1 luồng thì
đạt (p95 748ms).

### Kiểm tra giao thức: `protocol_checks.py`

```
16/16 checks passed
```

## Theo dõi thêm

- **Mốc C2 trên máy chủ thật**: cần đo lại `load_test.py --streams 5` trên đúng máy sẽ deploy. Nếu vượt, đặt
  `ASR_DECODING=greedy_search` để quay về cách cũ. Cách này cũng tắt luôn danh sách từ.
- **Giọng vùng miền**: muốn đánh giá đúng thì cần khoảng 20–30 đoạn ghi âm khách thật ở các vùng, chạy với `--real`.
  Nếu vẫn kém thì việc tiếp theo là đổi mô hình lớn hơn. Đổi mô hình cần quyết định riêng, và mô hình hiện tại cũng có
  giấy phép không cho dùng thương mại.
- Trong trình duyệt (micro giả), chữ "Tôi" đầu câu bị mất ở cả bản cũ lẫn bản mới, trong khi gửi thẳng tới server thì
  vẫn có. Chưa rõ là do micro giả hay do lúc micro mới bật; cần thử bằng micro thật.
- Khởi động lại server :8000 trong lúc làm đã ghi đè `logs/server.log` cũ. Log mới nằm ở `logs/server-*.log`.
