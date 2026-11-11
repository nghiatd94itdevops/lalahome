# 2026-10-27: Mimi ở trạng thái trống, lỗi, và phản hồi sau thao tác (3/3)

## Goal
Gắn Mimi vào các chỗ trang khách phải báo tin, theo trạng thái của bộ nhận diện:

| Chỗ | Trạng thái |
|---|---|
| Không tải được dữ liệu (trang chủ, danh mục, chi tiết, hoạt động, đánh giá) | `error` |
| Tìm sản phẩm không ra (kèm "Xóa bộ lọc" và "Hỏi Mimi") | `sad` |
| Sản phẩm không tồn tại | `confused` |
| Đang tải trang chi tiết | `processing` |
| Chưa có đánh giá | `greet` |
| Chưa có hoạt động | `info` |
| Gửi đánh giá xong | `love` |
| Popup thành công (có pháo giấy) | `success` |
| Popup lỗi | `warning` |

**Không làm:**
- màn báo crash (`ErrorBoundary`): nếu Mimi chính là thứ gây lỗi, vẽ Mimi ở đó sẽ làm trắng cả trang;
- admin: popup admin giữ dấu ✓ / !.

## Success criteria
- **N1.** Mỗi chỗ trong bảng hiện Mimi sống, đúng trạng thái, kèm lời nhắn.
- **N2.** "Hỏi Mimi" ở danh mục rỗng mở trợ lý AI.
- **N3.** Popup thành công có pháo giấy (khi không giảm chuyển động); popup lỗi không còn dấu "!".
- **N4.** Popup admin vẫn dùng dấu ✓ / !, không có Mimi.
- **N5.** Ở 390px và 360px khung lời nhắn vừa màn hình; không lỗi console (ngoài các request API cố ý chặn).

## Changes
- **`components/Mimi.jsx`:** thêm `MimiNote` (Mimi cạnh lời nhắn, giữ khung `.empty-note`).
- **`pages/Products.jsx`:**
  - danh mục lỗi hoặc rỗng; đánh giá lỗi hoặc rỗng; Mimi `love` trong lời cảm ơn;
  - `NOT_FOUND` thay cho `NOT_FOUND_TEXT`, có trạng thái theo từng trường hợp;
  - `ProductsPage` nhận `openAssistant`.
- **`pages/Home.jsx`, `pages/Activities.jsx`:** lời nhắn lỗi và rỗng dùng `MimiNote`.
- **`components/Shell.jsx`:** `AlertPopup` có prop `figure`: `"mimi"` (mặc định, trang khách) hoặc `"icon"` (admin); bảng `POPUP_FIGURES`.
- **`admin/AdminApp.jsx`:** truyền `figure="icon"`.
- **`styles.css`:** `.mimi-note*`, `.popup-mimi`, `.review-thanks-mimi`.
  - Có một lần mình xoá nhầm `.popup-mark`, tưởng không còn dùng. Admin vẫn dựa vào rule gốc này, nên đã khôi phục.

## Result
`mimi-notes-test.mjs`: chặn `/api` trong trình duyệt để giả lập mất kết nối; POST báo giá được giả lập trong trang; test đánh giá ghi một đánh giá ZZTEST rồi xoá.
```
PASS search with no match: sad Mimi, "Xóa bộ lọc" and "Hỏi Mimi": {"empty":[{"state":"sad","live":true,"text":"Mimi chưa tìm thấy sản phẩm phù hợp. Bạn thử xoá bộ lọc, hoặc kể Mimi "}],"buttons":["Xóa bộ lọc","Hỏi Mimi →"]}
PASS "Hỏi Mimi" opens the assistant: chat-panel open
PASS unknown product: confused Mimi: [{"state":"confused","live":true,"text":"Sản phẩm không tồn tại hoặc đã ngừng bán."}]
PASS product without reviews: greeting Mimi invites the first review: [{"state":"greet","live":true,"text":"Chưa có đánh giá nào. Bạn là người đầu tiên chia sẻ cảm nhận nhé!"}]
PASS after sending a review: Mimi in love: {"state":"love","text":"Cảm ơn bạn đã đánh giá!"}
PASS form problem: popup with a warning Mimi instead of "!": {"state":"warning","mark":false,"text":"Vui lòng kiểm tra lại"}
PASS quote sent: popup with a successful Mimi and confetti: {"state":"success","confetti":46,"mark":false}
PASS admin popups keep the ✓ / ! mark, no Mimi: {"mark":true,"mimi":false}
PASS API down, home: error Mimi with the message: [{"state":"error","live":true,"text":"Chưa tải được sản phẩm, bạn thử tải lại trang nhé."}]
PASS API down, catalogue: error Mimi with the message: [{"state":"error","live":true,"text":"Chưa tải được danh mục sản phẩm, bạn thử tải lại trang nhé."}]
PASS API down, product page: error Mimi with the message: [{"state":"error","live":true,"text":"Chưa tải được sản phẩm, bạn thử tải lại trang nhé."}]
PASS API down, activities: error Mimi with the message: [{"state":"error","live":true,"text":"Chưa tải được hoạt động, bạn thử tải lại trang nhé."}]
PASS 390px empty note fits the screen: {"right":370,"overflow":0}
PASS 360px empty note fits the screen: {"right":340,"overflow":0}
PASS no console errors apart from the blocked API: none
ALL PASS
```

**Lỗi trong chính bài test:**
- pháo giấy bằng 0, vì Edge ở máy này báo giảm chuyển động và `celebrate()` của bộ Mimi bỏ qua; đặt `no-preference` để kiểm;
- popup admin không hiện, vì `required` chặn form trống; điền tên bằng dấu cách và chọn một loại có thật để code admin tự báo lỗi.

**Hồi quy trên bản build cuối:**
```
mimi-test: ALL PASS, 19 dòng PASS
mimi-pages-test: ALL PASS, 15 dòng PASS
mobile-regress: ALL PASS, 30 dòng PASS
```

**Dọn dữ liệu:** xoá 3 đánh giá `ZZTEST%` (mỗi lần chạy test tạo 1).

Status: **DONE** cho N1–N5.
