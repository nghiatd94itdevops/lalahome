# 2026-10-19: Đơn hàng, kho, tiền (nhóm 2/4 của đợt rà soát 16/10)

## Goal
Sửa các lỗi nghiệp vụ mà đợt rà soát 16/10 tìm ra. Bro đã duyệt; nhóm này đụng tới thanh toán.

**Không làm** (ghi ở Follow-ups):
- trả lượt dùng mã giảm giá khi huỷ đơn: chưa có quy tắc;
- mã đơn `DH${Date.now()}` có thể trùng nếu tạo trong cùng một mili giây;
- báo giá dùng `unitPrice || giá niêm yết`;
- tạo khách từ yêu cầu báo giá không nằm trong transaction.

**Giữ nguyên:** đơn mua vẫn đi thẳng được từ "Nháp" sang "Đã nhập kho", vì worklog không có quy tắc nào bắt phải "Đã duyệt" trước.

## Success criteria
- **O1.** Cùng một sản phẩm trên nhiều dòng: tổng số lượng vượt tồn → 400; tổng vừa đủ → 201, tồn trừ đúng tổng.
- **O2.** Tạo đơn ở trạng thái "Đã hủy" hoặc trạng thái lạ → 400. "Đã thanh toán" khi còn nợ → 400.
- **O3.** Đơn giá âm → 400; số lượng lẻ → 400; đơn giá 0 ghi rõ → dòng tặng, tổng tiền 0.
- **O4.** Mã giảm giá có ngày, so theo giờ Việt Nam: còn hạn → áp dụng; chưa tới ngày → "chưa đến ngày"; quá hạn → "hết hạn".
- **O5.** Nhiều lần thu đủ nợ cùng lúc: chỉ một lần được nhận, nợ không âm.
- **O6.** Nhiều lần xuất kho cùng lúc không làm tồn âm; số lượng lẻ → 400.
- **O7.** Sửa phiếu kho: loại phiếu hoặc số lượng sai → 400. Huỷ phiếu nhập 10 thì trừ lại 10. Phiếu do đơn hàng hoặc đơn mua sinh ra → 400.
- **O8.** Đơn mua đã huỷ không nhập kho được.
- **O9.** Công nợ trên dashboard không tính đơn đã huỷ.
- **UI.** Form Tạo đơn: ô đơn giá bị xoá trống thì bị chặn kèm thông báo; nhập giá thì đơn được tạo đúng giá đó.

## Changes
**`backend/server.js`:**
- **Helper mới:**
  - `PAID` và `SHOP_TIME_ZONE`;
  - `shopToday()`: ngày hiện tại theo giờ Việt Nam;
  - `dateOnly()`: driver trả cột DATE thành đối tượng `Date`; `String(date)` ra "Thu Oct 15" nên không so sánh được với "YYYY-MM-DD";
  - `isWholeQuantity` và `isMoneyAmount`.
- **`POST /orders`:**
  - kiểm `status` (cấm "Đã hủy" và trạng thái lạ);
  - `takenByProduct` cộng dồn số lượng theo sản phẩm trước khi so với tồn;
  - số lượng phải là số nguyên; đơn giá phải là số ≥ 0; chỉ dùng giá niêm yết khi không gửi đơn giá (0 nghĩa là tặng);
  - không cho "Đã thanh toán" khi còn nợ;
  - khoá dòng khách hàng (`FOR UPDATE`) khi kiểm hạn mức công nợ;
  - kiểm ngày của mã giảm giá bằng `dateOnly()` và `shopToday()`.
- **`POST /orders/:id/payments`:** chạy trong transaction, khoá đơn bằng `SELECT … FOR UPDATE`; tách mã lỗi 404/400.
- **`POST /inventory`:** chạy trong transaction, khoá sản phẩm; số lượng phải là số nguyên.
- **`PUT /inventory/:id`:**
  - kiểm loại phiếu và số lượng;
  - tác động cũ chỉ được gỡ nếu phiếu cũ còn hiệu lực, tác động mới chỉ áp nếu phiếu vẫn còn hiệu lực;
  - chặn phiếu có ghi chú `Bán hàng ` / `Hoàn kho hủy đơn ` / `Nhập từ đơn mua `. Không màn nào gọi endpoint này, và bước duyệt sai sót chỉ đổi trạng thái yêu cầu.
- **`PATCH /purchase-orders/:id/status`:** "Đã hủy" là trạng thái cuối.
- **`PUT /discount-codes/:id`:** kiểm `discountType`.
- **`GET /dashboard`:** công nợ chỉ tính đơn chưa huỷ.

**`frontend/src/admin/screens/Orders.jsx`:** chặn gửi đơn khi ô đơn giá trống. Lý do: form gửi `Number("" || 0)` = 0. Trước đây backend lặng lẽ thay bằng giá niêm yết, trong khi màn hình hiện thành tiền 0; giờ backend tin số 0, nên ô trống sẽ thành hàng tặng.

## Result
**Backend cũ** (chỉ có bản sửa nhóm 1), `orders-test.mjs`:
```
FAIL O1 two lines of one product beyond stock are refused: 201 , stock now -10
FAIL O1 two lines that fit together are accepted: 400, stock -10
FAIL O2 an order cannot be created cancelled: 201 , stock 8
FAIL O2 an unknown status is refused: 201
FAIL O2 "Đã thanh toán" with debt is refused: 201 
FAIL O3 a negative unit price is refused: 201 
FAIL O3 a fractional quantity is refused: 201
FAIL O3 an explicit unit price of 0 is a free line: 201 total 100000
FAIL O4 a code valid from yesterday to tomorrow applies: 400 Mã chiết khấu chưa đến ngày sử dụng
PASS O4 a code starting tomorrow is refused: 400 Mã chiết khấu chưa đến ngày sử dụng
FAIL O4 a code that ended yesterday is refused: 400 Mã chiết khấu chưa đến ngày sử dụng
PASS O5 six simultaneous full payments: only one is taken: statuses 200,400,400,400,400,400, paid 100000, debt 0
FAIL O6 four simultaneous exports of 10 from 15: only one goes through: statuses 201,201,201,201, stock -25
FAIL O6 a fractional stock movement is refused: 201 , stock 19
FAIL O7 an unknown type or non-numeric quantity is refused: 200, 400, stock 49
FAIL O7 voiding an import of 10 takes the 10 back out: 200, stock 60
FAIL O7 a movement written by an order cannot be edited: 200 
FAIL O8 a cancelled purchase order cannot be received: 200 , stock 67
FAIL O9 a cancelled order adds nothing to dashboard debt: before 20786600, after 20886600 (cancelled order debt 100000)
fixtures: products 94,95,96,98,97, supplier 3, po MH1792395075635
17 FAILED
```

**Backend mới:**
```
PASS O1 two lines of one product beyond stock are refused: 400 Tồn kho ZZTEST sp 1792395098310-93qs không đủ (còn 50, đơn cần 60), stock now 50
PASS O1 two lines that fit together are accepted: 201, stock 10
PASS O2 an order cannot be created cancelled: 400 Trạng thái đơn hàng mới không hợp lệ, stock 10
PASS O2 an unknown status is refused: 400
PASS O2 "Đã thanh toán" with debt is refused: 400 Đơn còn nợ không thể tạo ở trạng thái "Đã thanh toán"
PASS O3 a negative unit price is refused: 400 Đơn giá của ZZTEST sp 1792395098310-gjqd không hợp lệ
PASS O3 a fractional quantity is refused: 400
PASS O3 an explicit unit price of 0 is a free line: 201 total 0
PASS O4 a code valid from yesterday to tomorrow applies: 201 discount 10000
PASS O4 a code starting tomorrow is refused: 400 Mã chiết khấu chưa đến ngày sử dụng
PASS O4 a code that ended yesterday is refused: 400 Mã chiết khấu đã hết hạn
PASS O5 six simultaneous full payments: only one is taken: statuses 200,400,400,400,400,400, paid 100000, debt 0
PASS O6 four simultaneous exports of 10 from 15: only one goes through: statuses 201,400,400,400, stock 5
PASS O6 a fractional stock movement is refused: 400 Dữ liệu nhập/xuất kho không hợp lệ (số lượng phải là số nguyên từ 1), stock 20
PASS O7 an unknown type or non-numeric quantity is refused: 400, 400, stock 60
PASS O7 voiding an import of 10 takes the 10 back out: 200, stock 50
PASS O7 a movement written by an order cannot be edited: 400 Phiếu kho sinh từ đơn hàng hoặc đơn mua, hãy điều chỉnh trên chứng từ gốc
PASS O8 a cancelled purchase order cannot be received: 400 Đơn mua đã hủy không thể đổi trạng thái; hãy tạo đơn mua mới, stock 50
PASS O9 a cancelled order adds nothing to dashboard debt: before 24476600, after 24476600 (cancelled order debt 100000)
fixtures: products 99,100,101,103,102, supplier 4, po MH1792395099502
ALL PASS
```

**Giới hạn của O5:** bài này PASS cả trên code cũ, vì 6 lần thu tiền cùng lúc không làm lộ race. Như vậy nó chỉ chứng minh luồng thu tiền mới vẫn đúng, **chưa chứng minh** được bản sửa race. Bản sửa dựa trên `FOR UPDATE`, cùng cơ chế đã khiến O6 chuyển từ `201,201,201,201 → -25` sang `201,400,400,400 → 5`.

**UI** (`order-ui-test.mjs`, Edge):
```
PASS cleared unit price is stopped with a message, nothing sold: "! KHÔNG THỂ THỰC HIỆN Vui lòng kiểm tra lại Nhập đơn giá cho ZZTEST sp 1792395098310-umdy ", stock 50 -> 50
PASS a filled unit price creates the order at that price: "✓ THAO TÁC THÀNH CÔNG Đã hoàn tất Đã tạo đơn DH1792395176630", total 120000, stock 50 -> 49
PASS no console errors: none
ALL PASS
```

**Dọn dữ liệu** (đếm trước khi xoá; không có đơn thật nào chứa sản phẩm thử, và ngược lại):
- 14 sản phẩm `ZZTEST sp`;
- 23 đơn, 28 dòng hàng, 3 lần thu tiền;
- 42 phiếu kho;
- 9 mã giảm giá;
- 2 nhà cung cấp, 2 đơn mua.

Sau khi dọn: 0 dòng mồ côi, 55 sản phẩm đang bán (như trước). Backend đã khởi động lại.

Status: **DONE** cho O1–O4 và O6–O9; **PARTIAL** cho O5 (sửa xong, nhưng chưa tái hiện được race trên code cũ).

## Follow-ups
- Hạn mức công nợ khi hai đơn cùng lúc: đã khoá dòng khách, chưa test chạy song song. Khách không có trong CRM thì không có hạn mức, nên không ảnh hưởng.
- Doanh thu trên dashboard và báo cáo vẫn tính cả đơn đã huỷ. Worklog chỉ miễn cho màn Báo cáo; cần bro quyết.
- Huỷ đơn không trả lượt dùng mã giảm giá.
- Mã chứng từ dựa trên `Date.now()`.
- Báo giá dùng `||` cho đơn giá.
