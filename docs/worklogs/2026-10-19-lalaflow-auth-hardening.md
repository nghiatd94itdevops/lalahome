# 2026-10-19: Bảo mật đăng nhập LalaFlow (nhóm 1/4 của đợt rà soát 16/10)

## Goal
Sửa các lỗi xác thực mà đợt rà soát 16/10 tìm ra. Bro đã duyệt cả 4 nhóm; nhóm này đụng vào xác thực.
1. **JWT secret đang là chuỗi mặc định nằm trong repo:** `docker-compose.yml` có `lalaflow-dev-secret-change-me`, còn code có fallback `lalaflow-secret`. Ai biết chuỗi này cũng tự ký được token admin. Đã xác nhận container đang chạy dùng giá trị mặc định của compose.
2. **Token giữ nguyên quyền trong 8 giờ:** `authMiddleware` chỉ `jwt.verify` rồi tin `role`/`permissions` trong token. Nhân viên bị khóa vẫn dùng được, quyền bị thu vẫn còn hiệu lực, quyền mới cấp thì bị 403.
3. **Đăng nhập không giới hạn số lần sai;** mật khẩu không phải chuỗi làm bcrypt văng lỗi 500.
4. **Upload lấy đuôi file từ tên client gửi:** lưu được `x.html` khai là `image/png`, rồi phục vụ thành `text/html` (stored XSS trên :4000). File bị từ chối vẫn nằm lại trên đĩa.

**Không làm trong nhóm này:**
- bắt đổi mật khẩu admin mặc định (đây là tính năng mới);
- CORS;
- `err.message` lộ ra ngoài;
- quyền xem dashboard (nhóm 3).

## Success criteria
- **S1.** Backend từ chối khởi động khi `JWT_SECRET` thiếu, là chuỗi mặc định đã công khai, hoặc ngắn hơn 32 ký tự; với secret ngẫu nhiên thì chạy.
- **S2.** Token ký bằng secret mặc định cũ → 401.
- **S3.** Nhân viên hoặc nhóm bị khóa → 401 ở request kế tiếp; cấp hoặc thu quyền có hiệu lực ngay, không cần đăng nhập lại.
- **S4.** Sai 5 lần một tài khoản trong 15 phút → 429, kể cả khi sau đó nhập đúng; tài khoản khác cùng IP vẫn đăng nhập được. Thiếu mật khẩu hoặc mật khẩu không phải chuỗi → 400.
- **S5.** HTML khai `image/png` được lưu `.png`, phục vụ `image/png` kèm `nosniff`. Upload bị từ chối (sản phẩm không tồn tại, vượt 5 ảnh) không để lại file.
- **S6.** Đăng nhập admin qua form thật; các màn admin vẫn tải được.

## Changes
**`backend/server.js`:**
- `PUBLISHED_JWT_SECRETS` và `MIN_JWT_SECRET_LENGTH`: secret không hợp lệ thì `process.exit(1)` kèm thông báo.
- `authMiddleware` chuyển sang async. Mỗi request đọc lại user và nhóm từ DB: user không còn hoặc bị khóa → 401; nhóm bị khóa → 401. Role và quyền lấy từ DB qua `publicUser()`. DB lỗi → 503. Chế độ không có DB (`data.json`) giữ cách cũ.
- `/auth/login`:
  - kiểm `email`/`password` là chuỗi;
  - đếm lần sai theo tài khoản (5 lần/15 phút) và theo IP (30 lần/15 phút), lưu trong bộ nhớ;
  - đăng nhập đúng thì xoá bộ đếm của tài khoản;
  - kiểm "tài khoản đã khóa" và "nhóm ngừng hoạt động" **sau** khi kiểm mật khẩu, để người không biết mật khẩu không dò được trạng thái tài khoản.
- Upload:
  - `IMAGE_EXTENSIONS` quyết định cả loại được nhận lẫn đuôi file lưu;
  - `/uploads` có header `X-Content-Type-Options: nosniff`;
  - `discardUploads()` xoá file khi trả 404 (sản phẩm không tồn tại, có kiểm mới), 400 (vượt 5 ảnh) hoặc 500.

**Cấu hình:**
- `docker-compose.yml`: `JWT_SECRET: ${JWT_SECRET:-}`, bỏ giá trị mặc định công khai.
- `.env.example`: `JWT_SECRET=` để trống, kèm lệnh tạo secret.
- `lalaflow/.env` (nằm trong `.gitignore`): thêm `JWT_SECRET` ngẫu nhiên 64 ký tự (48 byte base64url). Mình chỉ ghi thêm vào cuối file, không đọc hay in các dòng khác.

**Ảnh hưởng:**
- Token cũ mất hiệu lực, mọi người phải đăng nhập lại một lần.
- Mỗi request có xác thực thêm một truy vấn `users JOIN permission_groups` theo khoá chính.

**Đánh đổi:** khóa theo tài khoản cho phép người khác cố tình gõ sai để khóa admin trong 15 phút. Mình chấp nhận, vì nó nhẹ hơn rủi ro dò mật khẩu mặc định. Bộ đếm nằm trong bộ nhớ nên khởi động lại backend là xoá.

## Result
**S1:** chạy image backend với từng giá trị secret:
```
JWT_SECRET="" -> exit 1
JWT_SECRET="lalaflow-dev-secret-change-me" -> exit 1
JWT_SECRET="lalaflow-secret" -> exit 1
JWT_SECRET="short-secret-123" -> exit 1
$ docker run --rm -e JWT_SECRET=lalaflow-dev-secret-change-me <image> node server.js
JWT_SECRET must be a random string of at least 32 characters (set it in lalaflow/.env); refusing to start.
exit 1
$ docker run ... -e JWT_SECRET=<48 byte ngẫu nhiên> -e PORT=4999 <image> sh -c 'timeout 5 node server.js'
Backend running on port 4000
node exit 143        (do timeout dừng, tức là đã chạy bình thường)
```

**S2–S5** (`auth-test.mjs`, backend đã build lại với secret mới):
```
PASS S2 admin token forged with "lalaflow-dev-secret-change-me" is refused: status 401
PASS S2 admin token forged with "lalaflow-secret" is refused: status 401
created group 322, employee 92
PASS S3 employee logs in: status 200
PASS S3 starts with reports.view only: dashboard 200, orders 403
PASS S3 a granted permission works on the same token, no re-login: orders 200
PASS S3 a revoked permission stops working on the same token: dashboard 403
PASS S3 deactivating the group cuts its members off: dashboard 401 Nhóm quyền đã ngừng hoạt động, vui lòng đăng nhập lại
PASS S3 a locked employee is cut off on the next request: before lock 200, after lock 401 Tài khoản không còn hoạt động, vui lòng đăng nhập lại
PASS S4 missing or non-string password is 400, not 500: 400, 400
created employee 93
PASS S4 after 5 wrong passwords the account is locked, even with the right one: wrong 401,401,401,401,401, then right password 429
PASS S4 another account on the same IP can still log in: admin 200
PASS S5 an HTML file sent as image/png is stored as .png: status 200, path /uploads/1792394790099-200002232.png
PASS S5 it is served as an image with nosniff: image/png, nosniff=nosniff
removed test image 61 from product 85: 200
PASS S5 upload to a product that does not exist is 404: status 404 Sản phẩm không tồn tại
PASS S5 refused uploads leave no file on disk: uploads dir 60 -> 60
PASS S5 upload past 5 images is refused (product 85 has 1): status 400 Mỗi sản phẩm chỉ được tối đa 5 hình ảnh
cleanup: employees 92,93 group 322
ALL PASS
```

**S6** (`admin-login.mjs`, Edge, đăng nhập qua form):
```
PASS S6 admin form login stores a token: token parts 3
PASS S6 admin products_list loads after login: 2274 chars of content
PASS S6 admin orders_list loads after login: 1713 chars of content
PASS S6 admin employees_manage loads after login: 1742 chars of content
PASS S6 no console errors: none
ALL PASS
```

**Hồi quy:** chạy lại `api-test.mjs` (giá vốn và đánh giá, worklog 16/10) → `ALL PASS`.

**Dọn dữ liệu:**
- Xoá 4 nhân viên `zztest-*@lalaflow.test`, 2 nhóm `ZZTEST nhom*` và 6 đánh giá `ZZTEST`. Trước khi xoá đã kiểm: không có user thật nào thuộc nhóm ZZTEST.
- Giữ nguyên audit log.
- Khởi động lại backend để xoá bộ đếm.

**Ghi chú môi trường:** server :8000 (uvicorn, phục vụ web và giọng nói) đã tắt sau khi máy khởi động lại. Mình bật lại bằng đúng lệnh trong README để test giao diện.

Status: **DONE** cho S1–S6.

## Follow-ups
- Mật khẩu `admin@lalaflow.vn` / `Admin123!` vẫn là mặc định, và không có gì bắt đổi. Nên đổi ngay hoặc thêm tính năng bắt đổi ở lần đăng nhập đầu.
- Server ghi đè `group_id` của mọi admin ở mỗi lần khởi động (`UPDATE users SET group_id=... WHERE role='admin'`). Chưa sửa.
- Còn lại từ đợt rà soát: CORS `*`, `err.message` trả ra ngoài, endpoint gửi email báo giá cho phép nội dung tuỳ ý.
- `DELETE /products/:productId/images/:imageId` chỉ xoá dòng trong DB, không xoá file trên đĩa. Ba lần chạy test để lại 3 file `.png` (nội dung HTML thử). Mình đã kiểm không có dòng DB nào trỏ tới chúng rồi mới xoá tay. Ảnh do admin xoá thật cũng sẽ nằm lại trên đĩa như vậy.
