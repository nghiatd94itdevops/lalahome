# 2026-10-15 — LalaHome/LalaFlow: hiệu năng (Đợt 1) và SEO cho Google + AI (Đợt 2)

**Status:** PARTIAL — Đợt 2 (SEO) DONE; Đợt 1 xong gzip/cache, phần ảnh người dùng chọn bỏ qua

## Audit ban đầu (Edge CDP, 390px, giả lập 4G chậm: 150 ms, 1.6 Mbps, không cache)

```
== /lalaflow/  requests=26 transferred=1907 KB  LCP=10476ms DIV cover-baked.jpg  {"domContentLoaded":2607}
   by type: Image 1255KB, Script 358KB, Font 160KB, Stylesheet 66KB, Fetch 54KB
   555 KB cover-baked.jpg | 358 KB index.js enc=- | 215/175/160/143 KB ảnh sản phẩm | 64 KB css enc=- | 49 KB /api/products enc=-
```

SEO / AI:
- Bot không chạy JS (GPTBot, ClaudeBot, PerplexityBot) nhận HTML chỉ 13 ký tự chữ (`<div id="root">`).
- HashRouter: `/#/san-pham/85` — Google bỏ phần sau `#` → cả site là 1 URL; canonical trong `seo.js` cũng dùng `/#/`.
- Title, meta, Open Graph, JSON-LD chỉ được chèn bằng JS.
- `/robots.txt`, `/sitemap.xml`, `/llms.txt` đều 404. Site chạy trên domain ngrok tạm.
- 50 sản phẩm `[Mẫu]` (ảnh watermark CAROYAL) không được để bị index.

Quyết định người dùng: Đợt 1 (hiệu năng) rồi Đợt 2 (SEO); duyệt đổi sang URL thật cho Đợt 2; hỏi lại về chất lượng
ảnh trước khi duyệt Pillow.

## Đợt 1a — gzip + cache (đã làm, không thêm dependency)

`speech-service/app/main.py`: `GZipMiddleware` (Starlette có sẵn; mức 6; mặc định bỏ qua ảnh/âm thanh); file build
có hash `lalaflow/assets/*-xxxxxxxx.js|css` → `public, max-age=31536000, immutable`; mọi file khác giữ `no-cache`.

```
/lalaflow/                         no-cache            gzip     587 bytes
/lalaflow/assets/index-…js         max-age=31536000, immutable  gzip  107587 bytes (gốc 365821)
/lalaflow/assets/index-…css        max-age=31536000, immutable  gzip   13262 bytes
/api/products                      (backend headers)   gzip      3423 bytes (gốc ~49 KB)
/lalaflow/sw.js                    no-cache            gzip
speech protocol_checks.py (8001): 16/16 checks passed   ← WebSocket không bị ảnh hưởng

== /lalaflow/  requests=26 transferred=1556 KB  LCP=8808ms  {"domContentLoaded":973}
   Image 1255KB (80%) | Font 160KB | Script 105KB
```

## Thử chất lượng nén ảnh (Edge canvas, chưa áp dụng)

```
cover    1672x941 555 KB  ->  webp q82 1672x941 342 KB  (38% smaller)
product   800x1000 215 KB ->  webp q80  600x750  64 KB  (70% smaller)
```
So sánh crop phóng to 2× gốc / nén: không thấy khác biệt (ảnh đã gửi người dùng).

Người dùng chọn bỏ qua phần nén ảnh (không thêm Pillow) và chuyển sang Đợt 2. LCP vẫn ~8,8 s trên 4G chậm do ảnh.

## Đợt 2 — SEO cho Google và AI

### Success criteria
| # | Tiêu chí | Kết quả |
|---|---|---|
| S1 | URL thật; mở thẳng URL sâu được; điều hướng không có `#`; link cũ `/#/…` tự chuyển | PASS |
| S2 | Bot không chạy JS thấy title, mô tả, canonical tuyệt đối, h1 và nội dung riêng mỗi trang | PASS |
| S3 | JSON-LD: Organization + WebSite; Product + Offer VND + AggregateRating + BreadcrumbList; ItemList | PASS |
| S4 | Sản phẩm `[Mẫu]` noindex, không trong sitemap; admin noindex + Disallow | PASS |
| S5 | robots.txt (11 nhóm bot gồm GPTBot, ClaudeBot, PerplexityBot), sitemap.xml hợp lệ, llms.txt | PASS |
| S6 | Nội dung khách nhập được escape trong HTML và JSON-LD | PASS (sau khi sửa, xem dưới) |
| S7 | Không hỏng: PWA, service worker, admin, /api, đánh giá, speech | PASS |

### Thay đổi
- `speech-service/app/lalaflow_pages.py` (mới): mỗi route công khai trả `index.html` đã build, chèn title, description,
  robots, canonical, Open Graph, JSON-LD (`data-ssr`) và bản HTML nội dung trong `#root`; dữ liệu lấy từ backend, cache 60 s,
  backend lỗi thì vẫn trả trang với thẻ chung. Kèm `/robots.txt`, `/sitemap.xml`, `/llms.txt`. `PUBLIC_SITE_URL` đặt
  origin cố định khi có domain thật; để trống thì dùng host của request (ngrok → https).
- Frontend: `BrowserRouter` basename `/lalaflow`, Vite `base: "/lalaflow/"`, chuyển link `#/…` cũ, đường dẫn SW/manifest/icon
  tuyệt đối, canonical không `#`, `noindex` cho `[Mẫu]`, app gỡ JSON-LD `data-ssr` khi tự chèn bản của nó.
- Trạng thái hàng trong JSON-LD theo nhãn cửa hàng ("Có sẵn" / "Đang nhập" / "Hết hàng"), không theo tồn kho.

### Lỗi bắt được khi kiểm S6
Lần đầu JSON-LD chỉ thay `</` → chuỗi `<script>`, `<img onerror` của khách vẫn nằm thô trong phần tử script (không chạy
được, nhưng `<!--<script` có thể đẩy parser vào trạng thái escaped-script). Sửa: thay `<`, `>`, `&` bằng `\u003c`… trong JSON-LD.

### Raw output
```
200 /lalaflow/                   title='Lala Home | Giấy, bao bì và giải pháp in ấn'
     robots=index,follow,max-image-preview:large canonical=http://127.0.0.1:8000/lalaflow/ h1='Lala Home' text_chars=566 json_ld=['Organization', 'WebSite']
200 /lalaflow/san-pham           ... text_chars=405 json_ld=['ItemList', 'BreadcrumbList']
200 /lalaflow/san-pham/14        ... json_ld=['Product', 'BreadcrumbList']  Product offer=150000 VND InStock
200 /lalaflow/san-pham/85        robots=noindex,nofollow ... aggregateRating ratingValue 4.2 reviewCount 5, reviews_in_schema=5
200 /lalaflow/admin              robots=noindex,nofollow
404 /lalaflow/san-pham/999999    robots=noindex,nofollow
robots.txt 200 ... groups: 11 | Sitemap: …/sitemap.xml
sitemap.xml 200 application/xml valid-xml urls=11 samples_in_sitemap=0 hash_urls=0
llms.txt 200 text/markdown

XSS (review id 147, đã xoá): raw '<script>alert' anywhere: 0 | raw '<img src=x' anywhere: 0 | raw '<!--<script' anywhere: 0
script elements in page: 3 (expected 3) | JSON-LD round-trips reviewBody + author exactly: True True | deleted 1

Edge CDP:
legacy hash link   -> /lalaflow/san-pham/85 | h1: [Mẫu] Vải Dán Tường Vinyl PVC Đáy Chữ Thập MS8-093
JSON-LD blocks     -> app:Product
robots meta        -> noindex,nofollow | canonical: http://localhost:8000/lalaflow/san-pham/85
click 'Sản phẩm'   -> /lalaflow/san-pham | cards: 55 | same document
click product card -> /lalaflow/san-pham/85
deep link direct   -> /lalaflow/gioi-thieu | app rendered: True
admin              -> /lalaflow/admin | admin UI: TRANG QUẢN TRỊ … Đăng nhập
service worker     -> http://localhost:8000/lalaflow/ active=true | installability errors: []
api via app        -> 200 gzip | page errors -> none

qua ngrok: canonical https://stung-quantum-mongrel.ngrok-free.dev/lalaflow/san-pham/1 | Sitemap: https://…/sitemap.xml
speech protocol_checks.py: 16/16 checks passed
```

## Chưa làm / cần biết
- Domain thật: SEO trên domain ngrok tạm không có giá trị; khi có domain đặt `PUBLIC_SITE_URL` và khai báo với Google Search Console.
- Ảnh (LCP ~8,8 s trên 4G chậm) — Core Web Vitals là một tín hiệu xếp hạng của Google.
- Trang chủ LalaHome ở `/` vẫn là trang tĩnh riêng, chưa có meta/JSON-LD.
- 5 sản phẩm thật chưa có ảnh nên Product JSON-LD không có `image` (Google cần ảnh để hiện kết quả dạng sản phẩm).
- Icon đã cài trên điện thoại vẫn mở `/lalaflow/` nên không bị ảnh hưởng.
