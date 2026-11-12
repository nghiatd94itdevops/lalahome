# 2026-11-12 — Kích thước cuộn và đơn vị sản phẩm

**Status:** DONE (kiểm bằng Chrome headless ở 1280 và 390px; chưa xem trên máy thật)

## Goal

Lưu kích thước cuộn (khổ × dài) thành cột riêng thay vì chỉ nằm trong mô tả, rồi hiện nó cùng diện tích mỗi cuộn trên
thẻ sản phẩm, kệ Trợ lý AI và trang chi tiết. Điền sẵn cho sản phẩm mẫu: lấy từ mô tả nếu có, không có thì dùng số
giả định (người dùng đồng ý vì đây là dữ liệu test).

Không làm: ô nhập kích thước trong admin, cho chat Mimi đọc cột mới, sản phẩm bán theo tấm/ram.

## Success criteria

1. Backend khởi động có thêm `roll_width_cm`, `roll_length_m` (được để trống); số sản phẩm không đổi.
2. `sample_products.py sizes` sao lưu bảng, rồi: vải dán tường (#61–85) 132 cm × 50 m lấy từ mô tả; giấy dán tường
   (#36–60) 106 cm × 15,6 m giả định, đơn vị "cuộn", mô tả có ghi "giả định để test"; giấy thường để trống.
3. Thẻ, kệ và trang chi tiết hiện "132 cm × 50 m · 66 m²/cuộn"; sản phẩm không có kích thước không hiện gì thêm.
4. Build qua; ở 390 và 1280px không có phần tử mới bị cắt.

## Thay đổi

- `backend/server.js`: hai `ALTER TABLE products ADD COLUMN IF NOT EXISTS` (DECIMAL, NULL). `SELECT *` đã trả về
  sẵn; `PUT /products/:id` không đụng tới hai cột nên sửa sản phẩm trong admin không xoá kích thước.
- `scripts/sample_products.py`: lệnh `sizes`. Khổ ghi dạng khoảng thì lấy số nhỏ, để số cuộn tính ra làm tròn lên.
- `components/Cards.jsx`: `rollSize()` và `<RollSize>`, dùng trong `ProductCard`.
- `pages/Assistant.jsx` (ShelfCard), `pages/Products.jsx` (dòng "Kích thước", "Diện tích" trong bảng thông số).
- `styles.css`: `.roll-size`.

## Result

```
docker compose up -d --build backend
roll_width_cm	decimal(6,1)	YES		NULL
roll_length_m	decimal(6,2)	YES		NULL
COUNT(*) 55   (trước: 55)

python scripts/sample_products.py sizes
backup: lalaflow/backups/before-sample-import-20261112.sql   (chép thêm: before-sample-sizes-20261112.sql)
assumed  106 cm x 15.6 m  × 25 (Giấy dán tường)
parsed   132 cm x 50 m    × 25 (Vải dán tường)

category        unit    roll_width_cm  roll_length_m  n
Bao bì          đơn vị  NULL           NULL           1
Giấy            đơn vị  NULL           NULL           2
Giấy bìa        đơn vị  NULL           NULL           1
Giấy dán tường  cuộn    106.0          15.60          25
Giấy in         đơn vị  NULL           NULL           1
Vải dán tường   cuộn    132.0          50.00          25
#36 mô tả: "... Kích thước cuộn: 106 cm x 15,6 m (giả định để test)."

npm run build: ✓ built in 1.21s

size_check.mjs
PASS 1280 /san-pham/61  spec {"Kích thước":"132 cm × 50 m","Diện tích":"66 m²/cuộn"} cut 0
PASS 1280 /san-pham/36  spec {"Kích thước":"106 cm × 15,6 m","Diện tích":"16,54 m²/cuộn"} cut 0
PASS 1280 /san-pham/1   spec {"Kích thước":null,"Diện tích":null}
PASS 1280 /san-pham     count 50 cut 0
PASS 390  (cùng 4 trang như trên)
PASS 1280 /tro-ly shelf  {"count":3,"first":"132 cm × 50 m · 66 m²/cuộn","cut":0}
all checks passed

layout_audit.mjs (8 trang × 5 bề ngang): 38/40 sạch; còn 2 chỗ cố ý có từ trước
  390 /san-pham     dải chip vuốt ngang
  390 /tro-ly#chat  ảnh sản phẩm cắt khung vuông
  roll-size: 0 lỗi
```

## Để sau

- 2 sản phẩm "Xốp dán tường giả gạch" thực tế bán theo tấm, nhưng vẫn bị gán kích thước cuộn giả định.
- Admin chưa có ô nhập khổ/dài; sản phẩm mới chỉ điền được bằng SQL.
- Chat Mimi vẫn đọc kích thước từ mô tả, chưa đọc cột mới. Giấy dán tường vẫn khớp vì ghi chú giả định đã nằm trong mô tả.
- Chạy `sizes` lần hai sẽ ghi đè `before-sample-import-20261112.sql` (lệnh dùng chung tên file sao lưu); bản trước khi
  sửa đã chép sang `before-sample-sizes-20261112.sql`.
- `import` không ghi kích thước; sau khi import lại phải chạy `sizes`.
