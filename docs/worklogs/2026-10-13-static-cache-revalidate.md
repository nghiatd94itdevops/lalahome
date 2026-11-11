# 2026-10-13 — speech-service: trang tĩnh không cập nhật khi chuyển trang

**Status:** PARTIAL — sửa và kiểm bằng HTTP xong; người dùng cần xác nhận trên trình duyệt

## Vấn đề

Chuyển trang (LalaHome `/` → cửa `lalaflow/` → "Về nhà") hiện bản cũ hoặc trang trắng, phải bấm Reload.

Nguyên nhân: `StaticFiles` trả `ETag` + `Last-Modified` nhưng không có `Cache-Control`, nên trình duyệt tự đoán thời hạn
"còn mới" (heuristic, ~10% tuổi file) và dùng cache không hỏi server khi điều hướng; Reload mới buộc kiểm lại.
Với `lalaflow/` (Vite build, JS có hash trong tên) `index.html` cũ trỏ tới JS đã bị build lại → trang trắng.

Không phải lỗi router: `lalaflow` dùng `HashRouter` của react-router-dom, deep link `/lalaflow/#/san-pham` trả 200.

## Thay đổi

`speech-service/app/main.py`: `RevalidatingStaticFiles` thêm `Cache-Control: no-cache` cho mọi file tĩnh — vẫn cache,
nhưng mỗi lần mở phải hỏi lại bằng ETag (file không đổi → 304).

## Success criteria

| # | Tiêu chí | Kết quả |
|---|---|---|
| C1 | Mọi file tĩnh có `Cache-Control: no-cache` | PASS |
| C2 | File không đổi → hỏi lại bằng ETag nhận 304 | PASS |
| C3 | File vừa đổi → ETag cũ nhận 200 với nội dung mới | PASS |
| C4 | Trên trình duyệt: chuyển trang không cần Reload | Người dùng kiểm |

```
/                                      HTTP/1.1 200 OK cache-control: no-cache
/lalaflow/                             HTTP/1.1 200 OK cache-control: no-cache
/lalaflow/assets/index-BPfS8i5w.js     HTTP/1.1 200 OK cache-control: no-cache
/voice.html                            HTTP/1.1 200 OK cache-control: no-cache
revalidate unchanged lalaflow/ with ETag "39266c68d7b620c1c842f15de28ed5b2" -> 304
old ETag after file change -> v2-changed (200)
server-8001.log: 0 error/traceback
```

## Ghi chú

- Bản đã nằm trong cache trình duyệt từ trước vẫn theo luật cũ cho tới khi hết hạn: cần Ctrl+F5 một lần.
- Server cũ ở cổng 8000 chưa được khởi động lại nên chưa có bản sửa.
- `web/` (LalaHome, lalaflow) và `lalaflow/` không phải do worklog này tạo; chỉ đọc, không sửa.
