# 2026-10-14 — LalaFlow: 50 sản phẩm mẫu nội bộ từ 2 cửa hàng WooCommerce

**Status:** DONE (dữ liệu test nội bộ — phải gỡ trước khi go-live)

## Goal

Danh mục LalaFlow gần như trống (5 sản phẩm). Thêm 50 sản phẩm mẫu để test danh sách, lọc, phân trang, ảnh.
Nguồn: giaydantuongcnc.com và caroyal.com.vn qua WooCommerce Store API công khai (`/wp-json/wc/store/v1`);
`robots.txt` của cả hai không chặn đường dẫn này.

Quyết định của người dùng: dữ liệu mẫu nội bộ, 25 sản phẩm mỗi nguồn, tải 1 ảnh mỗi sản phẩm.

## Cách làm — `lalaflow/scripts/sample_products.py`

- `fetch`: lấy sản phẩm (giaydantuongcnc: chỉ loại có giá), chọn rải theo danh mục con, làm sạch mô tả
  (bỏ số điện thoại, URL, dòng liên hệ, tên thương hiệu CAROYAL / CNC WALLPAPER), tên có tiền tố `[Mẫu]`,
  mô tả kết thúc bằng ghi chú nguồn. Ảnh: 1 ảnh/sản phẩm, bản ≤ 1024 px.
- `import`: dump `products`, `product_images`, `product_categories` ra `backups/before-sample-import-20261014.sql`,
  copy ảnh vào volume uploads của backend, ghi trong 1 transaction (chuỗi scrape đi vào SQL dạng hex literal), ghi
  `backups/sample-products/manifest.json`.
- `remove`: xoá đúng các id, ảnh và danh mục mới trong manifest.

Giá trị gán (không bịa số liệu): tồn kho 0; giaydantuongcnc giữ giá thật, trạng thái "Có sẵn"; caroyal không công
khai giá và ghi "Hàng Đặt Trước" → giá 0, trạng thái "Đang nhập". Danh mục mới: "Giấy dán tường", "Vải dán tường".

## Verification

```
fetch : giaydantuongcnc.com 97 usable, picked 25 | caroyal.com.vn 100 usable, picked 25 | 50 ảnh, 7.4M
audit : phones in body/name: 0 | brand in body/name: 0 | junk bodies: 0 | distinct name stems: 19
import: backup before-sample-import-20261014.sql (5 sản phẩm gốc);
        imported 50 products, created categories ['Giấy dán tường', 'Vải dán tường']
API   : API total=55 samples=50 originals=5 | mojibake: 0 | images not served: 0 / 50
        categories: Bao bì 1, Giấy 2, Giấy bìa 1, Giấy dán tường 25, Giấy in 1, Vãi 0, Vải dán tường 25
```

## Ghi chú

- Backend được khởi động lại lúc 13:59 ngay sau khi import (RestartCount=0, exit=0 — khởi động lại chủ động,
  không phải crash; `docker compose cp` không gây restart). Dữ liệu và ảnh còn đủ sau đó.
- Phần caroyal nghiêng về dòng vải Vinyl PVC vì top 100 sản phẩm phổ biến của họ chủ yếu là dòng này.
- ~~Sản phẩm caroyal hiển thị giá 0đ trên storefront.~~ Đã xử lý bằng giá giả định (xem phần bổ sung).
- `backups/` đã nằm trong `.gitignore`: ảnh, manifest, backup không vào git; manifest chỉ có trên máy này.
- Ảnh, tên mã và thông số là của hai cửa hàng nguồn — không đưa lên trang thật.

## Bổ sung (cùng ngày): ô sản phẩm đồng bộ, giá không 0đ, đánh giá mẫu

**Ô sản phẩm (frontend `styles.css`):** khung ảnh cố định 4:3, ảnh `position: absolute` + `object-fit: cover` (trước:
`contain` + padding, và ảnh dọc kéo giãn khung vì `aspect-ratio` chỉ là chiều cao tối thiểu khi nội dung tràn); danh mục 1
dòng, tên 2 dòng, dòng sao 1 dòng (luôn có, kể cả "Chưa có đánh giá"), mô tả 2 dòng, giá 1 dòng. Đánh đổi: ảnh khác 4:3 bị cắt mép.

**Giá:** `sample_products.py reprice` — 25 sản phẩm caroyal nhận giá giả định theo dòng (MS 850.000đ, R 1.100.000đ,
ULTRA 1.450.000đ / cuộn), mô tả thêm "Giá giả định để test." Kết quả: `zero_price_active = 0`; chạy lại → `repriced 0`.

**Đánh giá (đã duyệt thêm bảng):**
- Backend: bảng `product_reviews` (tạo lúc khởi động như các bảng khác; chỉ `approved` được công khai, `is_sample` đánh dấu dữ
  liệu sinh); `rating {average, count}` trong `GET /products` và `GET /products/:id`; `GET /products/:id/reviews`.
- Frontend: `RatingStars`, `RatingSummary` trên ô sản phẩm; trang chi tiết có điểm trung bình, phân bố sao, danh sách, nhãn "Đánh giá mẫu".
- `sample_products.py reviews`: 143 đánh giá cho 41/50 sản phẩm mẫu (9 sản phẩm không có, để test trạng thái trống), seed theo id,
  chặn chạy trùng; `remove` xoá cả đánh giá.
- Chưa có form cho khách gửi đánh giá, chưa có màn admin duyệt. `database/schema.sql` (bản dump) chưa có bảng mới.

```
reviews: added 143 sample reviews across 50 sample products | rerun: "143 sample reviews already exist"
API    : samples=50 with reviews=41 without=9 originals_rated=0 | avg range 2 - 5 | zero price: 0
build  : vite ✓ built; ảnh chụp Edge headless trang danh sách 1280/820/390 px và trang chi tiết đã kiểm bằng mắt
```

Ảnh caroyal có watermark "CAROYAL" in trên mặt sản phẩm.

## Bổ sung 2026-10-15: khách gửi đánh giá

Người dùng báo: có phần xem đánh giá nhưng khách không gửi được; sản phẩm chưa có đánh giá thì không làm gì được.
Quyết định của người dùng: đánh giá **hiện ngay**, không chờ duyệt.

- Backend `POST /products/:id/reviews` {reviewerName 2–60 ký tự, rating 1–5, comment ≤ 1000}: sản phẩm phải tồn tại và
  đang bán; lưu `status='approved', is_sample=0`; trả review vừa tạo + điểm trung bình mới. Chống spam bằng giới hạn
  theo IP trong bộ nhớ (1 đánh giá / sản phẩm / 24 giờ, tối đa 5 đánh giá / giờ) — dựa vào `TRUST_PROXY` để thấy IP thật;
  khởi động lại backend thì giới hạn reset.
- Frontend: `ReviewForm` (chọn sao có nhãn "Rất tệ…Tuyệt vời", tên, nhận xét), hiện cả khi chưa có đánh giá và cạnh ô
  điểm khi đã có; gửi xong review hiện ngay đầu danh sách, sao ở đầu trang và ô điểm cập nhật theo kết quả server.

```
target product 82 rating before: {'average': 0, 'count': 0}
no stars           -> (400, {'error': 'Vui lòng chọn số sao từ 1 đến 5'})
name too short     -> (400, {'error': 'Tên cần từ 2 đến 60 ký tự'})
6 stars            -> (400, {'error': 'Vui lòng chọn số sao từ 1 đến 5'})
comment too long   -> (400, {'error': 'Nhận xét tối đa 1000 ký tự'})
unknown product    -> (404, {'error': 'Sản phẩm không tồn tại'})
valid              -> 201 {... 'rating': {'average': 4, 'count': 1}}
same product again -> (429, {'error': 'Bạn đã đánh giá sản phẩm này hôm nay, cảm ơn bạn!'})
rating after: {'average': 4, 'count': 1} | listed: [('Khách thử nghiệm', 4, False)]
cleanup: deleted 1 | left_for_82 0
```

Chưa có màn admin để xoá đánh giá xấu; hiện chỉ xoá được bằng SQL. `remove` của script mẫu chỉ xoá đánh giá trên
sản phẩm mẫu — đánh giá thật của khách trên sản phẩm mẫu cũng bị xoá theo khi gỡ sản phẩm.
