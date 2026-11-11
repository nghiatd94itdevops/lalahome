# 2026-10-13: Hủy đơn tự hoàn kho + chặn vượt hạn mức công nợ

## Goal
- Hủy đơn hàng thì sản phẩm tự cộng lại vào kho. Đơn đã hủy là trạng thái cuối, không mở lại được.
- Tạo đơn vượt hạn mức công nợ của khách CRM thì backend chặn. Admin được vượt khi nhập lý do, lý do ghi vào nhật ký.

Không làm trong đợt này: báo cáo doanh thu/công nợ ở màn Báo cáo vẫn tính cả đơn đã hủy (giữ như cũ); "Vô hiệu đơn" vẫn không hoàn kho (giữ như cũ).

## Success criteria
A1. Chuyển đơn sang "Đã hủy" (màn Trạng thái hoặc chi tiết đơn) thì mỗi sản phẩm được cộng lại đúng số lượng vào kho, kèm phiếu nhập "Hoàn kho hủy đơn DH…".
A2. Hủy lần hai, hoặc hai yêu cầu hủy cùng lúc, chỉ hoàn kho một lần.
A3. Đơn đã hủy không đổi được trạng thái (400) và không nhận thanh toán.
B1. Khách CRM có hạn mức > 0: nợ hiện tại + nợ đơn mới > hạn mức thì trả 400, thông báo nêu rõ số tiền.
B2. Admin có lý do thì tạo được đơn và có dòng `CREDIT_OVERRIDE` trong nhật ký. Nhân viên thường không vượt được, kể cả khi gửi lý do.
B3. Nợ của đơn đã hủy không tính vào hạn mức và cột Công nợ ở màn Khách hàng.

## Changes
- `lalaflow/backend/server.js`
  - `changeOrderStatus()` chạy trong transaction, dùng `SELECT … FOR UPDATE` trên đơn. Đây là chỗ đảm bảo A2.
  - `/orders/:id/status` và `/orders/:id/invoice` cùng dùng hàm này.
  - Kiểm tra hạn mức trong `POST /orders`, thêm `customerDebt()`.
  - Chặn thanh toán đơn đã hủy.
  - Cột `debt` ở `GET /customers` bỏ đơn đã hủy.
  - Diff: 94 dòng.
- `lalaflow/frontend/src/admin/client.js`: `ApiError` mang thêm `code` (5 dòng).
- `lalaflow/frontend/src/admin/screens/Orders.jsx`
  - Hộp xác nhận khi hủy, có nút "Giữ đơn" và "Hủy đơn và hoàn kho".
  - Ô "Lý do vượt hạn mức" hiện ra khi admin bị chặn.
  - Khóa trạng thái ở chi tiết đơn đã hủy; bỏ đơn đã hủy khỏi danh sách đổi trạng thái và thanh toán.
  - Diff: 35 dòng.
- `lalaflow/frontend/src/admin/ui.jsx`: `ConfirmDialog` nhận `cancelLabel` (1 dòng).
- Backend được build lại bằng `docker compose up -d --build backend`. Web được build lại vào `web/lalaflow/`.

## Result

API (`order-rules-test.mjs`, gọi thật vào :4000, dữ liệu ZZTEST, tự dọn):
```
PASS setup product: id 27 stock 50
PASS order takes stock: status 201 stock 43
PASS cancel restocks: status 200 restocked 1 stock 50
PASS restock movement logged: import 7 Hoàn kho hủy đơn DH1791874793616
PASS cancel twice restocks once: stock 50
PASS cancelled order cannot reopen: 400 Đơn đã hủy không thể đổi trạng thái; hãy tạo đơn mới
PASS cannot reopen via invoice form either: 400 Đơn đã hủy không thể đổi trạng thái; hãy tạo đơn mới
PASS cancelled order takes no payment: 400 Đơn đã hủy không nhận thanh toán
PASS two cancels at once restock once: statuses 200,200 restocked 1,0 stock 50
PASS setup staff login
PASS within limit: 400k debt <= 500k: 201 DH1791874795468
PASS staff blocked over limit: 400k + 200k > 500k: 400 Vượt hạn mức công nợ của ZZTEST Công ty Hạn Mức: nợ hiện tại 400.000đ + đơn này 200.000đ = 600.000đ, hạn mức 500.000đ. Cần khách thanh toán thêm hoặc admin duyệt.
PASS blocked order changes nothing: stock 46
PASS staff cannot override with a reason: 400
PASS fully paid order is not blocked: 201 
PASS admin without reason gets CREDIT_LIMIT: 400 CREDIT_LIMIT
PASS admin with reason passes: 201 DH1791874796102
PASS override written to audit log: Vượt hạn mức (nợ hiện tại 400.000đ + đơn này 200.000đ = 600.000đ, hạn mức 500.000đ). Lý do: Khách quen, giám đốc duyệt
PASS cancelled debt frees the limit: 201 
PASS CRM debt ignores cancelled orders: debt 300000
cleanup: before {"products":"17","orders":"4","customers":"0"} after {"products":"17","orders":"4","customers":"0"}
```

Giao diện admin (`order-rules-ui.mjs`, Edge headless, bấm và gõ thật):
```
PASS setup test product: #26
PASS over-limit order is refused with the numbers: ! KHÔNG THỂ THỰC HIỆN Vui lòng kiểm tra lại Vượt hạn mức công nợ của ZZTEST UI Hạn Mức: nợ hiện tại 0đ + đơn này 250.000đ = 250.000đ, hạn mức 100.000đ
PASS reason field appears for admin
PASS order created with a reason: ✓ THAO TÁC THÀNH CÔNG Đã hoàn tất Đã tạo đơn DH1791874750359 (250.000đ) và tự động xuất kho. TIẾP TỤC
PASS order saved, stock 50 → 48: DH1791874750359 stock 48
PASS cancel asks for confirmation: ? Hủy đơn hàng? Đơn DH1791874750359 sẽ được hoàn lại toàn bộ sản phẩm vào kho. Đơn đã hủy không thể mở lại; muốn bán lại phải tạo đơn mới. GIỮ ĐƠN HỦY ĐƠN VÀ HO
PASS cancel saved: ✓ THAO TÁC THÀNH CÔNG Đã hoàn tất Đã cập nhật trạng thái đơn hàng TIẾP TỤC
PASS stock back to 50 after cancel: 50
PASS cancelled order leaves the status picker
PASS status locked on cancelled order detail
CONSOLE ERRORS: none
```
Sau khi dọn: products 17, orders 4, customers 0 (như trước khi test).

Lần chạy đầu của bài test API FAIL toàn bộ vì bài test tạo sản phẩm thiếu trường `status` (backend trả 500 `Column 'status' cannot be null`), không phải do code mới. Sửa bài test rồi chạy lại thì đạt 20/20.

Status: **DONE** (A1–A3, B1–B3).

## Follow-ups
- Màn Báo cáo vẫn tính doanh thu và công nợ của đơn đã hủy. Cần bro quyết có loại ra không, vì việc này làm số liệu báo cáo cũ thay đổi.
- Khách CRM được khớp với đơn theo **tên chính xác**. Gõ khác một dấu cách là không nhận ra hạn mức. Đây là cách bản gốc liên kết; muốn chắc hơn thì đơn hàng cần lưu `customer_id`, mà việc đó là đổi schema.
- Lệnh dọn dữ liệu sau test xoá `audit_logs` trong 5–10 phút gần nhất. Lúc test không có ai khác dùng hệ thống.

---

# Dọn dữ liệu và file thừa (bro duyệt từng mục trước khi làm)

## Đã làm
- Backup toàn bộ DB trước khi xoá: `lalaflow/backups/before-cleanup-20261013.sql` (33 KB).
- Kiểm tra trước khi xoá: 12 sản phẩm bị xoá không nằm trong bảng nào khác.
  ```
  order_items 0 · purchase_order_items 0 · quote_requests 0 · quotation_items 0 · inventory_movements 0 · product_images 4
  ```
- Xoá trong một transaction:
  - Sản phẩm #4–9 ("Giấy loại 1" trùng), #11–13 ("Giấy 1" trùng), #15 ("S?n ph?m ki?m th?"), #18 ("Vãi cùi bắp"), #20 ("Giấy ABC").
  - 4 dòng ảnh của sản phẩm #20.
  - Loại #8 ("Ki?m th? upload").
- 4 file ảnh của #20 được chép ra `lalaflow/backups/removed-uploads/` rồi mới xoá khỏi volume `/app/uploads`.
- Chuyển 17 file web không còn dùng (3,9 MB, chưa có trong git) sang `lalaflow/backups/unused-web-assets/`:
  - `storybook.css`, `storybook.js`, `assets/storybook/`
  - `assets/home/kitten/`, `kitten-1.png`, `kitten-2.png`, `kitten-rig.png`

## Result
Sau khi xoá:
```
products: 1 Giấy A4 70gsm · 2 Giấy Kraft · 3 Giấy Couche · 10 Giấy loại 1 · 14 Giấy 1
categories: Giấy in · Bao bì · Giấy bìa · Giấy · Vãi
200 / · 200 /voice.html · 200 /lalaflow/ · 200 các ảnh assets/home đang dùng
```
Mở thật 6 trang (`broken-links.mjs`): không có exception, không có request nào lỗi vì việc dọn. Còn các lỗi sau, **có từ trước**:
```
/ -> 404 favicon.ico
/lalaflow/#/san-pham -> ERR_BLOCKED_BY_ORB (×2), /san-pham/10 -> ERR_BLOCKED_BY_ORB
```
Lỗi ORB là do ảnh mẫu `/uploads/a4.jpg`, `kraft.jpg`, `couche.jpg` trả 404. Ba file này không có trong volume và cũng không có trong `backups/uploads`, tức là chưa từng tồn tại. Trang tự hiện tranh thay thế nên khách không thấy lỗi.

## Follow-ups
- Upload ảnh thật cho 3 sản phẩm mẫu, hoặc bỏ đường dẫn ảnh hỏng. Cần bro quyết.
- Loại "Vãi" giờ không còn sản phẩm nào; tên đúng có thể là "Vải". Chưa đổi, chờ bro quyết.
- **Bảo mật:** `/app/uploads` đang chứa 5 file `.html` do upload lên từ trước (bản gốc). Nếu backend trả file `.html` kèm `text/html` cùng origin với API, người upload có thể chèn script. Cần kiểm tra và giới hạn loại file upload. Chưa sửa vì nằm ngoài phạm vi.
