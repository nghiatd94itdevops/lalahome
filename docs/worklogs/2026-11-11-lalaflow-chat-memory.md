# 2026-11-11 — Trợ lý AI quên thông tin khách đã đưa trong cùng phiên

**Status:** DONE (cải thiện rõ, chưa tuyệt đối — model nhỏ `gpt-5.4-nano` vẫn có thể trả lời lạc ở lượt khác)

## Vấn đề (từ log thật)

Phiên `cf90cb87…` (14 câu): câu 4 khách đưa họ tên + số điện thoại, câu 6 đưa email; câu 12 AI hỏi lại số điện thoại,
câu 13 AI nói "không thấy được số điện thoại".

Nguyên nhân: frontend (`HISTORY_SENT = 10`) và backend (`MAX_HISTORY = 10`) chỉ gửi 10 tin gần nhất = 5 lượt. Ở câu 12
cửa sổ chỉ còn từ câu 8 → thông tin câu 4, 6 không tới AI. Prompt dặn AI không đọc lại SĐT/email nên chúng chỉ nằm
trong tin của khách.

## Success criteria

1. SĐT/email đưa ở câu 4/6 vẫn tới AI ở câu 13+ (đến ~25 lượt).
2. Backend nhận tối đa 10 tin gần nhất + 20 câu hỏi cũ của khách; câu trả lời cũ của AI bị bỏ, không thành lỗi.
3. Phát lại phiên của bro: ở bước "10 cuộn" AI không hỏi lại SĐT.
4. Chat ngắn vẫn chạy.

## Thay đổi

- `backend/chat.js`: `RECENT_MESSAGES = 10` + `EARLIER_QUESTIONS = 20` thay `MAX_HISTORY`; `parseConversation` giữ 10 tin
  cuối nguyên vẹn, trước đó chỉ giữ tin của khách (≤20). `contactsGivenNote()`: SĐT/email khớp regex có sẵn
  (`PHONE_IN_TEXT`, `EMAIL_IN_TEXT`) trong tin của khách được nhắc lại 1 lần dạng system note — chỉ giá trị khớp regex,
  khách không chèn được chỉ dẫn; giá trị vốn đã nằm trong tin gửi model. Prompt quy tắc 8: đọc lại lịch sử, không hỏi lại.
- `frontend/src/components/useAssistantChat.js`: `historyForApi()` cùng cấu trúc.

## Verification

Phát lại 11 lượt đầu của phiên thật (SĐT/email giả `0901234567`, `khach.test@example.com` vì log đã che), gửi câu 12
"mỗi loại 10 cuộn chứ không phải 1 cuộn":

```
Lần 1 (chỉ thêm lịch sử, chưa có contactsGivenNote):
BEFORE run 1: draft=no  | run 2: draft=no, asks_phone_again=True
AFTER  run 1: draft=yes draft_phone=0901234567 | run 2: draft=no — vẫn hỏi "cần đúng họ tên và số điện thoại"
→ chưa đủ, thêm contactsGivenNote.

Lần 2 (bản cuối):
BEFORE (last 10 only) run 1-4: draft=no ×4, asks_phone_again=True ×3
AFTER  (new history)  run 1: draft=yes draft_phone=0901234567
AFTER  (new history)  run 2: draft=yes draft_phone=0901234567
AFTER  (new history)  run 3: draft=no — 'Xin lỗi, mình chưa tìm được câu trả lời phù hợp…' (câu dự phòng, không hỏi lại SĐT)
AFTER  (new history)  run 4: draft=yes draft_phone=0901234567
40-message payload (39 tin, trả lời 1900 ký tự): trả lời bình thường, không lỗi
short chat: "Giấy A4 70gsm hiện LalaFlow có 180.000đ/đơn vị …"
node --check backend/chat.js: ok | docker compose up -d --build backend: Started | /health {"ok":true}
```

## Theo dõi

- Run 3 trả câu dự phòng chung — đường lỗi riêng của `answer()` (hết vòng tool / reply rỗng), chưa điều tra.
- Email trong phiên thật `…@gmailcom` (thiếu dấu chấm) không khớp regex nên không được nhắc lại — đúng, vì không hợp lệ.
- `screenConversation` quét cả câu hỏi cũ: một câu bị chặn giờ ảnh hưởng tới ~20 câu sau thay vì 5.
- Tốn token thêm tối đa 20 × 500 ký tự câu hỏi cũ mỗi lượt (thường ít hơn nhiều).
