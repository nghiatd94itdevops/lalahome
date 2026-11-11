# 2026-10-15: Trang khách LalaFlow kiểu app trên điện thoại (bước 1/3)

## Goal
Vào bằng điện thoại thì trang khách có giao diện kiểu app.

**Bro đã chọn:**
- nhận biết điện thoại theo bề rộng màn hình (≤ 700px), không theo User-Agent;
- thanh tab dưới đáy;
- danh sách sản phẩm kiểu app;
- trợ lý AI toàn màn hình;
- cài lên màn hình chính;
- làm cho cả trang khách lẫn admin.

**Chia làm 3 PR nối tiếp** (một thay đổi logic mỗi PR):
1. *Worklog này:* trang khách: thanh tab, danh sách sản phẩm, trợ lý toàn màn hình.
2. Cài lên màn hình chính (manifest và icon).
3. Admin trên điện thoại.

**Không làm trong bước này:** trang chi tiết sản phẩm, chế độ offline, admin.

## Success criteria
Kiểm bằng Edge headless, có giả lập cảm ứng, ở cỡ 390×844 và 360×740, so với 701px và 1280×800.
1. Trên điện thoại, thanh tab hiện đủ 5 tab; nút nổi trợ lý và nút nhà chim bị ẩn. Ở 701px và 1280px thì ngược lại.
2. Tab Trang chủ, Sản phẩm, Báo giá chuyển đúng trang và sáng đúng tab. Tab Trợ lý mở khung chat phủ kín màn hình, nút đóng hoạt động. Tab Liên hệ mở danh sách kênh liên hệ nằm trên thanh tab.
3. Trang Sản phẩm: các chip nằm trên một hàng và vuốt ngang được; trang không bị cuộn ngang; khi cuộn, ô tìm kiếm và dải chip vẫn dính dưới header, và không có nội dung nào lọt qua khe.
4. Link cuối cùng của footer nằm hoàn toàn phía trên thanh tab.
5. Desktop không đổi (đã sửa tiêu chí, xem bên dưới).
6. `vite build` chạy thành công; không có lỗi console.

**Sửa tiêu chí 5, trước khi viết code:**
- Bản gốc: "ảnh 1280px trước/sau giống từng pixel".
- Lý do sai: chụp bản code cũ hai lần, trang sản phẩm đã lệch 48.266 pixel, tối đa 12/255. Đây là nhiễu giải mã ảnh JPEG, không liên quan tới code.
- Tiêu chí mới: cùng kích thước trang, và 0 pixel lệch quá 16/255.

## Changes
- **`components/Shell.jsx`:**
  - `PHONE_QUERY`: breakpoint dùng chung.
  - `contactChannels()`: tách ra để thanh tab biết có kênh liên hệ hay không.
  - `ContactChannels` nhận `open` và `onOpenChange` từ ngoài.
  - Component mới `TabBar` có 5 tab, icon SVG nội tuyến. Tab Liên hệ chỉ hiện khi có kênh liên hệ.
- **`App.jsx`:**
  - Trạng thái `chatOpen` và `contactOpen` chuyển lên `Site`. Mở cái này thì đóng cái kia; đổi trang thì đóng Liên hệ.
  - Render `TabBar`.
- **`components/ChatAssistant.jsx`:**
  - Mở/đóng do component cha điều khiển (`open`, `onOpenChange`).
  - Dừng mic và tiếng đọc trong một effect theo `open`, để cả khi đóng từ thanh tab cũng dừng.
  - `closeOnSmallScreen` dùng `PHONE_QUERY` thay cho 600px.
- **`pages/Products.jsx`:** bọc các chip vào `.chip-scroll`. Trên desktop phần bọc là `display: contents`, nên bố cục không đổi.
- **`styles.css`:**
  - Biến `--tabbar-h` và `--phone-header-h` (đo được 79,6px).
  - Một khối `@media (max-width: 700px)`: thanh tab; ẩn nút nổi; danh sách Liên hệ nằm trên thanh tab; footer chừa chỗ cho thanh tab; khung chat `inset: 0` và khóa cuộn trang phía sau bằng `body:has(.chat-panel)`.
  - Trang Sản phẩm trên điện thoại: thanh công cụ dùng `display: contents`, nên ô tìm kiếm và dải chip dính riêng, còn ô sắp xếp và "Chỉ hàng có sẵn" cuộn đi.
  - Xoá khối chat `max-width: 600px` cũ, vì khối 700px đã thay thế.

**Đổi hành vi ở cỡ 601–700px:** trước đây chat là khung nổi, giờ là toàn màn hình và có thanh tab.

## Lỗi gặp và cách sửa
1. **Khe 3px giữa ô tìm kiếm và dải chip:** chữ "Đang nhập" của thẻ sản phẩm lọt qua. Sửa: cho dải chip bắt đầu ngay dưới ô tìm kiếm, nằm sau nó.
2. **Viền nền bằng `box-shadow` đi theo dáng bo tròn:** hai góc ô tìm kiếm để lộ thẻ trắng (255,253,248 ở x=25 và x=365). Sửa: dùng lớp `::before` hình chữ nhật, cộng thêm 2px vì vị trí absolute tính từ mép trong của viền.
3. **Lỗi hồi quy do chính lần sửa 2:** `::before` có `z-index: -1` được vẽ đè lên nền của ô tìm kiếm, nên ô mất nền trắng và mất viền. Bộ test lúc đó vẫn PASS; mình chỉ thấy khi xem ảnh chụp. Sửa: vẽ lại viên thuốc trắng bằng `::after`, và thêm bài test màu pixel cho nền và viền.

**Lỗi trong chính bài test:**
- Bài "không có gì lọt qua khe" ban đầu dùng `elementFromPoint`. Cách này sai, vì `box-shadow` chỉ được vẽ, không chặn hit-test. Đổi sang đọc màu pixel trên ảnh chụp.
- Dải "140-136" trong output là khoảng rỗng, vì dải chip đã nằm sau ô tìm kiếm. Khe đó được chứng minh bằng bài "chip strip starts under the search with no gap".

## Result
`mobile-test.mjs` (Edge headless qua DevTools protocol, không thêm thư viện):
```
PASS 390px: tab bar shows 5 tabs: Trang chủ | Sản phẩm | Trợ lý AI | Báo giá | Liên hệ
PASS 390px: floating assistant and birdhouse buttons hidden
PASS 390px: tab Sản phẩm opens #/san-pham and is highlighted: {"hash":"#/san-pham","active":"Sản phẩm"}
PASS 390px: tab Báo giá opens #/yeu-cau-bao-gia and is highlighted: {"hash":"#/yeu-cau-bao-gia","active":"Báo giá"}
PASS 390px: tab Trang chủ opens #/ and is highlighted: {"hash":"#/","active":"Trang chủ"}
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
PASS 390px #/: last footer link clears the tab bar: link bottom 757, bar top 780
PASS 390px #/san-pham: last footer link clears the tab bar: link bottom 756, bar top 780
PASS 390px #/yeu-cau-bao-gia: last footer link clears the tab bar: link bottom 757, bar top 780
PASS 390px #/gioi-thieu: last footer link clears the tab bar: link bottom 756, bar top 780
PASS 360px: tab bar shows 5 tabs: Trang chủ | Sản phẩm | Trợ lý AI | Báo giá | Liên hệ
PASS 360px: floating assistant and birdhouse buttons hidden
PASS 360px: tab Sản phẩm opens #/san-pham and is highlighted: {"hash":"#/san-pham","active":"Sản phẩm"}
PASS 360px: tab Báo giá opens #/yeu-cau-bao-gia and is highlighted: {"hash":"#/yeu-cau-bao-gia","active":"Báo giá"}
PASS 360px: tab Trang chủ opens #/ and is highlighted: {"hash":"#/","active":"Trang chủ"}
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
PASS 360px #/: last footer link clears the tab bar: link bottom 653, bar top 676
PASS 360px #/san-pham: last footer link clears the tab bar: link bottom 653, bar top 676
PASS 360px #/yeu-cau-bao-gia: last footer link clears the tab bar: link bottom 653, bar top 676
PASS 360px #/gioi-thieu: last footer link clears the tab bar: link bottom 653, bar top 676
PASS 701px: no tab bar, floating buttons shown
PASS 701px: assistant still opens as the floating panel: {"top":120,"bottom":720,"left":16,"right":416}
PASS 701px: birdhouse opens the contact list
PASS 1280px: no tab bar, floating buttons shown
PASS 1280px: assistant still opens as the floating panel: {"top":120,"bottom":720,"left":16,"right":416}
PASS 1280px: birdhouse opens the contact list
PASS no console errors
ALL PASS
```

Desktop 1280px, chụp toàn trang, animation đóng băng (`pixel-diff.mjs`, TOLERANCE=16):
```
before-home.png vs after-home.png: {"sameSize":true,"size":[1280,3778],"differing":0,"maxDelta":0,"box":null}
before-products.png vs after-products.png: {"sameSize":true,"size":[1280,7739],"differing":0,"maxDelta":12,"box":null}
before-quote.png vs after-quote.png: {"sameSize":true,"size":[1280,1734],"differing":0,"maxDelta":0,"box":null}
```
Mức nhiễu đo trên bản cũ (chụp hai lần, chưa sửa code): `before-products vs before2-products: differing 48266, maxDelta 12`.

Build:
```
../../web/lalaflow/assets/index-C2EAyYR-.css   62.79 kB │ gzip:  12.77 kB
../../web/lalaflow/assets/index-C3QjQ4I_.js   351.02 kB │ gzip: 105.73 kB
✓ built in 1.45s
```

Status: **DONE** cho tiêu chí 1–6, trong giới hạn Edge giả lập.

**Chưa kiểm:**
- điện thoại thật: iPhone (vùng "tai thỏ", bàn phím iOS đè lên ô nhập chat) và Android thật;
- trình đọc màn hình đi qua các phần tử `display: contents`. Chromium hiện giữ role, trình duyệt cũ thì có thể mất.

## Follow-ups
- Bước 2 (cài lên màn hình chính) và bước 3 (admin) chờ bro duyệt để mở PR riêng.
- `--phone-header-h` là số đo tay (80px). Đổi header thì phải đo lại, nếu không ô tìm kiếm sẽ dính lệch.
- `HouseIcon` trong header và icon tab Trang chủ cùng một hình vẽ nhưng khai báo hai lần. Nên gộp ở một PR dọn dẹp, không làm chung PR này.
- Trang chi tiết sản phẩm chưa có nút "Báo giá" dính đáy kiểu app.
