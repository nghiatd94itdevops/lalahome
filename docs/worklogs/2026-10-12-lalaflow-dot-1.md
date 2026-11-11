# 2026-10-12 — LalaFlow đợt 1: backend + trang khách hàng theo giao diện LalaHome

**Status:** DONE (đợt 1/3). Trang quản trị (đợt 2–3) chưa làm; `/admin` hiện là trang báo "đang sửa sang".

## Goal

Đưa LalaFlow (source `LalaFlowv4.rar`) vào cùng hệ thống LalaHome: bấm cửa / biển Welcome ở `http://localhost:8000/`
vào trang khách hàng LalaFlow, đủ tính năng phía khách, giao diện làm lại theo phong cách trang home (chỉ giữ logic).

Không làm ở đợt này: các màn hình admin, sửa logic nghiệp vụ backend ngoài lỗi đã duyệt.

## Decisions (người dùng đã duyệt)

- Giữ backend Express + MariaDB gốc, chạy Docker (`lalaflow/docker-compose.yml`, project `lalaflow`, cổng 4000; DB không publish cổng).
- Sửa lỗi gốc: admin seed đổi sang `INSERT IGNORE` nên mật khẩu admin không còn bị reset về `Admin123!` mỗi lần khởi động;
  nút "Nhận tư vấn" mở form báo giá với sản phẩm chọn sẵn thay vì gọi số cứng `0909123456`;
  "Sản phẩm cùng danh mục" lọc đúng danh mục (bù bằng sản phẩm khác nếu thiếu); `JWT_SECRET` lấy từ env.
- Dữ liệu: khôi phục `backups/lalaflow-full.sql` (SHA256 khớp) và ảnh `backend_uploads` vào volume.
- Frontend mới: React + Vite (cùng dependency gốc, bỏ three/fontsource/write-excel-file chưa dùng), HashRouter, build ra `web/lalaflow/`
  để FastAPI :8000 phục vụ. Ảnh nền các trang là `web/assets/home/cover-baked.jpg` (ảnh tĩnh của trang home, đã có biển LALAHOME).
- Trang home: link cửa đổi từ `voice.html` sang `lalaflow/`. Trang giọng nói vẫn ở `/voice.html`.

## Success criteria

| # | Tiêu chí | Kết quả |
|---|---|---|
| C1 | Bấm cửa/Welcome trên trang home vào trang khách hàng | PASS — `href="lalaflow/"`, `/lalaflow/` 200 |
| C2 | Đủ 7 trang khách: chủ, giới thiệu, thông tin, hoạt động, sản phẩm (tìm + lọc), chi tiết (bộ ảnh), báo giá | PASS — ảnh chụp 1440px |
| C3 | Dữ liệu lấy từ backend | PASS — 17 sản phẩm, nội dung công ty từ `/site-content` |
| C4 | Gửi báo giá ghi vào `quote_requests`, báo thành công | PASS — xem bên dưới; 2 dòng thử đã xoá |
| C5 | Không cuộn ngang ở 390/768/1440px | PASS — overflow 0px |

```
preselected product: Giấy ABC
popup: ✓ THAO TÁC THÀNH CÔNG Đã hoàn tất Yêu cầu đã được gửi. Nhân viên LalaFlow sẽ liên hệ sớm.
id  customer_name            phone       product_id product_name status message
1   Khách kiểm thử LalaHome  0900000001  20         Giấy  ABC    Mới    Kiểm tra form đợt 1
/ horizontal overflow px: 0
/san-pham/20 horizontal overflow px: 0
/yeu-cau-bao-gia horizontal overflow px: 0
/thong-tin horizontal overflow px: 0   (768px)
```

## Vận hành

```powershell
cd lalaflow
docker compose up -d            # MariaDB + backend :4000
cd frontend; npm install; npm run build   # build lại vào web/lalaflow
```

## Follow-ups

- Dữ liệu trong backup có tên lỗi mã hoá ("Ki?m th? upload", "S?n ph?m ki?m th?") và 3 sản phẩm trỏ ảnh `/uploads/a4.jpg`… không tồn tại
  (giao diện hiện nhãn danh mục thay ảnh vỡ). Sửa trong admin ở đợt 2.
- Font Baloo 2 / Be Vietnam Pro tải từ Google Fonts.
- Đợt 2: admin nội dung, sản phẩm, kho, mua hàng. Đợt 3: đơn hàng, CRM, báo giá PDF/email, báo cáo, Excel, nhân viên & quyền, nhật ký.

## Fix 2026-10-13 — trang trắng ("treo") khi chuyển sang trang khác

- Triệu chứng: từ trang chủ khách hàng bấm Giới thiệu / Hoạt động / … thì trang trắng (DOM còn 25 node, không có `h1`).
  Console: `TypeError: c is not a function` trong `commitHookEffectListUnmount` của React.
- Nguyên nhân: `ScrollToTop` viết `useEffect(() => window.scrollTo({ top: 0 }), …)`. Trên Edge 155 `window.scrollTo` trả về
  `Promise` (đã kiểm: `{"type":"object","ctor":"Promise"}`), React lưu nó làm hàm cleanup và gọi khi đổi trang → lỗi, cả cây bị gỡ.
  Đợt 1 không phát hiện vì các ảnh chụp đều tải thẳng từng URL, không chuyển trang trong ứng dụng.
- Sửa: bọc ngoặc nhọn cho cả 4 effect dạng biểu thức (`App.jsx`, `Shell.jsx`, `pages/Products.jsx`, `admin/ui.jsx`).

```
in-app nav /gioi-thieu   {"h1":"Từ những tờ giấy, tạo nên giá trị dài lâu","nodes":186}
in-app nav /hoat-dong    {"h1":"Những chuyển động từ LalaFlow","nodes":165}
… /thong-tin /san-pham /yeu-cau-bao-gia /san-pham/20 đều có h1
real clicks: 6/6 trang mở đúng, longTasks [], no console output
```

## Update 2026-10-13 — trau chuốt giao diện trang khách hàng

Soát bằng ảnh chụp toàn trang (1440px và 390px) rồi sửa:
- Thẻ sản phẩm: bỏ nghiêng, cao bằng nhau, ảnh `object-fit: contain` trên nền trắng (ảnh scan không bị cắt), sản phẩm chưa có ảnh dùng hình minh hoạ
  chồng giấy + tên loại thay khối màu trơn, giá + "Chi tiết" thẳng hàng ở đáy thẻ, nhãn trạng thái lên góc ảnh.
- Trang chủ: hiện 4 sản phẩm (đủ 1 hàng), khung chữ banner thu gọn về góc dưới để lộ ngôi nhà, thêm dải tin cậy (hotline, giờ làm việc, giao hàng, báo giá).
- Danh mục: sắp xếp (Mới nhất / Giá tăng / Giá giảm / Tên A–Z), số lượng trên từng nút loại, "Chỉ hàng có sẵn", nút "Xóa bộ lọc" khi không có kết quả.
- Thẻ hoạt động, bảng số liệu, thẻ giá trị: bỏ nghiêng; hoạt động chưa có ảnh hiện chuyên mục trên nền lá.
- Chữ: nội dung 17px, menu / nút lọc / nhãn dùng Be Vietnam Pro, Baloo 2 chỉ cho tiêu đề và giá.
- Điện thoại: lưới sản phẩm 2 cột, dải tin cậy 1 cột.

Kiểm tra: chuyển trang trong ứng dụng 7/7 trang có `h1`, overflow ngang 0px ở 390px.
