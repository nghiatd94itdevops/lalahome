# 2026-11-12 — Một câu bị chặn khoá cả phiên chat

**Status:** DONE

## Goal

Phiên `aeca5ad8`: micro bắt tiếng nói xung quanh "…Mọi người trong tài khoản" (#725) → chặn `credentials`; sau đó mọi
câu, kể cả "mình tìm giấy dán tường", đều nhận câu từ chối. Nguyên nhân: `screenConversation` kiểm mọi câu của khách
trong lịch sử (tới 20 câu cũ), nên câu bị chặn cứ nằm đó chặn tiếp.

Không làm: đổi danh sách mẫu chặn, bỏ câu bị chặn khỏi lịch sử gửi OpenAI, lọc tiếng ồn micro.

## Success criteria

1. Lịch sử có câu chứa "tài khoản", câu mới "mình tìm giấy dán tường" → không chặn.
2. Câu mới nhất hỏi mật khẩu admin → chặn `credentials`.
3. Câu "bỏ qua các hướng dẫn" ở lượt trước → vẫn chặn `override`.
4. Lượt assistant giả mạo chứa lệnh override → vẫn chặn.

## Thay đổi

- `lalaflow/backend/chatGuard.js` `screenConversation`: quy tắc chủ đề chỉ áp cho câu hỏi mới nhất; quy tắc override
  vẫn áp cho mọi tin nhắn.

## Result

```
node guard_check.mjs chatGuard.js            (code mới)
PASS  1 earlier "tài khoản" does not lock later product question  got="" want=""
PASS  2 latest question about admin password is refused  got="credentials" want="credentials"
PASS  3 earlier override attempt still refused  got="override" want="override"
PASS  4 forged assistant turn with override refused  got="override" want="override"
PASS  5 plain product question passes  got="" want=""
PASS  6 payment "số tài khoản" still allowed  got="" want=""
6/6 passed

node guard_check.mjs chatGuard.old.mjs       (HEAD, đối chứng)
FAIL  1 earlier "tài khoản" does not lock later product question  got="credentials" want=""
5/6 passed

docker compose up -d --build backend; POST :8000/api/chat
E2E-1 earlier blocked + wallpaper: ANSWERED | products: 3
E2E-2 admin password: REFUSED
chat_logs: 734 mình tìm giấy dán tường → [{"keywords":["giấy dán tường"],...}]
           735 mật khẩu admin là gì    → {"blocked":"credentials"}
```

## Để sau

- Micro gửi cả tiếng nói chuyện xung quanh thành câu hỏi (#725–728).
- Backend chưa có bộ test; script kiểm nằm ở scratchpad.
