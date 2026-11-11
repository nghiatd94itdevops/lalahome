# 2026-11-11 — Chuẩn hoá source LalaHome để chuẩn bị deploy

**Status:** DONE

## Goal

Thư mục `WorkFlow_Voice_Text_Services` chỉ còn source phục vụ LalaHome, gọn để deploy. Chỉ thao tác bên trong thư mục này.
Thư mục chưa nằm trong git (0 file được track) → mục không dùng được chuyển vào `_archive/2026-11-11/` thay vì xoá.

## Thay đổi (đã duyệt)

- Chuyển vào `_archive/2026-11-11/`: `2_Chuyen_dong/`, `feed-kit/`, `web/voice.html`, `web/app.js`, `LaLaHome/*.bak`,
  `logs/storybook-*` (báo cáo, ảnh QA), `logs/feedback.jsonl`. Ghi chú lý do ở `_archive/2026-11-11/README.md`.
- Xoá (tự sinh lại): `logs/storybook-browser/`, `logs/storybook-qa-browser/` (profile trình duyệt QA), `logs/*.log`,
  `__pycache__/`, `feed-kit/node_modules/`, `feed-kit/demo/.next/` (cache build — không có trong danh sách đã duyệt, đã báo người dùng),
  `feed-kit/demo-dev.log`.
- Giữ `LaLaHome/` (frontend import `mimi-svg.js`, `mimi-bot.js`) và `web/pcm-worklet.js` (thu âm cho trợ lý).
- `eval/` → `speech-service/tests/`; `feedback_report.py` dùng `parents[2]` để vẫn trỏ `logs/` ở gốc.
- `README.md` gốc viết lại cho LalaHome (sơ đồ, cấu trúc, chạy, cấu hình, việc trước khi deploy, kiểm tra).
- `.gitignore`: thêm `_archive/`, `.env`, `*.bak`. `scripts/pack_source.py`: bỏ qua `_archive`, sửa ghi chú junction.
  `lalaflow/README.md`: bỏ nhắc tới `feed-kit`.

Không đụng: `lalaflow/.env`, `lalaflow/backups/`, `models/`, `docs/`, mọi thứ ngoài thư mục, container `feed-kit-pg`.

## Verification

```
2_Chuyen_dong: 44 file trước = 44 file trong _archive | feed-kit: 575 → 99 (476 file là demo/.next đã xoá)
logs: 128M → 8.0K | pycache left: 0 | .bak left (ngoài _archive): 0
frontend build: ✓ 159 modules transformed, built in 1.29s (Mimi import từ LaLaHome/ vẫn chạy)
backend: {"ok":true}
cover page assets: 11 assets referenced, 0 missing
/ /lalaflow/ /lalaflow/san-pham /lalaflow/san-pham/1 /lalaflow/admin /api/health /api/products /pcm-worklet.js
/robots.txt /sitemap.xml /llms.txt /lalaflow/manifest.json /lalaflow/sw.js → 200
/voice.html /app.js → 404 (đã lưu trữ, đúng dự kiến)
crawler: <title>Giấy A4 70gsm | Lala Home, canonical …/lalaflow/san-pham/1
speech-service/tests/protocol_checks.py: 16/16 checks passed
ảnh chụp /lalaflow/: trang hiện đầy đủ, Mimi trên nút Trợ lý AI
```
