# 2026-10-16: Ẩn giá vốn khỏi API công khai, sửa giới hạn và lời cảm ơn của đánh giá

## Goal
Sửa các lỗi tìm thấy khi rà soát ngày 16/10 (bro đã duyệt):
- **A.** `GET /products` và `GET /products/:id` công khai trả `SELECT *`, nên lộ `cost_price` và `min_stock`. `?all=1` cho người lạ xem cả sản phẩm đã ẩn.
- **B.** Giới hạn đánh giá tính theo `req.ip`. Trong Docker, mọi khách chung IP gateway, nên khách thứ hai không đánh giá được sản phẩm khách đầu đã đánh giá.
- **D.** (tìm thấy khi test B) Đánh giá đầu tiên của một sản phẩm làm mất lời cảm ơn: form bị tạo lại và trở về trống.
- **C.** Chạy lại test mobile vì `Products.jsx`, `App.jsx`, `main.jsx` đã đổi sau lần test trước.

**Không làm:**
- duyệt đánh giá trước khi hiện; vẫn hiện ngay như chủ shop đã chọn;
- `TRUST_PROXY`; code chỉ chạy local, chưa có proxy.

## Success criteria
- **A1.** Không đăng nhập, `GET /products` không có `cost_price`/`min_stock`, chỉ có sản phẩm đang bán.
- **A2.** `GET /products?all=1` không token hoặc token giả → 401.
- **A3.** Admin đăng nhập, `?all=1` đủ cột, có sản phẩm đã ẩn. Các màn admin dùng danh sách này vẫn chạy, đơn mua vẫn tự điền giá vốn.
- **A4.** `GET /products/:id` công khai không có cột riêng; sản phẩm đã ẩn → 404.
- **B1.** Hai trình duyệt cùng IP đều đánh giá được cùng một sản phẩm.
- **B2.** Cùng trình duyệt: đánh giá lại cùng sản phẩm trong ngày → 429; quá 5 đánh giá/giờ → 429.
- **B3.** Thiếu hoặc sai `reviewerKey` → 400. Form trên trình duyệt thật gửi được.
- **D.** Đánh giá đầu tiên trên sản phẩm chưa có đánh giá: được lưu, hiện trong danh sách, và có lời cảm ơn.
- **C.** Test mobile PASS trên code hiện tại.

## Changes
**`backend/server.js`:**
- `PRIVATE_PRODUCT_FIELDS` và `publicProduct()`.
- `staffForFullCatalogue`: chỉ khi có `?all=1` mới chạy `authMiddleware`. Không gắn quyền cụ thể, vì 5 màn admin (Sản phẩm, Kho, Đơn hàng, Bán hàng, Mua hàng) đều đọc danh sách này.
- `GET /products/:id`: thêm `AND active = 1` và ẩn cột riêng.
- Đánh giá: bắt buộc `reviewerKey` (`^[A-Za-z0-9-]{8,64}$`).
  - Giới hạn theo mã khách: cùng sản phẩm 1 lần/24 giờ, tối đa 5 lần/giờ.
  - Theo IP chỉ còn chặn rộng: 30 lần/giờ.
  - `rememberReview()` thay cho `.get(req.ip).push(...)`.

**`frontend/src/pages/Products.jsx`:**
- `reviewerKey()`: UUID lưu ở `localStorage` (`lalaflow.reviewer`), có `try/catch`; bị chặn thì dùng mã tạm cho lần xem trang đó.
- **D:** `isThanked` chuyển từ `ReviewForm` lên `ProductReviews`, và reset khi đổi sản phẩm. Nguyên nhân: form được render ở `reviews-empty` hoặc `reviews-grid` tuỳ số đánh giá; đánh giá đầu tiên làm đổi khối, nên React tạo lại form.

**Thay đổi hợp đồng API:**
- `GET /products` công khai không còn `cost_price` và `min_stock`.
- `GET /products?all=1` cần token.
- `GET /products/:id` không trả sản phẩm đã ẩn.
- `POST /products/:id/reviews` bắt buộc `reviewerKey`.
- Trong repo không có client nào khác ngoài frontend này (đã grep).

## Lỗi trong chính bài test (đã sửa)
- `\d` trong template string bị mất dấu `\`; lệnh `sed` cũng làm mất `\.`, giống lỗi đã ghi ở worklog 14/10. Đổi sang `[0-9]` và `split('.')`.
- Ô giá vốn hiển thị "123.456" (định dạng VN), test so với "123456" nên báo FAIL sai.
- Dữ liệu mẫu đều có `cost_price = 0`, nên không chứng minh được việc tự điền giá vốn. Mình tạm đặt `cost_price = 123456` cho sản phẩm #1 rồi trả về 0.
- App đã chuyển từ hash URL sang `BrowserRouter` cùng service worker (`main.jsx`, 15/10 16:50, không phải thay đổi của mình). Test mobile cũ kiểm `location.hash`, nên đổi sang kiểm `pathname`. Server :8000 trả 200 cho `/lalaflow`, `/lalaflow/`, `/lalaflow/san-pham`, `/lalaflow/san-pham/10`.

## Result
**Lỗi B trên backend cũ, trước khi sửa** (cùng IP, hai khách khác nhau):
```
{"review":{"id":148,"reviewerName":"ZZTEST khach A",...}}  -> 201
{"error":"Bạn đã đánh giá sản phẩm này hôm nay, cảm ơn bạn!"}  -> 429
```

**Lỗi D trên code cũ:** lần chạy đầu `browser-check.mjs` báo `{"thanked":false,"error":"","listed":true}`.

**API** (`api-test.mjs`, backend đã build lại):
```
PASS A1 public list hides cost price and reorder level: 54 products, 0 with private fields
PASS A1 public list hides inactive products: inactive #85 listed: false
PASS A2 ?all=1 without login is refused: status 401
PASS A2 ?all=1 with a forged token is refused: status 401
PASS A3 signed-in ?all=1 keeps cost price and reorder level: 55/55 with both fields
PASS A3 signed-in ?all=1 includes the inactive product
PASS A4 public product detail hides private fields: keys: id,name,category,stock,price,status,image,description,created_at,active,unit,rating,images
PASS A4 inactive product detail is 404: status 404
restored product #85 active: 200
PASS B1 two browsers on one IP can both review the same product: A 201, B 201 
PASS B2 the same browser cannot review the same product twice a day: 429 Bạn đã đánh giá sản phẩm này hôm nay, cảm ơn bạn!
PASS B2 a browser is stopped after 5 reviews in an hour: statuses after the first: 201,201,201,201,429
PASS B3 missing or malformed reviewer key is 400: 400 Phiên đánh giá không hợp lệ, vui lòng tải lại trang | 400
ALL PASS
```

**Trình duyệt thật** (`browser-check.mjs`, giá vốn tạm của sản phẩm #1 = 123456, đã trả về 0):
```
PASS B3 first review on a product without reviews (#57) is accepted, listed and thanked: {"thanked":true,"error":"","key":"e6e38667-dc5d-458a-b7f6-431a9ba76f5c","listed":true}
PASS B3 browser stored a valid reviewer key: e6e38667-dc5d-458a-b7f6-431a9ba76f5c
PASS A3 admin products_list loads products while signed in: cards 10, product options 4
PASS A3 admin purchases_create loads products while signed in: cards 0, product options 55
PASS A3 admin inventory_transaction loads products while signed in: cards 0, product options 55
PASS A3 purchase order line is prefilled with the real cost price of #1: cost_price 123456, input values: Administrator | 1 | 123.456
PASS no console errors
ALL PASS
```

**Test mobile trên code hiện tại** (`mobile-test.mjs`):
```
PASS 390px: tab bar shows 5 tabs: Trang chủ | Sản phẩm | Trợ lý AI | Báo giá | Liên hệ
PASS 390px: floating assistant and birdhouse buttons hidden
PASS 390px: tab Sản phẩm opens /lalaflow/san-pham and is highlighted: {"path":"/lalaflow/san-pham","active":"Sản phẩm"}
PASS 390px: tab Báo giá opens /lalaflow/yeu-cau-bao-gia and is highlighted: {"path":"/lalaflow/yeu-cau-bao-gia","active":"Báo giá"}
PASS 390px: tab Trang chủ opens /lalaflow/ and is highlighted: {"path":"/lalaflow","active":"Trang chủ"}
PASS 390px: assistant tab opens a full-screen panel: {"top":0,"bottom":844,"left":0,"right":390}
PASS 390px: page behind the assistant does not scroll
PASS 390px: close button closes the assistant
PASS 390px: contact tab opens the channels above the tab bar: list bottom 770, bar top 780, https://zalo.me/0979914401 https://m.me/NghiaTran158 tel:0979914401
PASS 390px: opening the assistant closes the contact list
PASS 390px: category chips sit in one swipeable row: {"rows":1,"scrolls":true,"overflow":"auto"}
PASS 390px: no sideways page scroll: 390 <= 390
PASS 390px: search stays pinned under the header after scrolling: header bottom 80, search 88-139
PASS 390px: chip strip starts under the search with no gap: chips strip top 128, search bottom 139
PASS 390px: pinned search keeps its white pill and border: {"inside":"255,255,255","topEdge":"217,164,111","bottomEdge":"217,164,111"}
PASS 390px: nothing shows through above, below or between search and chips: rows 81-87 and 140-136 all cream
PASS 390px /: last footer link clears the tab bar: link bottom 757, bar top 780
PASS 390px /san-pham: last footer link clears the tab bar: link bottom 756, bar top 780
PASS 390px /yeu-cau-bao-gia: last footer link clears the tab bar: link bottom 757, bar top 780
PASS 390px /gioi-thieu: last footer link clears the tab bar: link bottom 756, bar top 780
PASS 360px: tab bar shows 5 tabs: Trang chủ | Sản phẩm | Trợ lý AI | Báo giá | Liên hệ
PASS 360px: floating assistant and birdhouse buttons hidden
PASS 360px: tab Sản phẩm opens /lalaflow/san-pham and is highlighted: {"path":"/lalaflow/san-pham","active":"Sản phẩm"}
PASS 360px: tab Báo giá opens /lalaflow/yeu-cau-bao-gia and is highlighted: {"path":"/lalaflow/yeu-cau-bao-gia","active":"Báo giá"}
PASS 360px: tab Trang chủ opens /lalaflow/ and is highlighted: {"path":"/lalaflow","active":"Trang chủ"}
PASS 360px: assistant tab opens a full-screen panel: {"top":0,"bottom":740,"left":0,"right":360}
PASS 360px: page behind the assistant does not scroll
PASS 360px: close button closes the assistant
PASS 360px: contact tab opens the channels above the tab bar: list bottom 666, bar top 676, https://zalo.me/0979914401 https://m.me/NghiaTran158 tel:0979914401
PASS 360px: opening the assistant closes the contact list
PASS 360px: category chips sit in one swipeable row: {"rows":1,"scrolls":true,"overflow":"auto"}
PASS 360px: no sideways page scroll: 360 <= 360
PASS 360px: search stays pinned under the header after scrolling: header bottom 80, search 88-139
PASS 360px: chip strip starts under the search with no gap: chips strip top 128, search bottom 139
PASS 360px: pinned search keeps its white pill and border: {"inside":"255,255,255","topEdge":"217,164,111","bottomEdge":"217,164,111"}
PASS 360px: nothing shows through above, below or between search and chips: rows 81-87 and 140-136 all cream
PASS 360px /: last footer link clears the tab bar: link bottom 653, bar top 676
PASS 360px /san-pham: last footer link clears the tab bar: link bottom 653, bar top 676
PASS 360px /yeu-cau-bao-gia: last footer link clears the tab bar: link bottom 653, bar top 676
PASS 360px /gioi-thieu: last footer link clears the tab bar: link bottom 653, bar top 676
PASS 701px: no tab bar, floating buttons shown
PASS 701px: assistant still opens as the floating panel: {"top":120,"bottom":720,"left":16,"right":416}
PASS 701px: birdhouse opens the contact list
PASS 1280px: no tab bar, floating buttons shown
PASS 1280px: assistant still opens as the floating panel: {"top":120,"bottom":720,"left":16,"right":416}
PASS 1280px: birdhouse opens the contact list
PASS no console errors
ALL PASS
```

**Dọn dữ liệu:**
- Xoá 18 đánh giá `ZZTEST%` do test tạo; còn lại 144 đánh giá.
- Sản phẩm #85 bật lại `active`; sản phẩm #1 trả `cost_price` về 0.
- Khởi động lại backend để xoá bộ đếm giới hạn.

Status: **DONE** cho A1–A4, B1–B3, C, D.

**Chưa kiểm:** so ảnh desktop lần này. Thay đổi frontend chỉ là state của form đánh giá, không đổi CSS.

## Follow-ups
- Khi đưa lên mạng: đặt `TRUST_PROXY`, nếu không giới hạn 30/giờ theo IP sẽ áp cho cả trang.
- `reviewerKey` chỉ giúp công bằng giữa các khách, không chống được spam: kẻ spam đổi mã tuỳ ý, và chỉ còn giới hạn 30/giờ theo IP. Nên có nút ẩn đánh giá trong admin hoặc captcha.
- Đã có service worker: khi test tay sau mỗi lần build nhớ tải lại cứng (hoặc tăng phiên bản cache), nếu không có thể thấy bản cũ.
