# 2026-11-11 — Đường quay lại màn hình Mimi sau khi đóng

**Status:** DONE

## Vấn đề

Đóng màn hình Mimi (mở từ Welcome) xong, khách không biết bấm đâu để quay lại: nút "Trợ lý AI" mở khung chat nhỏ,
không có gì chỉ tới màn hình Mimi.

Người dùng chọn: giữ khung chat, thêm nút + bong bóng nhắc.

## Success criteria

1. Đóng màn hình Mimi → bong bóng "Mimi ở đây nè!" chỉ đúng nút "Trợ lý AI" (desktop) / tab "Trợ lý AI" (mobile), nằm trong màn hình, tự ẩn sau 6s.
2. Bấm bong bóng → mở lại màn hình Mimi, nói "Mimi đây! Bạn cần mình giúp gì thêm nào?" thay vì chào lại từ đầu.
3. Đầu khung chat có nút "🎤 Nói với Mimi" → đóng khung chat, mở màn hình Mimi.
4. Đầu khung chat không tràn, desktop và mobile.

## Thay đổi

- `MimiConversation.jsx`: prop `greetingText`; `MIMI_WELCOME_BACK`; `MimiReturnHint` đo vị trí nút có `data-mimi-anchor` đang hiện.
- `App.jsx`: `openConversation`, `returnHint`; đóng màn hình thì bật bong bóng.
- `ChatAssistant.jsx`: nút "🎤 Nói với Mimi", `data-mimi-anchor` trên nút nổi; `Shell.jsx`: `data-mimi-anchor` trên tab.
- `styles.css`: `.mimi-return-hint`; đầu khung chat bỏ chữ "Trợ lý AI" (mặt Mimi + nút nổi đã ghi), nút không xuống dòng, gap .35rem.

## Verification

Chromium headless qua CDP:

```
== D. desktop
  hint after close: {'text': 'Mimi ở đây nè! Bấm để nói chuyện tiếp 🎤', 'inside': True, 'above': True, 'tipOverButton': True}
  after hint tap: open=True says='Mimi đây! Bạn cần mình giúp gì thêm nào?'
  panel open, talk button: 🎤 Nói với Mimi | header overflow: False
  after 'Nói với Mimi': open=True panel_open=False says='Mimi đây! Bạn cần mình giúp gì thêm nào?'
  hint gone after 6s while open: True | console: []
== D. phone 390x844: như trên, header overflow: False, console: []
Hồi quy A (Welcome → chào → nghe → trả lời → nghe lại), B (mobile chặn âm thanh), C (phiên cũ): vẫn qua.
```

Lần đầu desktop báo `header overflow: True` (7 nút trong khung 400px) → bỏ tiêu đề, giảm gap; chạy lại False.
