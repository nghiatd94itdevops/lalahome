# 2026-10-13 — LalaFlow đợt 3: đơn hàng, CRM, báo giá, báo cáo, hệ thống

**Status:** DONE (đợt 3/3). Gửi email báo giá chưa thử gửi thật vì máy chưa cấu hình SMTP (đã thử đường báo lỗi khi thiếu SMTP).

## Goal

Hoàn tất 15 màn hình admin còn lại theo giao diện LalaFlow cũ, giữ logic backend: tạo đơn (trừ kho, chiết khấu, công nợ), danh sách & chi tiết đơn,
thu công nợ, trạng thái đơn, mã chiết khấu, dashboard, CRM, tạo/danh sách báo giá (PDF, email, chuyển thành đơn), yêu cầu từ website,
báo cáo + Excel, nhân viên, gán nhóm, nhóm & phân quyền, nhật ký.

## Decisions

- Chuyển dữ liệu giữa màn hình bằng `admin/drafts.js` (yêu cầu website → báo giá, báo giá → đơn hàng, yêu cầu → form email).
- Xem trước chiết khấu trên form đơn mô phỏng đúng quy tắc `POST /orders` (mã ưu tiên hơn % nhập tay, trần `max_discount_amount`, không vượt tiền hàng);
  cảnh báo trước nếu mã chưa đến ngày / hết hạn / hết lượt / chưa đạt đơn tối thiểu. Ngày của mã chiết khấu dùng `type=date` (bản cũ là ô chữ).
- Chi tiết đơn mở ngay trên danh sách (kèm lịch sử thanh toán); admin có nút vô hiệu / khôi phục đơn (`PATCH /orders/:id/active`).
- Màn nhân viên: quyền thực tế lấy từ nhóm (backend bỏ qua quyền riêng của user), nên form chọn vai trò + nhóm và hiện cây quyền của nhóm ở chế độ chỉ xem.
  Gán nhóm không cho chọn "Chưa thuộc nhóm" vì `PATCH /employees/:id/group` không chấp nhận nhóm rỗng.
- Thêm `ErrorBoundary` cho trang khách hàng và admin: lỗi hiển thị sẽ hiện thông báo + nút tải lại thay vì trang trắng.

## Backend bug fixed (cần người dùng biết)

`POST /orders/:id/payments` không bao giờ chuyển đơn sang "Đã thanh toán": `SET paid_amount=…, debt_amount=debt_amount-?, status=IF(debt_amount-?=0, …)`
— MariaDB gán từ trái sang phải nên lúc tính `status` thì `debt_amount` đã bị trừ. Sửa: gán `status=IF(debt_amount=?, …)` đầu tiên.
Rebuild container backend. Kiểm tra lại qua API:

```
order 201 DH1791858360950 total 125000 debt 125000
after partial 25000: 200 Đơn mới debt 100000
after paying the rest: 200 Đã thanh toán debt 0 paid 125000
```

Dữ liệu cũ: chỉ `DH001` có nợ 0 mà không ở "Đã thanh toán", trạng thái của nó là "Hoàn thành" (hợp lệ) nên không sửa.

## Success criteria / Result

Kiểm thử e2e click/gõ thật (Edge headless + DevTools Protocol), dữ liệu tiền tố `ZZTEST`:

```
PASS open … 15/15 màn hình (không còn màn "đang phát triển")
PASS order preview 500k − 10% = 450k, debt 250k
PASS create order / order saved in DB: total 450000 debt 250000 code ZZTEST10 / stock 50 → 46
PASS update order status via detail / payment above debt is blocked / collect remaining debt
FAIL order fully paid: Đang giao, debt 0          ← lỗi backend ở trên, đã sửa và kiểm lại PASS
PASS create CRM customer / public quote request / request auto-matched to CRM by phone/email (Tìm thấy 1)
PASS quotation prefilled from request / create quotation: subtotal 750000 total 712500 / request linked: Đã báo giá
PASS quotation PDF: 200 application/pdf 22556 bytes (tiếng Việt hiển thị đúng)
PASS send email without SMTP reports the reason: Chưa cấu hình SMTP…
PASS quotation → order prefill / reports metrics / export report workbook
PASS create permission group (2 quyền) / create employee / assign employee to group
PASS employee logs in with group permissions ["orders.view","customers.view"] / employee blocked from inventory: 403
PASS staff menu only shows permitted items / audit log lists actions
CONSOLE ERRORS: none
```

Đã xoá toàn bộ dữ liệu thử và 14 dòng nhật ký trong khung giờ thử. Sau dọn: 17 sản phẩm, 4 đơn, 0 khách CRM, 2 tài khoản, 5 nhóm, 1 mã chiết khấu (như trước).

## Follow-ups

- Cấu hình SMTP trong `lalaflow/.env` rồi `docker compose up -d --build backend` để gửi email báo giá thật.
- PDF báo giá (layout gốc) xuống dòng ở khối tổng tiền vì cột bên phải hẹp — chỉ là thẩm mỹ, chưa sửa.
- Credit limit khách hàng chỉ hiển thị cảnh báo "Vượt hạn mức", backend không chặn tạo đơn (giữ như bản gốc).
- Hủy đơn không hoàn tồn kho (giữ như bản gốc); màn trạng thái có ghi chú nhắc nhập kho lại.

---

# Cập nhật 2026-10-13: responsive trang khách hàng + admin

## Goal
Trang LalaFlow (khách hàng và admin) co giãn theo màn hình và zoom trình duyệt, không cuộn ngang, không che/mất thông tin, dễ chạm trên điện thoại. Không đổi logic, không thêm dependency.

## Success criteria
1. `overflowX = 0` và không phần tử nào tràn khỏi màn hình ở 360/414/768/1024/1440 px, 16 trang (7 khách hàng + 9 admin).
2. Không còn chữ < 12px.
3. Trên màn ≤ 800px không còn nút/link/ô nhập cao < 40px (trừ ô trong bảng).
4. 360px: hero thấy biển LALAHOME và cửa, không bị khung chữ che. Zoom 200% (720×450) và 300% (480×300): khung chữ không che cửa.
5. Điều hướng trong app vẫn chạy, không lỗi console.

## Changes
- `lalaflow/frontend/src/styles.css`
  - Hero: trên màn ≤ 600px hoặc thấp (≤ 520px, ngang), tranh thành dải phía trên, khung chữ nằm dưới.
  - Nút "Liên hệ": trên màn ≤ 820px chỉ còn icon nhà chim, nhãn ẩn nhưng trình đọc màn hình vẫn đọc được. Footer chừa chỗ để nút không che phần cuối trang.
  - Kích thước tối thiểu: Menu, chip lọc, link footer/breadcrumb/điện thoại ≥ 40–44px; chữ pill và seal ≥ 12px.
- `lalaflow/frontend/src/admin/admin.css`
  - Mọi `font-size` .62–.74rem → .75rem (12px).
  - Trên màn ≤ 900px: menu, nút, icon-button, input, select ≥ 42px.
  - Giữ nguyên giao diện admin cũ.
- Bản build `web/lalaflow/` được tạo lại bằng `npm run build`.

Diff: styles.css 32 dòng, admin.css 39 dòng.

## Result (đã chạy, Edge headless + DevTools Protocol, `responsive-audit.mjs`)

Lần 1 (trước khi sửa): overflowX 0 ở mọi nơi, nhưng có các lỗi sau:
- chữ 10.9–11.5px: pill, label admin;
- nút < 40px trên điện thoại: Menu 36px, chip 33px, ô tìm 30px, link footer 18–28px, nút admin 34px;
- khung chữ ở hero che gần hết tranh ở 360px và che cửa khi zoom 200%;
- nút "Liên hệ" che nội dung.

Lần cuối:
```
ok rows: 80 / 80
zoom 720x450 /            overflowX 0 sticking 0 tiny 0
zoom 720x450 /san-pham    overflowX 0 sticking 0 tiny 0
zoom 480x300 /            overflowX 0 sticking 0 tiny 0
zoom 480x300 /san-pham    overflowX 0 sticking 0 tiny 0
/ small links: []
/thong-tin small links: []
```

Điều hướng (`nav-hang.mjs`):
```
Giới thiệu / Hoạt động / Thông tin / Sản phẩm / Yêu cầu báo giá: click->answer ~1.55s, longTasks [], h1 đúng từng trang
no console output
```

Kiểm tra bằng mắt: ảnh chụp ở 360px và zoom 200%/300%. Tranh thấy biển LALAHOME và cửa, khung chữ nằm dưới tranh.

Status: **DONE** cho 5 tiêu chí trên.

## Follow-ups
- Màn ≤ 820px: nút nhà chim vẫn nổi đè lên nội dung khi cuộn. Đây là bản chất của nút nổi, đã thu nhỏ còn 54px.
- Đã đo thêm 21 màn admin còn lại (nội dung, loại SP, kho, mua hàng, thanh toán/trạng thái/chiết khấu/sai sót đơn, dashboard, khách hàng, báo giá, nhân viên, nhóm, nhật ký) × 5 khổ: `ok rows: 105 / 105`.
