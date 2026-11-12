# 2026-11-12 — Mimi hỏi email khi lên phiếu báo giá

**Status:** DONE

## Goal

Báo giá được gửi qua email, nhưng Mimi lên phiếu mà không hỏi email: quy tắc 8 ghi "email không bắt buộc". Người
dùng chọn "luôn hỏi, cho phép bỏ qua": Mimi hỏi email một lần; khách không có thì vẫn gửi được, nhân viên gọi điện.

Không làm: bắt buộc email ở API `POST /quote-requests` hay form /yeu-cau-bao-gia.

## Success criteria

Bản đầu (công cụ từ chối lên phiếu khi chưa hỏi email) bị đổi sau khi chạy thử, có người dùng đồng ý: trong 2/5 lần
Mimi vẫn nói với khách là "phiếu nháp hiện bên dưới" dù chưa có phiếu nào. Tiêu chí 1 và 2 hiện tại:

1. Chưa có email và Mimi chưa hỏi → vẫn lên phiếu, ô email trống, công cụ dặn Mimi hỏi email.
2. Chưa có email nhưng Mimi đã hỏi trước đó → lên phiếu, không dặn hỏi lại.
3. Email sai định dạng → không lên phiếu, hỏi lại.
4. Kiểm thật với chat: câu trả lời hỏi email và có phiếu nháp; khách nói không có email thì có phiếu và Mimi không hỏi lại.
5. Phiếu nháp có ô email trống thì hiện dòng nhắc; điền email vào thì dòng nhắc mất. Build qua.

## Thay đổi

- `backend/chat.js`:
  - Quy tắc 8: hỏi email một lần, nói rõ là để gửi báo giá.
  - `draftQuote(catalog, args, { emailAsked })`: `emailAsked` đọc từ lịch sử (đã có lượt assistant nhắc "email"), không
    lấy từ cờ do model tự đặt.
  - Email sai định dạng thì báo lỗi; trước đây bị bỏ đi mà không báo.
  - Lời báo lỗi của công cụ ghi rõ "Phiếu CHƯA lên".
- `components/QuoteDraftCard.jsx`: hiện dòng nhắc khi ô email trống.
- `scripts/chat_eval.py`:
  - Thêm điều kiện kiểm `quote_email`.
  - Thêm 2 tình huống `hoi-email`, `khong-co-email`.
  - `nho-so-dien-thoai` thêm email vào câu đầu, để tình huống vẫn kiểm đúng việc nhớ số điện thoại.

## Result

```
quote_email_check.mjs (draftQuote, chạy trong container backend)
PASS  no email, never asked -> draft with empty email, tells model to ask
PASS  no email, already asked -> draft, does not ask again
PASS  invalid email -> no draft, asks again
PASS  valid email -> draft keeps it, no email prompt
PASS  missing phone -> still refused
5/5 passed

Bản đầu (từ chối lên phiếu), chat_eval --runs 5:
TRƯỢT hoi-email lần 1, 4: "...Phiếu nháp hiện bên dưới... Bạn cho mình xin email" (không có phiếu nào)

Bản cuối, chat_eval --runs 5 --only hoi-email khong-co-email nho-so-dien-thoai
Nội dung đạt: 15/15 | Hình thức đạt: 15/15 | thời gian trung vị 6.2s

chat_eval --runs 1 (toàn bộ)
Nội dung đạt: 20/22. Hai tình huống trượt không do thay đổi này (xem Để sau):
TRƯỢT cung-loai-gia-re  gợi ý sai mẫu [38]
TRƯỢT khong-bia-m2      có /... m2/

draft_check2.mjs (Chrome headless, /tro-ly)
PASS draft card  before={"draft":true,"email":"","hint":true} after={"email":"lan.test@example.com","hint":false}

npm run build: ✓ built in 1.14s
```

## Để sau

- `khong-bia-m2` (từ worklog kích thước cuộn): giấy dán tường nay đã có kích thước trong mô tả, nên Mimi tính m²; đây
  đúng là hành vi mong muốn nhưng tình huống kiểm đã lỗi thời. **Một lần Mimi tính sai: 0,106 × 15,6 = 1,65 m²
  (đúng là 16,54).** Nên cho `get_product_details` trả sẵn m²/cuộn từ cột mới thay vì để model tự nhân.
- `cung-loai-gia-re`: trượt 3/3, gợi ý mẫu Hàn Quốc (#38) cho "cùng loại giá rẻ"; chưa rõ có phải do đổi đơn vị ở bước
  kích thước cuộn hay không.
- Form /yeu-cau-bao-gia vẫn để email không bắt buộc và không có dòng nhắc.
