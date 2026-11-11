# 2026-10-15 — LalaFlow gọi API qua cùng origin (/api) để chạy được sau ngrok

**Status:** DONE (kiểm qua URL ngrok công khai; người dùng cần thử bằng trình duyệt trên thiết bị ngoài)

## Vấn đề

Qua ngrok (`https://<id>.ngrok-free.dev` → `localhost:8000`), trang hiện nhưng chat, yêu cầu báo giá (và cả danh sách
sản phẩm, ảnh) không gọi được server từ thiết bị ngoài internet.

Nguyên nhân: `lalaflow/frontend/src/api.js` mặc định `API_BASE = "http://localhost:4000"` khi không đặt
`VITE_API_BASE_URL` → trên thiết bị ngoài, `localhost` là chính thiết bị đó; thêm vào đó trang https gọi http bị chặn
(mixed content). Phần giọng nói chạy được vì dùng `window.location.origin`.

## Thay đổi

- `speech-service/app/lalaflow_proxy.py` (mới): server :8000 chuyển `/api/<path>` → `LALAFLOW_API_UPSTREAM`
  (mặc định `http://127.0.0.1:4000`). Thư viện chuẩn, không thêm dependency; giữ header `Authorization`; trả nguyên
  mã lỗi 4xx/5xx của backend; không tự theo redirect; giới hạn body 26 MB; timeout 90 s; backend chết → 502 có log.
  Nối thêm `X-Forwarded-For` để backend thấy IP thật.
- `main.py`: gắn router trước static mount (mount "/" nuốt mọi đường dẫn đăng ký sau nó). `config.py`: `lalaflow_api_upstream`.
- `lalaflow/frontend/src/api.js`: bản build mặc định `API_BASE = "/api"`; `vite dev` giữ `http://localhost:4000`;
  `VITE_API_BASE_URL` vẫn ưu tiên.
- `lalaflow/.env`: `TRUST_PROXY=loopback, uniquelocal` — giới hạn chat theo IP (`chat.js`, `req.ip`) không còn gộp mọi
  khách vào IP gateway Docker. Backend được tạo lại container; server :8000 và :8001 khởi động lại.

## Verification

```
qua http://127.0.0.1:8000/api
health 200 {"ok":true} | products 55 | image 200 image/jpeg | reviews 200
quote (body rỗng) {"error":"Họ tên và số điện thoại là bắt buộc"} [400] | chat (body rỗng) {"error":"Phiên trò chuyện không hợp lệ"} [400]
admin không token 401 | route không tồn tại 404 | /lalaflow/ cache-control: no-cache

qua https://stung-quantum-mongrel.ngrok-free.dev (đường của thiết bị ngoài)
lalaflow page 200 | bundle: localhost refs=0 | api health {"ok":true} | api products 55 | image 200 image/jpeg
quote [400 từ backend] | chat [400 từ backend] | tts 200 audio/wav
server.log: INFO: 113.161.61.150:0 - "POST /api/chat HTTP/1.1" 400   ← IP thật đi qua tunnel
```

Không gửi báo giá / câu chat thật khi kiểm (sẽ tạo bản ghi, có thể gửi email, và tốn lượt OpenAI) — chỉ chứng minh
request tới được backend và lỗi của backend được trả nguyên.

## Ghi chú

- `TRUST_PROXY` tin cả dải mạng nội bộ: máy trong LAN gọi thẳng :4000 có thể giả `X-Forwarded-For`. Chấp nhận cho môi
  trường dev; khi deploy thật nên thu hẹp về đúng IP proxy.
- ngrok free hiện trang cảnh báo lần đầu mở bằng trình duyệt; bấm "Visit Site" một lần.
- Backup `.env` trước khi sửa: scratchpad `lalaflow.env.bak` (không nằm trong repo).
