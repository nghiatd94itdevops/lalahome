# 2026-10-27: Trang chat trợ lý full màn hình `/tro-ly` có kệ sản phẩm (2/2)

## Goal
Thêm trang chat toàn màn hình, để sản phẩm khách cần hiện thành thẻ lớn thay vì nằm chật trong khung chat nhỏ. Hai lựa chọn của chủ shop:
- **Bố cục chia đôi:** chat bên trái, "kệ sản phẩm" bên phải.
- **Giữ khung nổi:** thêm nút ⤢ để mở trang full.

**Không làm:**
- không đổi backend chat, prompt hay cách tìm sản phẩm;
- không thêm `/tro-ly` vào menu chính hay sitemap;
- không đổi nút "Hỏi Mimi" ở trạng thái rỗng của trang Sản phẩm (nút này vẫn mở khung nổi).

## Success criteria
- **P1.** Desktop: chat bên trái, kệ bên phải, gói trong một màn hình. Kệ hiện sản phẩm của câu trả lời mới nhất dưới dạng thẻ lớn: ảnh, tên, đánh giá, giá, tình trạng, nút "Xem chi tiết" và "Báo giá".
- **P2.** Bấm "Xem N sản phẩm trên kệ" ở câu trả lời cũ thì kệ chuyển sang câu đó. Có câu trả lời mới thì kệ tự về câu mới.
- **P3.** Kệ sắp xếp được (Phù hợp nhất / Giá tăng dần / Giá giảm dần) và lọc được "Chỉ hàng có sẵn".
- **P4.** Nút ⤢ ở khung nổi mở `/tro-ly`, giữ nguyên cuộc trò chuyện. Trên trang full không có nút và khung nổi.
- **P5.** "Hỏi Mimi" (trang chủ) và "Trò chuyện với Mimi" (Giới thiệu) dẫn tới `/tro-ly`.
- **P6.** Điện thoại 390px và 360px:
  - chat lấp đầy khoảng giữa `main` và tab bar;
  - sản phẩm hiện dưới mỗi câu trả lời;
  - không có kệ;
  - không cuộn ngang.
- **P7.** Không lỗi console. Backend không đổi.

## Changes
- **`pages/Assistant.jsx` (mới):**
  - `AssistantPage` gồm header với Mimi sống theo tâm trạng hội thoại, `ChatThread` và `ChatComposer`, cùng `ProductShelf`.
  - Kệ ghép thẻ gọn từ `/chat` với sản phẩm trong catalogue đã tải sẵn (lấy đánh giá, ảnh, mô tả). Thiếu trong catalogue thì dùng thẻ chat.
  - `AnswerProducts`: desktop hiện nút "Xem N sản phẩm trên kệ", điện thoại hiện danh sách gọn. CSS quyết định hiện cái nào.
- **`App.jsx`:**
  - route `/tro-ly`;
  - `active` của hook gồm cả khi đang ở trang;
  - ẩn `ChatAssistant` nổi và footer trên trang;
  - tab "Trợ lý AI" ở trạng thái `aria-expanded=true` khi đang ở trang;
  - `openAssistantPage` đóng panel rồi điều hướng.
- **`components/ChatAssistant.jsx`:**
  - thêm nút ⤢ (`chat-expand`), ẩn trên điện thoại vì panel ở đó đã full màn hình;
  - nhãn "Cuộc trò chuyện mới" trong khung nổi rút thành "Làm mới", vẫn có `title` đầy đủ, vì header 400px không đủ chỗ cho thêm một nút;
  - khối tiêu đề có class `chat-head-text`.
- **`pages/Home.jsx`, `pages/Company.jsx`:** nút Mimi dùng `openAssistantPage`.
- **`styles.css`:**
  - khối `.assistant-*`, `.shelf-*`;
  - `.site.is-assistant-page` cao đúng `100dvh`, nên chat và kệ cuộn riêng;
  - quy tắc cũ `.chat-head div` đổi thành `.chat-head-text`. Lý do: selector cũ bắt cả các `div` bên trong Mimi sống, làm vỡ header trang, chữ đè lên nút loa.
- **`speech-service/app/lalaflow_pages.py`:** route server `GET /lalaflow/tro-ly`. Trước đó mở thẳng URL này trả 404 JSON, vì server chỉ render những đường dẫn được khai báo.

## Result
Build: JS 445,69 KB (gzip 136,48 KB), trước thay đổi là 440,63 KB (gzip 135,15 KB). Uvicorn :8000 được khởi động lại để nạp route mới.
```
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/lalaflow/tro-ly   # trước khi thêm route
404
tro-ly 200                                                                         # sau khi thêm route, restart
```
`assistant-page-test.mjs`. `/chat` được trả lời ngay trong trang bằng thẻ của sản phẩm thật, nên không gọi model:
```
PASS panel header: title, speaker, ⤢, restart and close do not overlap: []
PASS P4 ⤢ opens /tro-ly with the same conversation, no floating launcher or panel: {"path":"/lalaflow/tro-ly","bubbles":["ZZTEST giấy dán tường","ZZTEST đây là vài mẫu"],"launcher":false,"panel":false,"footer":false}
PASS P1 chat left, shelf right, both inside one screen (no page scroll): {"chatRight":509,"shelfLeft":528,"shelfRight":1251,"bottom":801,"h":820,"pageScroll":0}
PASS P1 shelf shows the latest answer's products as large cards: {"heading":"“ZZTEST giấy dán tường”","n":3}
PASS P1 cards carry rating from the catalogue, status pill, detail and quote links: {"name":"[Mẫu] Vải Dán Tường Vinyl PVC Đáy Chữ Thập MS8-093","price":"850.000đ / cuộn","rating":"★★★★★★★★★★4,2(5 đánh giá)","pill":"Đang nhập","links":["/lalaflow/san-pham/85","/lalaflow/yeu-cau-bao-gia?product=85"]}
PASS P1 desktop conversation shows a shelf button, not the compact list: none
PASS P3 "Giá tăng dần" orders the shelf by price: ["[Mẫu] Giấy Dán Tường Hàn Quốc Hera H6038-1S","[Mẫu] Vải Dán Tường Vinyl PVC Đáy Chữ Thập MS8-093","[Mẫu] Giấy dán tường Hàn Quốc V-Concept 7915-6"]
PASS P3 "Chỉ hàng có sẵn" keeps only in-stock products: ["Có sẵn","Có sẵn"]
PASS P2 a new answer moves the shelf to its products: {"heading":"“ZZTEST loại khác”","n":1}
PASS P2 suggestions are labelled as such: Gợi ý gần nhất · 1
PASS P2 "Xem N sản phẩm trên kệ" on the earlier answer brings its products back: {"heading":"“ZZTEST giấy dán tường”","n":3}
PASS a new conversation empties the shelf: {"empty":true,"heading":"Kệ sản phẩm của bạn","cards":[]}
PASS P5 / Mimi button opens /tro-ly: /lalaflow/tro-ly
PASS P5 /gioi-thieu Mimi button opens /tro-ly: /lalaflow/tro-ly
PASS leaving /tro-ly brings the floating launcher and footer back: launcher + footer
PASS 390px page header items do not overlap: []
PASS P6 390px chat fills main → tab bar, products under the answer, no shelf, no sideways scroll: {"chatTop":224,"mainTop":224,"chatBottom":782,"inputBottom":733,"barTop":780,"shelf":"none","inline":3,"overflow":0,"pageScroll":0,"tab":"true"}
PASS 360px page header items do not overlap: []
PASS P6 360px chat fills main → tab bar, products under the answer, no shelf, no sideways scroll: {"chatTop":265,"mainTop":265,"chatBottom":678,"inputBottom":629,"barTop":676,"shelf":"none","inline":3,"overflow":0,"pageScroll":0,"tab":"true"}
PASS P7 no console errors: none
ALL PASS
```
Ghi chú về P6:
- `chatBottom` thấp hơn `barTop` 2px vì viền trên 2,5px của tab bar không nằm trong `--tabbar-h`. Footer site cũng lệch đúng như vậy. Test cho phép lệch 3px, và ô nhập luôn nằm trên tab bar.
- `mainTop` thấp hơn header vì banner "Cài ứng dụng" có sẵn (bấm × là ẩn).

Hồi quy trên build cuối:
```
== assistant-page-test: 20 PASS, 0 FAIL, ALL PASS
== mimi-pages-test: 14 PASS, 0 FAIL, ALL PASS
== mimi-notes-test: 15 PASS, 0 FAIL, ALL PASS
== mobile-regress: 29 PASS, 0 FAIL, ALL PASS
== mimi-test: 18 PASS, 0 FAIL, ALL PASS
```
Thay đổi trong bộ test:
- `mimi-pages-test` có 2 kiểm tra đổi kỳ vọng: nút Mimi ở trang chủ và Giới thiệu giờ kỳ vọng `location.pathname === '/lalaflow/tro-ly'`, không còn kỳ vọng `.chat-panel`. Đây là hệ quả trực tiếp của P5, chủ shop đã chọn.
- `mimi-notes-test` mỗi lần chạy ghi 1 đánh giá `ZZTEST Mimi`. Sau 4 lần chạy, đã xoá đúng 4 dòng (id 181–184); còn lại `zztest_left = 0`.

Ảnh chụp trong scratchpad: `assistant-desktop.png`, `assistant-desktop-empty.png`, `assistant-phone.png`, `assistant-panel-expand.png`.

Chưa kiểm:
- Safari và iOS thật: `100dvh` và bàn phím ảo trên iPhone;
- mic và đọc to trên trang full (dùng chung hook, nhưng chưa thử bằng giọng nói thật);
- câu trả lời thật từ model, vì test dùng câu trả lời giả.

## Status
DONE (P1–P7 PASS).
