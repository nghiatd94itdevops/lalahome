# 2026-11-11: Trợ lý AI lên phiếu yêu cầu báo giá, khách xem lại rồi tự gửi

**Status:** DONE (Q1–Q7 PASS). Xem mục "Còn lại".

## Goal
Khách gõ hoặc nói nhu cầu, tên và SĐT. Trợ lý lên **phiếu yêu cầu báo giá nháp** ngay trong chat, khách xem lại, sửa nếu cần rồi tự bấm gửi. Yêu cầu vào `quote_requests` để admin xử lý như các yêu cầu khác.

Chủ shop đã chọn:
- thêm cột `items` + `source` (schema change);
- che SĐT/email trong `chat_logs`.

**Không làm:**
- AI tự gửi yêu cầu (không có đường nào để làm vậy);
- đổi form `/yeu-cau-bao-gia`;
- AI lập báo giá chính thức.

## Success criteria
- **Q1.** Khách xin báo giá kèm tên và SĐT thì AI gọi `draft_quote_request`. Phiếu nháp hiện dưới câu trả lời, gồm: tên, SĐT, email, công ty, các dòng sản phẩm × số lượng (đơn vị lấy từ catalogue), ghi chú.
- **Q2.** Server kiểm phiếu: chỉ nhận sản phẩm có thật và đang bán, số lượng nguyên ≥ 1. Thiếu tên hoặc SĐT thì không lên phiếu, AI hỏi lại.
- **Q3.** Khách sửa được phiếu và tự bấm gửi. Không có `POST` nào trước cú bấm đó.
- **Q4.** Gửi xong có dòng `source='chat'` với đủ `items`. Phiếu chuyển "Đã gửi #id", Mimi ở trạng thái `success`.
- **Q5.** Admin thấy nhãn "Từ trợ lý AI" và đủ các dòng. "Tạo báo giá" điền sẵn tất cả các dòng.
- **Q6.** `chat_logs` không chứa SĐT/email nguyên văn.
- **Q7.** Form cũ vẫn chạy (`source='form'`). Không lỗi console.

## Changes
- **`backend/chat.js`:**
  - tool `draft_quote_request` và hàm `draftQuote()`: kiểm id với catalogue, số lượng, SĐT 9–12 chữ số; trùng sản phẩm thì lấy dòng sau; tối đa 10 dòng;
  - phản hồi `/chat` có thêm trường `quoteDraft`;
  - quy tắc prompt số 8 viết lại;
  - `maskContacts()` che SĐT (bắt đầu bằng `0`/`84`/`+84`) và email trước khi ghi `question`, `answer`, `searches`;
  - bộ lọc rò rỉ cho phép thêm các email **khách đã gõ trong chính cuộc trò chuyện này**. Lý do: khi chạy thật, AI nhắc lại email của khách, câu trả lời bị thay bằng câu từ chối và phiếu mất theo. `chatGuard.js` không đổi.
- **`backend/server.js`:**
  - migration `ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS items TEXT` và `source VARCHAR(20) NOT NULL DEFAULT 'form'`;
  - `POST /quote-requests` nhận thêm `items` và `source`. Tên và đơn vị đọc lại từ bảng `products`. Dòng đầu cũng ghi vào `product_id/product_name/quantity` để màn list, dashboard và export cũ vẫn đúng;
  - `GET` trả `items` dạng mảng.
- **`frontend`:**
  - `components/QuoteDraftCard.jsx` (mới);
  - `useAssistantChat.js`: thêm `submitQuote()`; `toApiMessage` báo cho AI biết phiếu "ĐÃ GỬI #id" hay "CHƯA gửi";
  - `ChatAssistant.jsx`: thêm `MessageQuote`; chỉ phiếu mới nhất gửi được, phiếu cũ chuyển sang chỉ đọc;
  - `MimiConversation.jsx`: hiện phiếu trong màn Mimi nói chuyện;
  - `styles.css`: khối `.quote-draft*`;
  - `admin/screens/Sales.jsx` và `admin.css`: hiện các dòng, nhãn nguồn, prefill nhiều dòng, cột "Nguồn" trong Excel.
- **Sửa riêng (nên tách commit):** `styles.css`, rule điện thoại `.assistant-shelf.is-empty`. Kệ rỗng hiện trên điện thoại vì `.assistant-shelf.is-empty { display: grid }` có độ ưu tiên cao hơn rule ẩn. Lỗi có từ PR `/tro-ly` ngày 27/10; test P6 khi đó chỉ đo sau khi đã hỏi nên không bắt được.

## Result
Migration: 3 yêu cầu cũ giữ nguyên và nhận `source='form'`.
```
items	text	YES		NULL
source	varchar(20)	NO		form
```
Unit test (`mask-test.mjs`): 11/11 PASS. Che `0912 345 678`, `+84 912345678`, `0912.345.678`, email; không che `120.000.000đ`, `850.000đ`, `MS8-093`. `draftQuote` bắt đúng: thiếu tên/SĐT, sai mã, số lẻ, không có sản phẩm.

API (`quote-api-test.mjs`): 8/8 PASS. Gồm: chat 2 items → 201; form cũ → 201; sản phẩm lạ, số lượng 0, trùng sản phẩm, rỗng, `source` lạ, thiếu SĐT → 400.

Trình duyệt, `/chat` giả lập (`quote-draft-test.mjs`):
```
PASS Q1 draft card under the answer, filled from the conversation
PASS Q3 nothing is sent until the visitor presses the button: 0 POST
PASS Q3 a quantity of 0 is caught before sending: Số lượng phải là số nguyên từ 1.
PASS Q4 after the visitor sends: card shows "Đã gửi #id" with the edited lines: … "✓ Đã gửi yêu cầu báo giá #9" … "× 12 cuộn"
PASS Q4 Mimi celebrates the sent request: success
PASS the model is told the draft was sent, with its request id
PASS a newer draft replaces the older one (old one read-only): {"forms":1,"old":1}
PASS 360px draft card fits the screen: {"right":346,"overflow":0}
PASS Q7 no console errors: none
DB: 9	chat	zztest@example.com	ZZTEST Co	85	12	…	[{"productId":85,"quantity":12,…,"unit":"cuộn"}]
```
AI thật `gpt-5.4-nano` (`quote-live.mjs`), lần chạy sau khi sửa bộ lọc:
```
PASS Q2 no name/phone yet → no draft, AI asks for them
PASS Q1 contact given → draft … {"customerName":"ZZTEST Lan","phone":"0912 345 678","email":"zztest.lan@example.com","companyName":"ZZTEST Decor","items":[{"productId":36,…,"quantity":20}],…}
FAIL reply does not read the phone or email back   ← AI vẫn liệt kê lại SĐT/email (xem "Còn lại")
PASS reply does not claim the request was sent
PASS model knows the draft is not sent yet
```
Lần chạy trước khi sửa: lượt 2 bị `Chat reply withheld (matched email)`, và lượt 3 AI nói đã có phiếu dù không có. Đã thêm quy tắc prompt về việc này; lần chạy sau AI trả lời đúng.

Q6, kiểm `chat_logs`: câu hỏi lưu dạng `số 09…678, email z…@example.com`, câu trả lời lưu `SĐT: 09…678`. Đếm số dòng còn chứa `0912 345 678` hoặc `zztest.lan@` ra **0**.

Admin (`quote-admin-test.mjs 7`), 5/5 PASS:
```
PASS Q5 the request shows "Từ trợ lý AI" and both product lines … ["… MS8-093 ×5 cuộn","… R-24 ×2 cuộn"]
PASS Q7 a form request keeps its single line and no AI badge
PASS Q5 "Tạo báo giá" prefills every product line with its quantity: {"products":["85","84"],"quantities":["5","2"]}
```
Smoke (`smoke-test.mjs`), 7/7 PASS: form cũ gửi được; `/`, `/san-pham`, `/gioi-thieu`, `/tro-ly` render; khung chat nổi mở; không lỗi console. Kệ rỗng trên điện thoại (`empty-shelf-check.mjs`), 2/2 PASS ở 390px và 360px.

Dọn dữ liệu:
- `quote_requests` #7–#10: đã xoá 4 dòng;
- `customers` #7 `ZZTEST API`: đã xoá 1 dòng;
- `chat_logs` 2 session của mình: đã xoá 6 dòng.

**Không xoá** 6 dòng `chat_logs` của 2 session `zztest-quote-1794384296856` và `…308310`, vì mình không chạy chúng.

## Còn lại
- **AI vẫn đọc lại SĐT/email** dù prompt cấm. Hiện bộ lọc đã cho phép, và log đã che. Nhưng ở màn Mimi nói chuyện, Mimi sẽ **đọc to** số điện thoại.
- **Sản phẩm #36 không có đơn vị trong DB**, nên phiếu ghi "đơn vị" dù khách nói "cuộn". Đây là dữ liệu catalogue, không phải code.
- **Các bộ test hồi quy cũ đã mất theo scratchpad**: mobile-regress, mimi-test, assistant-page-test… Lần này thay bằng smoke test và đã viết lại `cdp.mjs`.
- **Có phiên khác sửa song song:** `useAssistantChat.js` và `ChatAssistant.jsx` bị sửa lúc 15:00, sau khi mình viết xong. Phần báo giá vẫn còn nguyên và đã build lại lúc ~15:07.
- **Mật khẩu `Admin123!` vẫn đăng nhập được.**
- **Chưa thử:** Safari/iPhone; nói phiếu bằng giọng thật.
