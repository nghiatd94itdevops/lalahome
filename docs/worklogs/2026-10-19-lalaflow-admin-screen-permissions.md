# 2026-10-19: Admin chỉ hiện màn khi tải được dữ liệu (nhóm 3/4 của đợt rà soát 16/10)

## Goal
Năm màn admin mở được bằng quyền thao tác, nhưng không tải được dữ liệu, vì API đầu tiên của màn cần một quyền xem khác:
- Thu tiền công nợ, Cập nhật trạng thái, Mã chiết khấu cần `orders.view`;
- Tạo đơn mua cần `suppliers.view`;
- Tạo báo giá cần `customers.view`.

Danh sách báo giá cũng gọi `/customers`. Nếu thiếu quyền, màn này lặng lẽ mất SĐT, địa chỉ và MST khi gửi mail hoặc chuyển thành đơn.

Ngoài ra, `GET /dashboard` trả 5 yêu cầu báo giá gần nhất (tên, SĐT, email khách) cho mọi người có `reports.view`, kể cả người không có `quote_requests.manage`.

**Bro chọn:** menu đòi thêm quyền xem, tức là chặt hơn. Không nới quyền ở backend.

## Success criteria
- **P1.** Với từng màn trong 5 màn: chỉ có quyền thao tác thì màn không có trong menu, và mở bằng URL thì báo "Không mở được màn hình này". Có thêm quyền xem thì màn hiện ra và tải được dữ liệu.
- **P2.** `reports.view` không kèm `quote_requests.manage`: API dashboard không có `recentRequests`, màn hình không có khung "Yêu cầu tư vấn gần đây". Có kèm thì có cả hai.
- **P3.** Không nhóm quyền hiện có nào bị mất màn.

## Changes
**`frontend/src/admin/menu.js`:**
- trường `needs`: danh sách quyền xem bắt buộc phải có đủ;
- gắn `needs` cho 6 mục: 5 màn ở trên và Danh sách báo giá.

**`frontend/src/admin/AdminApp.jsx`:** `allowed` = `perm` (có một trong các quyền) **và** có đủ mọi quyền trong `needs`. Hàm này dùng cho cả menu lẫn khi mở thẳng bằng URL.

**`backend/server.js`:**
- `hasPermission()` tách từ `requirePermission`; hành vi không đổi;
- `/dashboard` chỉ truy vấn và trả `recentRequests` khi người gọi có `quote_requests.manage`.

**`screens/Home.jsx` và `screens/Sales.jsx` (Dashboard):** khung yêu cầu gần đây chỉ hiện khi API trả về `recentRequests`.

## Result
**P3** (`menu-impact.mjs`, đối chiếu quyền thật của các nhóm trong DB với menu mới):
```
Administrator  không mất màn nào
Sales          không mất màn nào
Kho            không mất màn nào
Kế toán        không mất màn nào
Nội dung       không mất màn nào
```

**P1, P2** (`perm-ui-test.mjs`, Edge, một nhân viên thuộc nhóm ZZTEST, đổi quyền nhóm theo từng trường hợp):
```
created group 343, employee 98
PASS orders_payment with only orders.payments: hidden from the menu and refused by URL: in menu: false
PASS orders_payment with orders.payments + orders.view: listed and loads its data: in menu: true
PASS orders_status with only orders.change_status: hidden from the menu and refused by URL: in menu: false
PASS orders_status with orders.change_status + orders.view: listed and loads its data: in menu: true
PASS orders_discounts with only orders.discounts_manage: hidden from the menu and refused by URL: in menu: false
PASS orders_discounts with orders.discounts_manage + orders.view: listed and loads its data: in menu: true
PASS purchases_create with only purchases.manage: hidden from the menu and refused by URL: in menu: false
PASS purchases_create with purchases.manage + suppliers.view: listed and loads its data: in menu: true
PASS quotations_create with only quotations.manage: hidden from the menu and refused by URL: in menu: false
PASS quotations_create with quotations.manage + customers.view: listed and loads its data: in menu: true
PASS dashboard for reports.view only: no customer contacts in the API or on screen: keys orderCount,revenue,debt,lowStock,newQuoteRequests
PASS dashboard with quote_requests.manage: recent requests included and shown: recentRequests 2
PASS no console errors: none
cleanup: employee 98, group 343
ALL PASS
```
"tải được dữ liệu" nghĩa là màn hình không có chữ "Không tải được dữ liệu", là thông báo lỗi chung của `LoadState` (`ui.jsx:103`).

**Dọn dữ liệu:** xoá 1 nhân viên và 1 nhóm ZZTEST; còn lại 5 nhóm.

Status: **DONE** cho P1–P3.

## Follow-ups
- Màn Danh sách báo giá giờ đòi `customers.view`, nhưng mình không test riêng màn này (chưa có trường hợp trong bài test). Hiện không nhóm nào bị ảnh hưởng (P3).
- Khi tạo nhóm quyền mới, admin không được báo rằng "Thu tiền" cần đi kèm "Xem đơn hàng". Có thể thêm gợi ý ở màn Nhóm & phân quyền.
