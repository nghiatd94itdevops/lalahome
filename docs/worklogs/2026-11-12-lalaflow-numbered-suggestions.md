# 2026-11-12 — Đánh số "Đề xuất N" để khách chọn theo số

**Status:** PARTIAL

Tính năng đã chạy đúng: tiêu chí 1–3 đạt. Riêng **tiêu chí 4 chưa đạt**, vì hai bài kiểm tra cũ kém đi. Đối chứng cho
thấy hôm nay hai bài này cũng kém khi dùng hướng dẫn cũ, nhưng chưa loại trừ được ảnh hưởng của quy tắc mới. Chi tiết
ở phần Verification.

## Goal

Khi Mimi đưa nhiều lựa chọn, câu trả lời ghi "Đề xuất 1: sản phẩm A…, Đề xuất 2: sản phẩm B…". Nhờ vậy khách chỉ cần
nói hoặc bấm "tôi chọn đề xuất 1", không phải đọc tên sản phẩm dài, và Mimi tư vấn tiếp đúng sản phẩm đó.

**Không làm:** thay đổi cách tìm sản phẩm, stream câu trả lời.

## Success criteria

1. Khi giới thiệu từ 2 sản phẩm trở lên, câu trả lời ghi "Đề xuất 1…N", khớp đúng số và thứ tự với các thẻ sản phẩm.
2. Thẻ sản phẩm có nhãn "Đề xuất N". Câu trả lời mới nhất có nút "Chọn đề xuất N", bấm vào thì gửi "Tôi chọn đề xuất N".
3. "Tôi chọn đề xuất 2", hoặc nói bằng giọng "lấy đề xuất ba", thì Mimi tư vấn tiếp đúng sản phẩm đó và không hỏi lại.
4. 16 bài kiểm tra AI có sẵn không bị tệ đi.

## Thay đổi

- `lalaflow/backend/chat.js`:
  - Quy tắc 6 bỏ kiểu liệt kê "- ", chuyển sang theo quy tắc 17.
  - Quy tắc 17: đánh số "Đề xuất N: tên [#id], giá, lý do ≤ 6 chữ", vẫn tối đa khoảng 90 từ, không cố thêm cho đủ 3 mẫu.
  - Quy tắc 18: khách chọn theo số thì lấy sản phẩm thứ N trong dòng "Sản phẩm đã giới thiệu" gần nhất, và không hỏi lại.
  - Thêm `labelSuggestions()`: khi AI viết "1:" hoặc "- " thay cho "Đề xuất 1:", và số dòng liệt kê bằng đúng số thẻ, thì
    tự đổi thành "Đề xuất N:".
  - Thứ tự thẻ vẫn là thứ tự AI nhắc tên sản phẩm (`mentionedProducts`), nên dòng N ứng với thẻ N.
- `components/useAssistantChat.js`: dòng ghi chú lịch sử gửi lại cho AI được đánh số theo thẻ, dạng
  "Đề xuất 1: … [#id]; Đề xuất 2: …".
- `components/ChatAssistant.jsx`: thêm `SuggestionLabel`, `isChoice` và `chooserFor`.
  - Chỉ câu trả lời mới nhất mới có nút chọn, và không có khi đang chờ AI trả lời.
  - Bấm nút thì huỷ micro đang nghe, rồi gửi câu "Tôi chọn đề xuất N".
- `MimiConversation.jsx`, `pages/Assistant.jsx`: thêm nhãn và nút vào thẻ ở màn hình Mimi, ở trang Trợ lý và trên kệ.
  Số đề xuất được gán trước khi sắp xếp kệ.
- `styles.css`: thêm `.suggestion-*`.
- `lalaflow/scripts/chat_eval.py`: thêm 4 bài kiểm tra (`danh-so-de-xuat`, `danh-so-gia-re`, `chon-de-xuat-2`,
  `chon-de-xuat-giong-noi`) và 2 điều kiện chấm (`numbered`, `first_id`).

## Verification

### Bài mới, trước khi sửa (hướng dẫn cũ)

```
TRƯỢT danh-so-de-xuat      lần 1  25.8s  nhãn [] không khớp 3 thẻ
TRƯỢT danh-so-de-xuat      lần 2  24.7s  nhãn [] không khớp 3 thẻ
TRƯỢT danh-so-gia-re       lần 1  24.6s  nhãn [] không khớp 3 thẻ
TRƯỢT danh-so-gia-re       lần 2  25.2s  nhãn [] không khớp 3 thẻ
ĐẠT  chon-de-xuat-2       lần 1  24.3s
ĐẠT  chon-de-xuat-2       lần 2  24.2s
ĐẠT  chon-de-xuat-giong-noi lần 1  25.3s
ĐẠT  chon-de-xuat-giong-noi lần 2  24.4s
```

Chọn theo số đã chạy được khi lịch sử được đánh số. Việc còn thiếu là câu trả lời tự đánh số.

### Bộ đầy đủ sau khi sửa (20 bài × 2 lần, quy tắc 17 bản đầu)

```
Nội dung đạt: 37/40 | Hình thức đạt: 38/40 | thời gian trung vị 24.6s, chậm nhất 26.4s
TRƯỢT cung-loai-gia-re lần 1, 2 ; TRƯỢT tinh-so-cuon lần 2 ; chong-chay 121 và 136 từ
4 bài mới: 8/8 ĐẠT
```

Sau đó rút gọn quy tắc 17 (lý do ≤ 6 chữ, tối đa khoảng 90 từ) rồi chạy lại các bài bị ảnh hưởng, mỗi bài 4 lần:

```
cung-loai-gia-re 0/4 | chong-chay 4/4 (1 lần 121 từ) | tinh-so-cuon 0/4 | danh-so-de-xuat 4/4
```

### Đối chứng: hướng dẫn cũ (bỏ quy tắc 17, 18, trả quy tắc 6), cùng thời điểm, 4 lần

```
cung-loai-gia-re 1/4 | tinh-so-cuon 2/4
```

Hôm qua (`2026-11-11-lalaflow-ai-smarter.md`): `tinh-so-cuon` đạt 2/2, `cung-loai-gia-re` đạt 1/2.

| Tiêu chí | Kết quả |
|---|---|
| 1 | PASS. Hai bài đánh số đạt 2/2 và 4/4. `labelSuggestions` chạy đúng với 6 câu mẫu, kể cả các trường hợp không được đổi. |
| 2 | PASS. Kiểm tra trong trình duyệt, xem bên dưới. |
| 3 | PASS. `chon-de-xuat-2` đạt 4/4, `chon-de-xuat-giong-noi` đạt 4/4 tính cả trước và sau khi sửa. Trình duyệt: thẻ #42 đúng. |
| 4 | **FAIL / chưa kết luận được.** `tinh-so-cuon`: AI đổi 132cm thành 0,132m, ra 15–17 cuộn. Lỗi tính toán này cũng có với hướng dẫn cũ (2/4). `cung-loai-gia-re` là bài vốn đã trượt từ trước. Với 4 lần chạy thì chưa tách được phần nào do quy tắc mới. |

### Trình duyệt (Chromium headless, server :8000 và backend thật)

```
== chat panel
  card ids: [40, 42, 46]
  labels: ['Đề xuất 1', 'Đề xuất 2', 'Đề xuất 3'] | buttons: ['Chọn đề xuất 1', 'Chọn đề xuất 2', 'Chọn đề xuất 3']
  sent: 'Tôi chọn đề xuất 2'
  answer: Ok bạn nhé, mình xác nhận bạn chọn: [Mẫu] Giấy dán tường giá rẻ TA90092, 200.000đ/đơn vị (tình trạng: Có sẵn). | Bạn cho mình xin số lượng ...
  answer cards: [42] (expected first = 42)
  buttons left on the older answer: []
  exceptions: []
== shelf (câu trả lời nạp sẵn, 3 mẫu khác giá)
fit        ['Đề xuất 1 = … D127 50.000đ', 'Đề xuất 2 = … BOS 81106-7 1.050.000đ', 'Đề xuất 3 = … TA90092 200.000đ']
priceDesc  ['Đề xuất 2 = … BOS 81106-7 1.050.000đ', 'Đề xuất 3 = … TA90092 200.000đ', 'Đề xuất 1 = … D127 50.000đ']
choose buttons on shelf: ['Chọn đề xuất 2', 'Chọn đề xuất 3', 'Chọn đề xuất 1']
npm run build: ✓ built in 1.30s
```

## Theo dõi thêm

- **Lỗi đổi đơn vị trong `tinh-so-cuon`** (cm → m): có thể thêm một câu vào quy tắc 12, ví dụ "132 cm = 1,32 m", hoặc để
  máy chủ tự tính m² mỗi cuộn từ thông số rồi đưa kết quả cho AI. Việc này nằm ngoài phạm vi lần này, cần hỏi trước.
- **`cung-loai-gia-re`** vẫn hay gợi ý mẫu Hàn Quốc giá cao. Lỗi này có từ trước.
- `ChatAssistant.jsx` và `Assistant.jsx` đã bị phiên làm việc song song sửa thêm (`AssistantHead`) trong lúc làm.
  Phần của việc này vẫn còn nguyên, và build lại vẫn qua.
