# 2026-10-19: Lỗi nhỏ trang khách (nhóm 4/4 của đợt rà soát 16/10)

## Goal
- **V.** Đóng trợ lý AI khi mic đang bật thì câu hỏi dang dở vẫn được gửi đi. Nếu loa đang bật, câu trả lời còn được đọc to dù khung chat đã đóng.
  - Mình tìm thêm một trường hợp: đóng chat trong lúc trình duyệt đang mở mic (trạng thái "starting") thì mic vẫn bật lên sau khi chat đã đóng.
- **E.** API không tải được: trang chi tiết sản phẩm báo "đang được tải..." mãi; danh mục hiện "0 sản phẩm"; trang hoạt động không báo gì.
- **J.** JSON-LD phía client thay bản của server. Bản client không có điểm sao, đánh giá, breadcrumb, `offers.url`, và tính `availability` theo tồn kho, nên sản phẩm "Đang nhập" bị ghi là `OutOfStock` thay vì `PreOrder`.
- **H.** Trang bìa còn link `lalaflow/#/yeu-cau-bao-gia`.
- **A.** `GET /categories?all=1` và `GET /activities?all=1` trả bản ghi đã ẩn cho người chưa đăng nhập.

## Success criteria
- **V1.** Đóng chat khi mic đang nghe: không gửi câu hỏi, không lưu tin nhắn. Mở lại thì mic ở trạng thái nghỉ, ô nhập trống.
- **V2 (đối chứng).** Bấm lại nút mic thì câu hỏi vẫn được gửi.
- **E1.** Chặn API: trang chi tiết, danh mục và hoạt động đều báo "Chưa tải được…"; danh mục không hiện "0 sản phẩm".
- **J1.** Ở lần tải đầu `/lalaflow/san-pham/85`, khối JSON-LD của server (có `aggregateRating` và `PreOrder`) vẫn còn sau khi app chạy.
- **J2.** Chuyển sang sản phẩm khác: app ghi khối của mình, `availability` theo trạng thái, có `url`.
- **H1.** Link trang bìa là `lalaflow/yeu-cau-bao-gia` và mở thẳng trang báo giá.
- **A1.** `?all=1` không đăng nhập → 401; bản công khai vẫn 200; màn admin Loại và Hoạt động vẫn tải được.
- **R.** Test mobile 48 bài vẫn PASS.

## Changes
**`frontend/src/components/useVoice.js`:**
- Thêm `cancel()`: tăng `attempt`, xoá những gì đã nghe, đánh dấu `discarded`, nhả mic và đóng socket.
- `start()` kiểm `attempt` sau khi xin mic, và kiểm `discarded` sau khi mở socket.
- Bộ xử lý `message` và `close` bỏ qua phiên đã bị huỷ.
- Phần dọn dẹp khi unmount dùng chung `cancel` (trước đây là đoạn code lặp gần y hệt).

**`components/ChatAssistant.jsx`:** khi panel đóng thì gọi `cancel` thay cho `stop`.

**`pages/Products.jsx`:**
- danh mục báo "Chưa tải được danh mục sản phẩm…" và ẩn dòng đếm khi lỗi;
- trang chi tiết nhận `dataState`, và `NOT_FOUND_TEXT` có câu riêng cho đang tải, lỗi và không tồn tại.

**`pages/Activities.jsx`:** thêm câu báo lỗi, cùng mẫu với `Home.jsx`.

**`seo.js`:**
- giữ khối `data-ssr` khi đường dẫn vẫn là trang server đã render (`SERVER_RENDERED_PATH`);
- `AVAILABILITY` theo trạng thái, giống `lalaflow_pages.py`;
- thêm `offers.url`.

**`backend/server.js`:** `/categories` và `/activities` dùng `staffForFullCatalogue` (cần đăng nhập khi có `?all=1`); cập nhật chú thích của middleware.

**`web/index.html`:** link báo giá không còn `#/`.

## Result
**V** (`voice-cancel-test.mjs`): Edge dùng mic giả phát file WAV do TTS local tạo ("Tôi muốn tìm giấy in A4 giá rẻ" × 4); `/chat` được giả lập trong trang, không gọi OpenAI.
```
PASS control: pressing the mic again sends what was heard: heard "Tôi muốn tìm", sent ["Tôi muốn tìm giấy"]
PASS closing the assistant mid-question sends nothing: heard "Tôi muốn tìm" before closing, sent [], saved messages 0
PASS reopening shows an idle mic and an empty box: {"mic":"idle","input":""}
PASS no console errors: none
ALL PASS
```
Đối chứng: code cũ gọi `voice.stop()` khi đóng panel, đúng hàm mà nút mic gọi. Dòng đối chứng cho thấy hàm đó gửi câu hỏi đi, tức là hành vi cũ khi đóng panel.

**E, J, H, A** (`site-test.mjs`; API được chặn bằng `Network.setBlockedURLs` trên `*localhost:8000/api/*`):
```
PASS admin categories_list loads with ?all=1 while signed in: no load error
PASS admin activities_list loads with ?all=1 while signed in: no load error
PASS cover "Yêu cầu báo giá" link has no #/ and opens the quote page directly: href lalaflow/yeu-cau-bao-gia, landed /lalaflow/yeu-cau-bao-gia "Nhận tư vấn và báo giá phù hợp"
PASS product 85 after the app loads: server JSON-LD with rating and PreOrder is still there: 2 blocks, ssr 2, client 0
PASS after navigating to another product the app writes its own block, availability from status: product 84 "Đang nhập" -> PreOrder, url true
PASS product page with the API down says it could not load: "Chưa tải được sản phẩm, bạn thử tải lại trang nhé."
PASS catalogue with the API down says so instead of "0 sản phẩm": {"note":"Chưa tải được danh mục sản phẩm, bạn thử tải lại trang nhé.","count":""}
PASS activities page with the API down says so: "Chưa tải được hoạt động, bạn thử tải lại trang nhé."
PASS no console errors apart from the blocked API calls: 3 expected (blocked API)
ALL PASS
```
```
/categories?all=1    401
/activities?all=1    401
/categories          200
/activities          200
```
J2 phân biệt được code cũ và mới: sản phẩm 84 có tồn 0 và trạng thái "Đang nhập", nên code cũ (tính theo tồn kho) sẽ ghi `OutOfStock`.

**R:** `mobile-test.mjs` → `ALL PASS`, 48 PASS.

Status: **DONE** cho V1–V2, E1, J1–J2, H1, A1, R.

**Chưa kiểm:**
- trường hợp đóng chat trong lúc đang xin quyền mic (trạng thái "starting"): đã có code, chưa tái hiện được bằng mic giả, vì mic giả cấp quyền ngay;
- mic thật trên điện thoại.

## Follow-ups
- Khi chuyển trang trong app, JSON-LD của client vẫn chưa có điểm sao và đánh giá. Googlebot chỉ render URL đầu tiên nên không ảnh hưởng SEO, nhưng muốn đầy đủ thì cần lấy đánh giá vào `useSeo`.
