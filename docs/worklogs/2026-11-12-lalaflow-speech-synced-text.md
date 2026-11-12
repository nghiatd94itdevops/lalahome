# 2026-11-12 — Chữ câu trả lời hiện theo giọng Mimi

**Status:** DONE

## Goal

Trước đây câu trả lời hiện hết chữ ngay, rồi vài giây sau Mimi mới bắt đầu đọc. Người dùng muốn hai việc này đồng bộ:
Mimi nói tới đâu thì chữ hiện tới đó. Khi không đọc được thành tiếng thì vẫn phải hiện đủ chữ.

## Success criteria

1. Khi có đọc to, chữ không hiện trước tiếng. Dấu ba chấm "đang trả lời" giữ nguyên tới khi có tiếng.
2. Trong lúc đọc, chữ hiện dần theo tiến độ âm thanh, lệch không quá khoảng một câu. Đọc xong thì hiện đủ.
3. Hiện đủ chữ ngay khi tắt đọc to, giọng đọc lỗi hoặc bị chặn, hoặc khách tạm dừng.
4. Tin nhắn cũ và lịch sử luôn hiện đủ.

## Thay đổi

- `components/speechReveal.js` (mới): đổi "đã phát bao nhiêu % âm thanh" thành "hiện bao nhiêu chữ".
  - Chữ số được tính nặng hơn, vì "180.000đ" đọc dài hơn viết.
  - Dấu câu được cộng thêm thời gian, vì giọng đọc ngừng ở đó.
  - Luôn hiện tới hết từ đang đọc, không cắt nửa chữ.
- `components/useVoice.js` (`useSpeaker`): thêm `reading = { text, chars }`.
  - Gọi `say()` thì `chars = 0`.
  - Có tiếng thì mỗi khung hình cập nhật `chars` theo `currentTime / duration`.
  - Kết thúc theo bất kỳ cách nào (đọc xong, dừng, lỗi, bị chặn) thì `reading = null`, nghĩa là hiện đủ chữ.
- `components/ChatAssistant.jsx`: thêm `spokenSoFar()`.
  - Chỉ áp dụng cho tin nhắn mới nhất.
  - Sản phẩm và phiếu báo giá chỉ hiện sau khi đọc xong.
  - Khung chat tự cuộn theo chữ đang hiện.
- `components/MimiConversation.jsx`: cùng cách làm cho câu chào và câu trả lời. Ba chấm hiện tới khi câu chào có tiếng.

Ghi chú: các file `useVoice.js`, `ChatAssistant.jsx`, `MimiConversation.jsx` cũng đang chứa thay đổi chưa commit của
những việc khác: âm thanh iPhone, chọc Mimi, chờ khi khách ngừng giữa câu.

## Verification

Chạy bằng Chromium headless qua CDP, giọng thật từ server :8000 (Piper), câu trả lời thật từ AI.
Script nằm trong scratchpad `sync_e2e.py`, lấy mẫu mỗi 0,15 giây.

```
== F. answer read aloud: text appears as the audio plays
  full reply (571 chars) shown whole at end: True; products: 3
  [answer] samples while preparing with text visible: 0
    audio   0.2%  text   0.7%  'Mình'
    audio  24.7%  text  31.5%  'u “giấy dán tường” đang có sẵn sau (mình'
    audio  49.3%  text  55.0%  'àn Quốc Soho 56109-2 (#38) – 65.000đ/đơn'
    audio  73.7%  text  75.1%  'iấy dán tường Hàn Quốc BOS 81106-7 (#41)'
    audio  98.2%  text  98.9%  ', hay chỉ cần chống ẩm/giữ bề mặt ổn hơn'
  playing samples: 196, largest gap text-vs-audio: 9.3% of the answer
  [greeting] samples while preparing with text visible: 0
    audio   0.3%  text   5.2%  'Chào'
    audio  46.4%  text  54.5%  'ào bạn, mình là Mimi, trợ lý AI của LaLa'
    audio  93.1%  text 100.0%  ' LaLa Home. Mình có thể giúp gì cho bạn?'
  playing samples: 26, largest gap text-vs-audio: 8.1% of the answer
  console: []
== G. speech service fails: the answer appears whole, products shown
  greeting with dead voice: text='Chào bạn, mình là Mimi, trợ lý AI của LaLa Home. M' status='Bấm micro để nói, hoặc gõ câu hỏi.'
  right after the answer arrived: whole text=True products=3 problem='Chưa đọc được câu trả lời (dịch vụ giọng nói không phản hồi).'
== H. chat panel with read-aloud on; switching it off mid-answer shows the rest at once
  dots kept after answer arrived until sound: True
  mid-read: 114/551 chars, products shown: 0
  after read-aloud off: whole text=True products=3 playing=False
  console: []
npm run build: ✓ built in 1.32s
```

| Tiêu chí | Kết quả |
|---|---|
| 1 | PASS. Không có mẫu nào vừa "chuẩn bị nói" vừa có chữ (F); khung chat giữ ba chấm (H). |
| 2 | PASS. Lệch lớn nhất 9,3% câu trả lời; câu chào lệch 8,1%. Đọc xong thì hiện đủ chữ. |
| 3 | PASS. Giọng lỗi (G) và tắt đọc giữa chừng (H) đều hiện đủ chữ ngay. |
| 4 | PASS. Code chỉ áp dụng cho tin nhắn mới nhất (`i === latest`). |

Lần chạy đầu phát hiện lỗi: câu chào không hiện chữ trong lúc Mimi đọc, vì màn hình coi là "đang chuẩn bị" tới khi
đọc xong. Đã sửa: chỉ ẩn chữ khi chưa có `reading`. Lần chạy lại đạt.

## Theo dõi thêm

- Câu trả lời của AI vẫn dài (551–571 ký tự) và còn gạch đầu dòng, `(#38)`, `[Mẫu]`, dù quy tắc 6 yêu cầu chữ thường
  và tối đa 90 từ.
- Phần đọc chỉ lấy 500 ký tự đầu (`MAX_SPOKEN_CHARS`), nên với câu dài, phần chữ sau 500 ký tự sẽ hiện hết lúc đọc xong.
