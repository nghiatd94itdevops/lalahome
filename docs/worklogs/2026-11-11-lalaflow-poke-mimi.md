# 2026-11-11 — Chọc Mimi: đổi biểu cảm + bong bóng câu vui, chọc thì tỉnh ngủ

**Status:** DONE

## Goal

Người dùng thấy Mimi ngủ sau một lúc ở màn hình nói chuyện; muốn bấm vào Mimi ("chọc") thì Mimi đổi biểu cảm
(thẹn thùng…) và hiện bong bóng câu vui. Giữ việc ngủ khi để yên 60 giây; chọc thì tỉnh. Bong bóng chỉ hiện khi chọc
(không bật bong bóng thường trực của bộ kit — trước đây chủ shop dặn không có).

## Success criteria

1. Bấm Mimi ở màn hình nói chuyện, cạnh khung chat (desktop), trang chủ, trang Giới thiệu → đổi biểu cảm + bong bóng, tắt sau ~2,5s.
2. Đang ngủ mà bị chọc → tỉnh với câu riêng, không ngủ lại ngay (đếm lại 60s).
3. Chọc liên tiếp → câu đổi, không lặp ngay; lần 4 "chóng mặt", lần 7 "party" kèm pháo giấy.
4. Là nút thật có nhãn "Chọc Mimi"; build qua; không lỗi console.

## Thay đổi

- `components/Mimi.jsx`: `PokableMimi` (nút bọc Mimi, tự chọn phản ứng, bong bóng, pháo giấy ở lần 7) + bảng câu thoại.
- `components/useAssistantChat.js`: `pokeMimi: mood.flash` — chọc là "khoảnh khắc" mới nên đếm lại giờ ngủ.
- `MimiConversation.jsx`, `ChatAssistant.jsx` (Mimi đứng cạnh khung chat), `pages/Home.jsx`, `pages/Company.jsx`: dùng `PokableMimi`.
- `styles.css`: `.mimi-poke*`; `.mimi-talk-stage` chừa 3.6rem phía trên vì vùng cuộn cắt bong bóng.
- Không làm: Mimi nhỏ ở đầu trang Trợ lý (64px, sát mép — bong bóng bị cắt), Mimi trong nút/ tab/ thông báo.

Ghi chú: một phiên khác đang sửa chưa commit cùng các file `ChatAssistant.jsx`, `MimiConversation.jsx`,
`useAssistantChat.js`, `styles.css` (âm thanh iPhone). Phần này chỉ thêm dòng import/thẻ `<PokableMimi>`/`pokeMimi` và
khối CSS cuối file.

## Verification

Chromium headless qua CDP, màn hình Mimi với trình duyệt chặn âm thanh (Mimi không nói/nghe → để yên):

```
start: {'state': 'greet', 'bubble': ''} | tap button: True
after 63s idle: {'state': 'sleep', 'bubble': ''}
poke while asleep: {'state': 'surprised', 'bubble': 'Á! Mimi đâu có ngủ… chỉ nhắm mắt suy nghĩ thôi 😅'}
4s later: {'state': 'idle', 'bubble': ''}
streak poke 1: surprised 'Ơ! Ai vừa chọc Mimi đó?'
streak poke 2: wink 'Chọc Mimi là phải ghé xem giấy đó nha 😜'
streak poke 3: happy 'Meo~ Mimi thích được vuốt ve lắm!'
streak poke 4: confused 'Thôi thôi, chóng mặt quá rồi nè 😵'
streak poke 5: love 'Hí hí, nhột quá à 🙈'
streak poke 6: surprised 'Ơ! Ai vừa chọc Mimi đó?'
streak poke 7: party 'Bạn chọc giỏi ghê! Giờ mình đi chọn giấy nha? 🎉'
20s after pokes (should not be asleep): {'state': 'idle', 'bubble': ''}
keyboard reachable: BUTTON Chọc Mimi
home page poke: {'state': 'love', 'bubble': 'Hí hí, nhột quá à 🙈'}
console: []
npm run build: ✓ built in 1.24s
Hồi quy D (đường quay lại Mimi, desktop + phone): đạt, console []
```

Lần chạy đầu đọc sai Mimi (trang chủ nằm dưới lớp phủ đứng trước trong DOM) — lỗi bộ kiểm tra, sửa bộ chọn.
Ảnh đầu tiên cho thấy bong bóng bị cắt mép trên ở màn hình nói chuyện → thêm khoảng trống; ảnh sau hiện đủ.
