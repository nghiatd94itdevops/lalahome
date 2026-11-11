# 2026-10-13 — LalaFlow đợt 2: trang quản trị (khung, nội dung, sản phẩm, kho, mua hàng)

**Status:** DONE (đợt 2/3). Các mục đơn hàng, CRM, báo giá, báo cáo, nhân viên & quyền, nhật ký hiện là màn "đang sửa sang" (đợt 3).

## Goal

Làm lại trang quản trị LalaFlow theo giao diện LalaHome, giữ logic backend gốc: đăng nhập, sidebar theo quyền, chuông thông báo,
và các màn hình Nội dung website, Sản phẩm, Kho hàng, Mua hàng, Báo sai sót (kho + đơn hàng).

## Decisions

- Mỗi màn hình tự tải đúng endpoint nó cần (`useApi`), thay vì bản gốc tải toàn bộ dữ liệu lúc mở admin bất kể quyền.
- Menu ẩn mục người dùng không có quyền (bản gốc chỉ chặn ở API). Quyền dùng đúng key của backend.
- Ẩn sản phẩm / loại / hoạt động có hộp xác nhận (bản gốc bấm "Xóa" là đổi trạng thái ngay, không hỏi). Nhập kho đơn mua cũng hỏi trước vì không đảo ngược được.
- Form đăng nhập không điền sẵn tài khoản admin. Token lưu `localStorage` (`lalaflow.token`), hết hạn hoặc 401 thì tự đăng xuất.
- Thêm dependency `write-excel-file@^4.1.1` (cùng bản với source gốc) cho Xuất Excel; tải động khi bấm.
- Tab danh sách có form sửa ngay trên danh sách, để người chỉ có quyền sửa (không có quyền tạo) vẫn sửa được.

## Success criteria

| # | Tiêu chí | Kết quả |
|---|---|---|
| C1 | Đăng nhập bằng form vào `/admin/home` | PASS |
| C2 | 16 màn hình đợt 2 mở không lỗi tải dữ liệu | PASS |
| C3 | Thêm loại → thêm sản phẩm có ảnh → nhập 10 / chặn xuất quá tồn / xuất 3 → NCC → đơn mua 4 × 80.000 → nhập kho → báo sai sót → duyệt → ẩn sản phẩm | PASS, DB khớp |
| C4 | Không lỗi console, không cuộn ngang ở 390px | PASS |

Output kiểm thử (click/gõ thật qua DevTools Protocol, Edge headless):

```
PASS login via form -> #/admin/home
PASS open home … PASS open orders_list   (16/16)
PASS create category / create product + upload image / inventory import 10
PASS export over stock is blocked: Không đủ tồn kho. ZZTEST Giấy thử hiện chỉ còn 15 đơn vị.
PASS inventory export 3 / create supplier / create purchase order (tổng 320.000đ)
PASS receive purchase order: Đã nhập hàng vào kho và cập nhật giá vốn
PASS send correction request (chuông: "Thông báo, 1 việc chưa xử lý") / approve correction / hide product
INFO mobile horizontal overflow px: 0
CONSOLE ERRORS: none
```

DB sau kiểm thử: `stock 16` (= 5 + 10 − 3 + 4), `cost_price 80000`, 3 phiếu kho, đơn mua `Đã nhập kho`, ảnh lưu `/uploads/…png`, `audit_logs` ghi đủ.
Toàn bộ dữ liệu `ZZTEST`, ảnh thử và 11 dòng nhật ký do kiểm thử tạo đã xoá; còn 17 sản phẩm như trước.

## Follow-ups

- Đợt 3: đơn hàng (tạo đơn, chiết khấu, công nợ, trạng thái, hóa đơn), mã chiết khấu, dashboard, CRM, báo giá (PDF, email), yêu cầu từ website, báo cáo + Excel, nhân viên, nhóm quyền, nhật ký.
- Gửi email báo giá cần cấu hình SMTP trong `lalaflow/.env`.

## Update — admin trở lại giao diện LalaFlow cũ

Người dùng muốn trang admin giữ kiểu basic của bản cũ, không theo trang home. `admin/admin.css` viết lại theo bảng màu gốc
(`#123C31` xanh rêu, `#C6E86A` xanh chanh, nền `#F4F6F1`, thẻ trắng viền mảnh, nút vuông chữ in hoa), gói trong `.admin-theme`
nên trang khách hàng không đổi. Bỏ tranh nền ở màn đăng nhập và trang chủ admin. Font giữ Be Vietnam Pro vì DM Sans của bản cũ
trên Google Fonts không có bộ tiếng Việt. Logic không đổi.

Chạy lại toàn bộ kiểm thử e2e: tất cả PASS, `CONSOLE ERRORS: none`, overflow mobile 0px. Lỗi tìm thấy khi chụp màn hình và đã sửa:
link sidebar mất chữ do `.admin-theme a` ghi đè màu `.side-link`. Dữ liệu `ZZTEST` của lần chạy này đã xoá (còn 17 sản phẩm, 0 nhà cung cấp, 0 dòng nhật ký).
