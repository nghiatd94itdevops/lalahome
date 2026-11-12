# 2026-11-12 — Layout trang Trợ lý AI và đầu khung chat dùng chung

**Status:** DONE (kiểm bằng Chrome headless, 5 bề ngang; chưa xem trên máy thật)

## Goal

Rà layout theo ảnh người dùng gửi và sửa các lỗi nhìn thấy. Đầu khung của trang Trợ lý AI khác cửa sổ chat nổi →
đổi trang cho **giống đầu khung của cửa sổ nổi** (ảnh người dùng gửi lại: mặt Mimi nhỏ, "🎤 Nói với Mimi", 🔇,
Làm mới).

Hai lần đầu mình hiểu ngược: lần một gỡ cửa sổ nổi, lần hai đổi cửa sổ nổi theo trang. Cả hai đã hoàn lại.
Không làm: đổi thân khung chat, đổi các trang khác, lọc tiếng ồn micro.

## Success criteria

1. Đầu khung trang có cùng mặt Mimi và cùng dãy nút như cửa sổ nổi, chỉ bớt "Mở rộng" và "×"; không phần tử nào bị
   cắt ở 1800/1280/1024/768/390px.
2. Nút "Liên hệ" không đè khung chat hay kệ sản phẩm từ 768px trở lên.
3. Chữ gợi ý trong ô nhập không bị cụt ở 390 và 768px.
4. Các trang khác không có lỗi mới; build qua.

## Thay đổi

- `components/ChatAssistant.jsx`: thêm `AssistantHead` dùng chung (MimiFace, Nói với Mimi, đọc to, [Mở rộng], Làm mới, [×]);
  cửa sổ nổi truyền `onExpand`/`onClose`, trang thì không. Rút gọn chữ gợi ý.
- `pages/Assistant.jsx`, `App.jsx`: trang dùng `AssistantHead`, nhận `onTalk` để mở màn hình Mimi.
- `styles.css`: `.chat-head-mimi` dùng chung (đẩy các nút sang phải), bỏ các luật cũ của đầu khung trang
  (`assistant-head`, `chat-head-text`); trang chừa lề dưới 5rem cho nút Liên hệ.

## Result

```
npm run build: ✓ built in 1.25s

head_check2.mjs (trang vs cửa sổ nổi)
PASS 1800  PASS 1280  PASS 1024  PASS 768  PASS 390   all widths passed
  1280 page  {"mimiFace":36,"labels":["🎤 Nói với Mimi","Bật đọc câu trả lời","Làm mới"],"cut":[]}
  1280 panel {"mimiFace":36,"labels":["🎤 Nói với Mimi","Bật đọc câu trả lời","Mở rộng toàn màn hình","Làm mới","Đóng trợ lý"],"cut":[]}

overlap_check.mjs (/tro-ly)
1800/1280/1024/768: birdhouse shown, covers [], placeholderFits true
390: birdhouse hidden, placeholderFits true

layout_audit.mjs (8 trang × 5 bề ngang), trước khi sửa:
  CLIPPED 66–162px button.chat-head-action "Cuộc trò chuyện mới" (/tro-ly, mọi bề ngang)
sau khi sửa chỉ còn hai chỗ cố ý, có từ trước:
  CLIPPED 16px img by span.chat-product-photo   (ảnh sản phẩm cắt khung vuông)
  button.chip ở /san-pham 390px                   (dải chip vuốt ngang)
```

## Để sau

- Script kiểm nằm ở scratchpad; repo chưa có test frontend.
