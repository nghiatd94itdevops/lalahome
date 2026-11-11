# 2026-10-27: Mimi thay robot trong trợ lý AI (1/3 của việc gắn bộ nhận diện LaLaHome)

## Goal
Bro thêm `LaLaHome/`, bộ nhận diện linh vật **Mimi**: mèo chữ L ghép mảng vải và giấy, có 33 trạng thái, mùa, lễ hội và cosplay. Bộ này có sẵn `mimi-svg.js` và `mimi-bot.js` với API `new MimiBot(el, opts)` và `setState()`.

**Bro chọn:**
- Mimi thay robot trong trợ lý AI;
- gắn thêm ở trang chủ (theo giờ), trang Giới thiệu, trạng thái trống và lỗi, phản hồi sau thao tác;
- tính cách Thân thiện.

**Chia 3 PR:**
1. *(PR này)* trợ lý AI;
2. trang chủ theo giờ và trang Giới thiệu;
3. trạng thái trống, lỗi, và phản hồi sau thao tác.

## Success criteria
- **M1.** Robot cũ không còn ở đâu. Nút mở trợ lý (desktop) và tab "Trợ lý AI" (điện thoại) là Mimi sống, đúng màu.
- **M2.** Mimi đứng cạnh khung chat, không đè khung, nằm trong màn hình, đáy ngang đáy khung; đóng chat thì biến mất; trên điện thoại không hiện.
- **M3.** Trạng thái theo từng bước:
  - mở chat → `greet`, khoảng 3 giây sau → `idle`;
  - đang gõ → `listening`;
  - gửi → `thinking` → `searching`;
  - có sản phẩm khớp → `happy`; chỉ có gợi ý → `wink`; không có sản phẩm → `sad`;
  - khách cảm ơn → `love`; lỗi → `error`;
  - 60 giây không thao tác → `sleep`.
- **M4.** Mỗi câu trả lời và thanh tiêu đề có mặt Mimi **tĩnh**: trong danh sách tin nhắn không chạy engine animation nào.
- **M5.** Không lỗi console. Giao diện điện thoại không hồi quy.

## Changes
- **Mới: `frontend/src/components/Mimi.jsx`:**
  - nạp thẳng `LaLaHome/mimi-svg.js` và `mimi-bot.js`, không sao chép; bộ nhận diện được cập nhật thì site nhận ở lần build sau;
  - `Mimi`: tạo `MimiBot` một lần (`persona: friendly`, `bubble: false` vì bro đã bỏ bong bóng trên đầu), chuyển tiếp `state`/`season`/`festival`/`celebrate`, `destroy()` khi gỡ, có `data-state`;
  - `MimiFace`: mặt tĩnh dựng bằng `buildSVG` + `buildFace` của bộ nhận diện, cắt khung quanh đầu, màu lấy từ `deriveColors`.
- **`vite.config.js`:** `server.fs.allow` thêm thư mục `LaLaHome`, để dev server đọc được file ngoài thư mục app. Bản build không cần cấu hình này.
- **`ChatAssistant.jsx`:**
  - `useMimiMood` (khoảnh khắc `MOMENT_MS = 3000`, `THINK_BEFORE_SEARCH_MS = 1500`, `DOZE_AFTER_MS = 60000`) và `answerMoment()`;
  - Mimi sống ở nút mở và cạnh khung chat;
  - `MimiFace` ở thanh tiêu đề và cạnh mỗi câu trả lời.
- **`Shell.jsx`:** tab "Trợ lý AI" dùng `Mimi`.
- **Xoá:** `components/AiRobot.jsx` và toàn bộ CSS của robot (bro đã duyệt "xoá robot cũ").
- **`styles.css`:** kích thước của từng vị trí, `.chat-mimi-stand` (rộng 180px); trên điện thoại ẩn Mimi đứng và bỏ kiểu icon nét cho Mimi ở tab.
- **Bundle JS:** 351 KB → 435 KB (105 KB → 133 KB sau gzip), do bộ Mimi.

## Result
`mimi-test.mjs` (Edge; `/chat` giả lập trong trang, trả lời sau 2,6 giây):
```
PASS the robot is gone everywhere: 0 robot elements
PASS launcher shows a live Mimi: mm-root in launcher
PASS opening the chat: Mimi greets beside the panel: greet
PASS she stands right of the panel, inside the screen, level with its bottom: {"gap":10,"right":606,"bottomDiff":0,"w":180}
PASS after the greeting she goes back to idle: idle
PASS typing → listening, sent → thinking → searching, a match → happy: {"typing":"listening","thinking":"thinking","searching":"searching","reaction":"happy"}
PASS only suggestions → wink: {"typing":"listening","thinking":"thinking","searching":"searching","reaction":"wink"}
PASS nothing found → sad: {"typing":"listening","thinking":"thinking","searching":"searching","reaction":"sad"}
PASS a thank-you → love: {"typing":"listening","thinking":"thinking","searching":"searching","reaction":"love"}
PASS an error → error: {"typing":"listening","thinking":"thinking","searching":"searching","reaction":"error"}
PASS every assistant message has a still Mimi face (no live engines in the list): {"bubbles":5,"faces":5,"liveInMessages":0,"header":true}
PASS closing the chat removes the standing Mimi: none
PASS 390px phone tab shows Mimi in her own colours: {"w":34,"stroke":"none","fill":"rgb(0, 0, 0)"}
PASS 390px phone: no standing Mimi over the full-screen chat, no sideways scroll: {"stand":"none","overflow":0}
PASS 360px phone tab shows Mimi in her own colours: {"w":34,"stroke":"none","fill":"rgb(0, 0, 0)"}
PASS 360px phone: no standing Mimi over the full-screen chat, no sideways scroll: {"stand":"none","overflow":0}
PASS a minute without activity → sleep: sleep
PASS no console errors: none
ALL PASS
```

**Hồi quy giao diện điện thoại:** `mobile-regress.mjs`, viết lại từ bộ 48 bài ngày 15/10 vì bản scratch đã bị dọn; gồm 30 bài cốt lõi.
```
ALL PASS
30 PASS
```

**Chưa kiểm:**
- test hủy mic (`voice-cancel-test`): bản scratch đã mất, chưa viết lại. Code mic không đổi trong PR này.
- Máy tắt hoạt ảnh: bộ Mimi tự xử lý (`.mm-reduce` làm chậm nhịp thở, tắt hiệu ứng). Mình không ghi đè.

Status: **DONE** cho M1–M5.
