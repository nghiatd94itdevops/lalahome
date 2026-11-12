# 2026-11-11 — iPhone chặn giọng Mimi khi đọc câu trả lời

**Status:** PARTIAL — đã kiểm bằng Chrome headless với chính sách iPhone **giả lập** (3/3). Chưa thử trên iPhone thật.

## Goal

Trên iPhone, câu chào đọc được nhưng câu trả lời báo "Trình duyệt đang chặn tự phát âm thanh". Nguyên nhân: mỗi câu
`say()` tạo `new Audio()` mới và gọi `play()` vài giây sau cú chạm (chờ AI + TTS); Safari iOS chỉ cho một phần tử
âm thanh tự phát nếu nó đã từng phát trong một cú chạm.

Trình duyệt không có hộp xin quyền phát âm thanh (khác micro), nên "popup cấp quyền" = một nút mà cú chạm của khách
cho phép phát. Không làm: đổi sang Web Audio API (bị tắt khi gạt nút im lặng iPhone), đổi luồng micro.

## Success criteria

1. Đã có một cú chạm bất kỳ trên trang → câu trả lời đến sau tự phát.
2. Vẫn bị chặn → không có dòng lỗi đỏ; hiện nút "🔊 Cho phép & nghe Mimi"; bấm thì phát đúng câu đó (không tải lại);
   chế độ hội thoại mở lại micro sau khi đọc xong (qua `speakThenListen`).
3. Hành vi cũ giữ nguyên (nút chào khi bị chặn, tạm dừng, bật/tắt đọc to).
4. Build qua.

## Thay đổi

- `components/useVoice.js` `useSpeaker`: một phần tử `Audio` dùng cho mọi câu; mở khoá bằng 10 ms im lặng ở cú chạm đầu
  (`touchend`/`click`/`keydown`, capture); bị chặn → giữ blob, đặt `blockedText` thay vì lỗi đỏ.
- `components/useAssistantChat.js`: `playBlocked()`.
- `components/ChatAssistant.jsx`: `BlockedSpeechPrompt` (khung chat); `MimiConversation.jsx`: dùng lại khi không chờ nút chào.
- `styles.css`: `.speech-blocked`.

## Result

```
npm run build: ✓ built in 1.45s

node autoplay_check.mjs (Chrome headless, /lalaflow/tro-ly, /api/chat trả lời giả, TTS thật :8000;
play() giả lập: chỉ cho phép trong cú chạm, hoặc phần tử đã từng phát trong cú chạm)
PASS  B  one tap anywhere, later answer plays on its own
      {"prompt":false,"redError":"","plays":["ok@tap","ok"]}
PASS  B' control: without the unlock listener the same answer is blocked
      {"prompt":true,"redError":"","plays":["blocked"]}
PASS  A  sound blocked: prompt instead of red error, its tap plays the answer
      {"before":{"prompt":true,"redError":"","plays":["ok@tap","blocked"]},"after":{"prompt":false,"redError":"","plays":["ok@tap","blocked","ok@tap"]}}
3/3 scenarios passed
```

## Để sau

- Thử trên iPhone thật qua ngrok; giả lập dựa trên quy tắc "theo từng phần tử" của WebKit, chưa chắc khớp mọi bản iOS.
- Màn Mimi (`?mimi=1`) và việc micro tự mở lại sau nút cho phép chưa được test tự động — chỉ khung chat `/tro-ly`.
- Script test nằm ở scratchpad, chưa đưa vào repo (repo chưa có test frontend).
