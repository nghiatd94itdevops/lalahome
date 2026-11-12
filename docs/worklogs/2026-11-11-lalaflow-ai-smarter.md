# 2026-11-11 — Trợ lý AI thông minh hơn: bộ kiểm tra + sửa hướng dẫn

**Status:** DONE (31/32; còn 1 lượt trượt ở `cung-loai-gia-re`, xem cuối)

## Goal

Người dùng: "làm sao cho con AI thông minh hơn". Duyệt Bước 1 (bộ kiểm tra) + Bước 2 (sửa hướng dẫn). Không đổi model,
không đổi cơ sở dữ liệu.

## Success criteria

1. Bộ kiểm tra chạy lại được, ~15 tình huống từ câu hỏi thật, chấm tự động; phiên `zztest-eval-…`.
2. Đo trước khi sửa (mốc) và sau khi sửa: tỉ lệ đạt tăng, không tình huống nào tệ đi.
3. Câu trả lời không có `**`, ≤120 từ.

## Thay đổi

- `lalaflow/scripts/chat_eval.py` (mới): 16 tình huống × 2 lần; chấm nội dung + hình thức; `--only`, `--runs`, `--json`.
- `lalaflow/backend/chat.js`:
  - Quy tắc 6: văn bản trơn, không markdown, ≤90 từ, tối đa 3 sản phẩm.
  - Quy tắc 9: không làm thơ/truyện/dịch/bài tập/code.
  - Quy tắc 10–16 mới, mỗi quy tắc ứng một lỗi trong nhật ký: giọng nói nhận dạng sai, gợi ý trước hỏi sau (tối đa 1 câu),
    tính số cuộn từ kích thước trong thông số, tiêu chí ở nhóm hàng khác, "cùng loại" giữ tầm giá, lỗi kết nối,
    không nhắc ghi chú dữ liệu mẫu.
  - Tìm kiếm: `featureMatchesElsewhere()` — khi không mẫu nào trong nhóm khách nói khớp đủ, trả thêm
    `other_category_matches` (mẫu nhóm khác có tiêu chí khách cần). Trước đây AI lọc `category: "giấy dán tường"` nên
    vải dán tường chống cháy cấp A bị loại trước khi AI thấy. Export `loadCatalog`, `searchProducts` để kiểm tra riêng.

## Verification

Mốc ban đầu (code cũ), chấm lại sau khi sửa 1 biểu thức chấm oan (`khong-bia-m2`: AI nói "chưa thấy thông số" — đúng,
nhưng biểu thức không có "chưa thấy"):

```
Nội dung đạt: 24/32 | Hình thức đạt: 2/32 | thời gian trung vị 24.7s
```

Sau lần sửa thứ nhất (chỉ hướng dẫn) — có 2 tình huống tệ đi nên chưa đạt tiêu chí 2:

```
Nội dung đạt: 27/32 | Hình thức đạt: 32/32 | trung vị 24.4s
chong-chay 1/2 → 0/2 (AI lọc category "giấy dán tường" → không thấy vải); ngoai-pham-vi 1/2 → 0/2 (làm thơ)
```

Kiểm tra riêng phần tìm kiếm (trong container, dữ liệu thật):

```
A category=giấy dán tường  | full 0 | other_category ['61:chống cháy','62:chống cháy','63:chống cháy']
B no category              | full 0 | other_category ['67:chống cháy','68:chống cháy','69:chống cháy']
C full match exists (A4)   | full 1 | other_category []
D only type, no feature    | full 25 | other_category []
E feature in same category | full 18 | other_category []
```

Bản cuối:

```
Nội dung đạt: 31/32 | Hình thức đạt: 31/32 | thời gian trung vị 24.4s, chậm nhất 25.5s
```

| Tình huống | Trước | Sau |
|---|---|---|
| cung-loai-gia-re | 0/2 | 1/2 |
| chong-chay | 1/2 | 2/2 |
| tinh-so-cuon | 0/2 | 2/2 |
| ngoai-pham-vi | 1/2 | 2/2 |
| tu-van-chung | 0/2 | 2/2 |
| 11 tình huống còn lại | 22/22 | 22/22 |

## Còn lại

- `cung-loai-gia-re` lần 2: gợi ý Soho 65.000đ (giá rẻ nhưng khác dòng Decal của D127). Đáp án đang loại mọi mẫu Hàn Quốc
  kể cả mẫu 65.000đ — tiêu chí hơi chặt; giữ nguyên, không sửa tiêu chí cho khớp kết quả.
- **Mỗi câu trả lời ~24 giây** (trước và sau như nhau) — quá chậm cho nói chuyện rảnh tay với Mimi. Chưa điều tra.
- Bộ kiểm tra gọi AI thật (~100 lượt hôm nay), ghi vào `chat_logs` với phiên `zztest-eval-…`.
