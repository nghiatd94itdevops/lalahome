# 2026-10-15 — LalaFlow: thêm vào màn hình chính điện thoại (PWA)

**Status:** PARTIAL — giả lập đạt; chờ người dùng xác nhận trên điện thoại thật

## Goal

Khách lưu LalaFlow thành icon trên màn hình chính điện thoại. Trước đó không có manifest, icon hay service worker.

## Thay đổi (`lalaflow/frontend`)

- `public/manifest.json`: tên "LalaFlow Paper" / "LalaFlow", `start_url` + `scope` "./" (= /lalaflow/), standalone,
  icon 192/512 (512 cũng dùng làm maskable).
- `public/icons/`: icon ngôi nhà vẽ bằng SVG (`icon.svg`), xuất PNG 512/192/180 bằng Edge headless (không thêm
  dependency); chi tiết nằm trong vùng an toàn 80% cho icon bị cắt tròn.
- `public/sw.js`: service worker tối thiểu, không cache gì (tránh nội dung cũ); chỉ bắt điều hướng trang để hiện trang
  "Không có kết nối mạng" khi offline. Đăng ký trong `main.jsx`, bỏ qua khi `vite dev`.
- `index.html`: link manifest, theme-color, icon, apple-touch-icon, meta cho iOS.
- `components/InstallBanner.jsx` (dưới header, chỉ trang khách): Android/Chrome/Edge → nút "Cài đặt" gọi
  `beforeinstallprompt`; iOS Safari (không có API cài) → hướng dẫn Chia sẻ → "Thêm vào MH chính". Ẩn khi đã chạy dạng
  app, sau khi cài, hoặc khi khách bấm × (nhớ trong localStorage).

## Verification

```
qua ngrok: manifest.json 200 application/json | sw.js 200 application/javascript | icon-192/512, apple-touch-icon 200 image/png
Edge CDP trên http://localhost:8000/lalaflow/:
service worker: http://localhost:8000/lalaflow/ active=true
manifest url: http://localhost:8000/lalaflow/manifest.json | errors: []
installability errors: []
banner: Thêm LalaFlow vào màn hình chính | Mở nhanh như một ứng dụng, không cần tải từ cửa hàng. | Cài đặt | ×
build: vite ✓
```

## Ghi chú

- Icon cài trên điện thoại gắn với đúng địa chỉ lúc cài. Nếu URL ngrok đổi, icon cũ sẽ mở địa chỉ chết → phải cài lại.
- Banner cũng hiện trên Chrome/Edge máy tính (trang cài được ở đó); khách tắt bằng ×.
- Chưa thử trên iPhone/Android thật.

## Sửa: banner không hiện trên điện thoại thật

Người dùng báo không thấy banner trên điện thoại. Nguyên nhân: banner chỉ hiện khi có `beforeinstallprompt`, nhưng
Chrome Android chỉ phát sự kiện này sau khi khách đã tương tác với trang một lúc, và trình duyệt nhúng trong Zalo /
Facebook không bao giờ phát. Bản test trước dùng Edge headless máy tính — nơi sự kiện đến ngay — nên không lộ ra.

Sửa `InstallBanner.jsx`: trên điện thoại banner luôn hiện với hướng dẫn theo nền tảng (Android: menu ⋮ → Thêm vào màn
hình chính; iOS: Chia sẻ → Thêm vào MH chính; trong Zalo/Facebook/…: mở bằng trình duyệt), và đổi sang nút "Cài đặt"
khi trình duyệt đưa prompt. Máy tính chỉ hiện khi có prompt.

Kiểm bằng Edge CDP, giả lập user agent + màn hình cảm ứng, chặn `beforeinstallprompt` để mô phỏng "chưa có prompt":

```
android, no prompt yet     -> android :: Thêm LalaFlow vào màn hình chính | Bấm menu ⋮ của trình duyệt rồi chọn “Thêm vào màn hình chính” hoặc “Cài đặt ứng dụng”. | ×
iphone safari              -> ios :: Thêm LalaFlow vào màn hình chính | Bấm nút Chia sẻ ⬆︎ rồi chọn “Thêm vào MH chính”. | ×
zalo in-app                -> in-app :: Thêm LalaFlow vào màn hình chính | Bạn đang xem trong ứng dụng khác. Bấm ⋯ → “Mở bằng trình duyệt” (Chrome / Safari) để thêm vào màn hình chính. | ×
desktop, no prompt         -> NO BANNER
android, prompt offered    -> android :: Thêm LalaFlow vào màn hình chính | Mở nhanh như một ứng dụng, không cần tải từ cửa hàng. | Cài đặt | ×
```

Giả lập user agent không thay được điện thoại thật (engine vẫn là Edge máy tính).

## Sửa lần 2: Zalo trên iPhone bị nhận nhầm là Safari

Ảnh chụp người dùng gửi: iPhone, trang mở trong trình duyệt nhúng của Zalo (menu Zalo: "Gửi cho bạn bè / Mở bằng Safari").
Log server cho thấy máy đã tải bản build mới nhất (`index--qBxFHdL.js`), nên không phải cache. Banner bản trước nhận là
"ios" và bảo bấm "Chia sẻ" — nút không tồn tại trong Zalo.

Sửa: trên iOS, thiếu token `Safari/` trong user agent → coi là trình duyệt nhúng (Safari, Chrome iOS, Edge iOS đều có token
này; web view của app thì không). Hướng dẫn trình duyệt nhúng iOS: ⋯ → "Mở bằng Safari" → Chia sẻ → "Thêm vào MH chính".
Đổi khoá localStorage sang `.v2` để ai đã bấm × ở bản cũ thấy hướng dẫn mới một lần.

```
zalo ios (no app name)     -> in-app-ios :: … Bấm ⋯ ở góc trên → “Mở bằng Safari”, rồi trong Safari bấm Chia sẻ → “Thêm vào MH chính”. | ×
zalo ios (named)           -> in-app-ios :: (như trên)
chrome ios                 -> ios :: … Bấm nút Chia sẻ ⬆︎ rồi chọn “Thêm vào MH chính”. | ×
(5 trường hợp cũ không đổi)
```

Chưa xác minh user agent thật của Zalo trên máy người dùng (log uvicorn không ghi user agent).

## Bổ sung: nút tải lại trong app đã cài

Mở từ icon màn hình chính, trang chạy standalone: không thanh địa chỉ, không nút tải lại; iPhone không có kéo-để-tải-lại.
Thêm nút ↻ ở header (`Shell.jsx`, cạnh Menu), chỉ hiện khi `isStandalone()` (dùng chung với `InstallBanner`).
Cụm nút dùng cùng breakpoint 820px với `.menu-toggle` để không bị đẩy xuống dưới menu khi mở.

Kiểm bằng Edge CDP (iPhone UA, 390px). Edge không giả lập được `display-mode`, nên giả lập tín hiệu iOS
`navigator.standalone = true`:

```
browser    reload button=False install banner=True
standalone reload button=True  install banner=False
after click: marker = cleared → page reloaded | reload button still shown: True
```
