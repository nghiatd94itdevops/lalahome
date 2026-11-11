# 2026-10-19: Robot linh vật cho trợ lý AI

## Goal
Bro muốn đưa robot trong ảnh `pngtree-friendly-robot-…webp` vào trợ lý AI, có chuyển động.

**Vì sao không dùng ảnh đó:**
- Ảnh là bản xem trước của pngtree: chữ watermark in mờ khắp ảnh.
- Nền ô caro là điểm ảnh in cứng, không trong suốt. File là WebP VP8 không có kênh alpha; 4 góc đo được màu 255 và 229.
- Thân robot trắng và xám trùng màu ô caro, nên không tách nền sạch được.
- Dùng trên trang bán hàng còn có rủi ro bản quyền.

**Bro chọn:**
- tự vẽ robot SVG cùng phong cách (trắng xanh, màn hình mặt, ăng-ten, bong bóng chat tím);
- hiện ở cả 3 chỗ: nút mở trợ lý, đứng cạnh khung chat, avatar trong khung chat.

## Success criteria
- **R1.** Nút "Trợ lý AI" (desktop) và tab "Trợ lý AI" (điện thoại) hiện robot với màu riêng của nó, có animation nhún.
- **R2.** Desktop: mở chat thì robot đứng bên phải khung chat, chân ngang đáy khung, không đè khung, nằm gọn trong màn hình ở 1280px và 760px; tay vẫy. Khi AI đang trả lời, bong bóng nhấp nháy. Đóng chat hoặc trên điện thoại thì không có robot đứng.
- **R3.** Thanh tiêu đề và mọi câu trả lời của AI (kể cả lời chào và lúc đang gõ) có avatar robot; ở 390px và 360px không cuộn ngang.
- **R4.** Khi bật "giảm chuyển động" (`prefers-reduced-motion: reduce`), mọi bộ phận robot đứng yên.
- **R5.** Không lỗi console; test mobile (48 bài) và test hủy mic vẫn PASS.

## Changes
**Mới: `frontend/src/components/AiRobot.jsx`**, một robot SVG nội tuyến:
- `part="head"` cắt lấy phần đầu, dùng cho nút và avatar; `part="full"` có thân, tay vẫy và 2 bong bóng;
- `mood="thinking"` làm các chấm trong bong bóng nhấp nháy;
- id của gradient lấy từ `useId()`, để nhiều robot trên cùng trang không trùng id;
- `aria-hidden` vì chỉ để trang trí.

**`components/ChatAssistant.jsx`:**
- robot thay icon bong bóng trên nút mở trợ lý;
- robot đứng cạnh khung chat khi đang mở (`mood` theo `busy`);
- đầu robot trên thanh tiêu đề;
- `AssistantSays` đặt avatar cạnh mỗi câu trả lời và lúc đang gõ. Các `.chat-bubble` giữ nguyên class.

**`components/Shell.jsx`:** tab "Trợ lý AI" dùng `AiRobot`; bỏ icon `assistant` trong `TAB_ICONS`.

**`styles.css`:**
- keyframes: nhún, chớp mắt, vẫy tay (4 lần khi mở), bong bóng lơ lửng, chấm nhấp nháy, xuất hiện;
- kích thước của từng vị trí;
- `.chat-robot-stand` tính vị trí theo chính công thức của `.chat-panel`;
- trên điện thoại: ẩn robot đứng, và tab robot dùng màu riêng (bỏ `stroke` và `fill` mà `.tab svg` áp cho các icon nét);
- `prefers-reduced-motion`: tắt toàn bộ animation của robot;
- `.chat-head strong` không xuống dòng.

**Chỉnh sau khi xem ảnh chụp:**
- ở tư thế nghỉ, bàn tay vẫy bị đầu che, nên kéo tay ra xa;
- ngón tay trắng không thấy trên nền kem, nên đổi sang màu tối;
- tiêu đề "Trợ lý AI" xuống 2 dòng, nên thu nhỏ avatar và cấm xuống dòng.

## Result
`robot-test.mjs` (Edge; `/chat` giả lập trong trang, trả lời sau 2 giây):
```
PASS 1280px R1 launcher shows the robot, bobbing: robot-bob/running
PASS 1280px R2 robot stands right of the open panel, inside the screen: panel 16-416, robot 430-580 top 553 bottom 740 vs panel bottom 740
PASS 1280px R2 it waves: robot-wave/running
PASS 1280px R3 header has the robot: chat-head-robot present
PASS 1280px R2 while the answer is coming, the bubbles blink: {"stand":true,"typingAvatar":true} robot-dot/running
PASS 1280px R3 every assistant message has the robot beside it: {"bubbles":2,"withAvatar":2,"stillThinking":false}
PASS 1280px R2 closing the panel removes the standing robot: gone
PASS 760px R1 launcher shows the robot, bobbing: robot-bob/running
PASS 760px R2 robot stands right of the open panel, inside the screen: panel 16-416, robot 430-580 top 433 bottom 620 vs panel bottom 620
PASS 760px R2 it waves: robot-wave/running
PASS 760px R3 header has the robot: chat-head-robot present
PASS 760px R2 while the answer is coming, the bubbles blink: {"stand":true,"typingAvatar":true} robot-dot/running
PASS 760px R3 every assistant message has the robot beside it: {"bubbles":2,"withAvatar":2,"stillThinking":false}
PASS 760px R2 closing the panel removes the standing robot: gone
PASS 390px R1 assistant tab shows the robot in its own colours: {"w":36,"stroke":"none"}
PASS 390px R2/R3 phone: no standing robot, avatars shown, nothing scrolls sideways: {"stand":"none","overflow":0,"pageOverflow":0,"avatars":2}
PASS 360px R1 assistant tab shows the robot in its own colours: {"w":36,"stroke":"none"}
PASS 360px R2/R3 phone: no standing robot, avatars shown, nothing scrolls sideways: {"stand":"none","overflow":0,"pageOverflow":0,"avatars":2}
PASS R4 reduced motion: no robot part animates: 0 animated elements
PASS R5 no console errors: none
ALL PASS
```

**Hồi quy:**
- `mobile-test.mjs` → `ALL PASS`, 48 PASS;
- `voice-cancel-test.mjs` → `ALL PASS`.

**Phát hiện về máy test:** Edge trên máy này báo `prefers-reduced-motion: reduce` ngay từ đầu (`matchMedia` trả `true`), có lẽ vì Windows đang tắt "Animation effects". Lúc đó robot đứng yên đúng như thiết kế (R4). Bài test đặt `no-preference` để kiểm animation.

Status: **DONE** cho R1–R5.

**Chưa kiểm:**
- điện thoại thật;
- giao diện trên Safari/iOS (SVG `transform-box: view-box`).

## Follow-ups
- Nếu bro mở trên máy này mà robot không chuyển động: vào Settings → Accessibility → Visual effects → Animation effects và bật lên. Code không lỗi; đó là cài đặt giảm chuyển động của Windows.

---

# Cập nhật 1: "robot đứng cạnh khung chat không cử động"

**Nguyên nhân chính:** Windows trên máy bro đang tắt "Animation effects" (đọc bằng `SystemParametersInfo(SPI_GETCLIENTAREAANIMATION)` → `False`). Edge vì vậy báo `prefers-reduced-motion: reduce`, và bản đầu tắt **mọi** animation của robot.

**Nguyên nhân phụ:** chuyển động cũ quá nhạt: chỉ nhún 3px, và vẫy tay 4 lần rồi đứng yên.

**Đã đổi:**
- **`AiRobot.jsx`:**
  - thêm bóng đổ dưới chân (`robot-shadow`); viewBox của bản full cao thêm (`0 0 120 158`);
  - class `robot-antenna-tip` và `robot-core` để làm phát sáng;
  - thêm `mood="happy"`.
- **`styles.css`, chuyển động của robot đứng:**
  - xuất hiện có nảy (`robot-arrive`);
  - bay lơ lửng 7px kèm lắc ±2° (`robot-hover`), bóng đổ co giãn theo;
  - đầu nghiêng qua lại (`robot-tilt`);
  - vẫy tay mỗi 5 giây, lặp mãi (`robot-wave`);
  - đèn ăng-ten phát sáng xen kẽ; nút nguồn ở ngực phập phồng;
  - hai bong bóng lần lượt bật ra rồi thu lại (`robot-pop`).
- **Khi AI đang nghĩ:** đầu nghiêng như đang suy nghĩ, chấm nảy, ăng-ten nhấp nháy nhanh.
- **Khi có câu trả lời:** nhảy lên một cái và vẫy tay (`robot-hop`).
- **Giảm chuyển động:** chỉ tắt những gì dịch chỗ, xoay hoặc phóng to; vẫn giữ chớp mắt, đèn ăng-ten, nút nguồn đổi màu và chấm mờ dần. Các selector `.is-thinking` và `.is-happy` (độ ưu tiên CSS cao hơn) được liệt kê riêng, nếu không chúng vẫn chạy ở chế độ này.
- **`ChatAssistant.jsx`:** `cheering` bật trong 1,2 giây (`CHEER_MS`) khi câu trả lời tới, robot đứng dùng `mood="happy"`.

## Result
Đo chuyển động thật (`robot-film.mjs`: 13 khung hình cách nhau 400ms, đếm số điểm ảnh đổi màu giữa hai khung liên tiếp):
```
no-preference: pixels changed between consecutive frames: 5744, 5361, 2890, 5949, 7364, 4619, 2809, 6718, 8020, 3792, 4880, 6057
reduce: pixels changed between consecutive frames: 256, 70, 258, 246, 262, 248, 68, 359, 115, 280, 230, 250
```
Dải khung hình cho thấy robot bay lên xuống, nghiêng đầu, vẫy tay ở nhiều góc, và hai bong bóng lần lượt bật ra.

`robot-test.mjs`:
```
PASS 1280px R1 launcher shows the robot, bobbing: robot-bob/running
PASS 1280px R2 robot stands right of the open panel, inside the screen: panel 16-416, robot 430-580 top 543 bottom 740 vs panel bottom 740
PASS 1280px R2 it hovers, tilts, waves, pops bubbles and glows: {".robot-bob":true,".robot-head":true,".robot-arm-wave":true,".robot-bubble-left":true,".robot-shadow":true,".robot-antenna-tip":true,".robot-core":true}
PASS 1280px R3 header has the robot: chat-head-robot present
PASS 1280px R2 while the answer is coming, the bubbles blink: {"stand":true,"typingAvatar":true} robot-dot/running
PASS 1280px R2 when the answer arrives it hops for joy: is-happy true, robot-hop/running
PASS 1280px R3 every assistant message has the robot beside it: {"bubbles":2,"withAvatar":2,"stillThinking":false}
PASS 1280px R2 closing the panel removes the standing robot: gone
PASS 760px R1 launcher shows the robot, bobbing: robot-bob/running
PASS 760px R2 robot stands right of the open panel, inside the screen: panel 16-416, robot 430-580 top 423 bottom 620 vs panel bottom 620
PASS 760px R2 it hovers, tilts, waves, pops bubbles and glows: {".robot-bob":true,".robot-head":true,".robot-arm-wave":true,".robot-bubble-left":true,".robot-shadow":true,".robot-antenna-tip":true,".robot-core":true}
PASS 760px R3 header has the robot: chat-head-robot present
PASS 760px R2 while the answer is coming, the bubbles blink: {"stand":true,"typingAvatar":true} robot-dot/running
PASS 760px R2 when the answer arrives it hops for joy: is-happy true, robot-hop/running
PASS 760px R3 every assistant message has the robot beside it: {"bubbles":2,"withAvatar":2,"stillThinking":false}
PASS 760px R2 closing the panel removes the standing robot: gone
PASS 390px R1 assistant tab shows the robot in its own colours: {"w":36,"stroke":"none"}
PASS 390px R2/R3 phone: no standing robot, avatars shown, nothing scrolls sideways: {"stand":"none","overflow":0,"pageOverflow":0,"avatars":2}
PASS 360px R1 assistant tab shows the robot in its own colours: {"w":36,"stroke":"none"}
PASS 360px R2/R3 phone: no standing robot, avatars shown, nothing scrolls sideways: {"stand":"none","overflow":0,"pageOverflow":0,"avatars":2}
PASS R4 reduced motion: only blink and glow remain, nothing moves: running: robot-glow, robot-blink, robot-core-fade
PASS R5 no console errors: none
ALL PASS
```

**Lỗi trong chính bài test:**
- Headless Edge chuyển tab sang `hidden` sau khi tải lại trang. Animation và bộ hẹn giờ dừng, nên ở cỡ 760px robot bị "kẹt" ở khung đầu của animation xuất hiện (thu nhỏ 0,6 lần). Sửa bằng `Emulation.setFocusEmulationEnabled` và `Page.bringToFront`.
- Lần đo đầu chờ chưa hết 0,6 giây animation xuất hiện.

**Hồi quy:** test mobile `ALL PASS` (48); test hủy mic `ALL PASS`.

**Để bro thấy đầy đủ chuyển động trên máy này:** Settings → Accessibility → Visual effects → bật Animation effects, rồi tải lại trang. Khi tắt, robot vẫn chớp mắt và phát sáng, nhưng không bay hay vẫy.

---

# Cập nhật 2: vẫy tay cả khi máy tắt hoạt ảnh; bỏ bong bóng trên đầu

**Bro yêu cầu:**
1. "Thêm vẫy tay, đừng để đứng yên." Máy bro vẫn tắt Animation effects, nên trước đó chỉ thấy chớp mắt và phát sáng.
2. Bỏ hai bong bóng tin nhắn trên đầu robot.

**Đã đổi:**
- **Chế độ giảm chuyển động:** robot vẫy tay 3 lần mỗi khi mở chat (`robot-wave-hello`), và 2 lần mỗi khi có câu trả lời (`robot-wave-cheer`). Hai keyframe giống nhau nhưng khác tên, để animation chạy lại khi đổi class. Đây là chuyển động ngắn, có điểm dừng, chỉ xảy ra khi người dùng thao tác. Bay, lắc và nghiêng đầu vẫn tắt.
- **Bỏ bong bóng:**
  - xoá nhóm `robot-bubbles` khỏi `AiRobot.jsx`; viewBox bản full thành `0 28 120 130`, cắt khoảng trống phía trên;
  - xoá CSS `robot-pop`, `robot-dot`, `robot-dot-fade`;
  - "đang nghĩ" giờ là đầu nghiêng (`robot-ponder`) cùng đèn ăng-ten nhấp nháy nhanh;
  - trong khung chat vẫn còn dấu "…" cạnh avatar.

**Result** (`robot-test.mjs`, đã đổi bài kiểm bong bóng thành bài kiểm đầu nghiêng; thêm "no speech bubbles" và "reduced motion still waves"):
```
PASS 1280px R1 launcher shows the robot, bobbing: robot-bob/running
PASS 1280px R2 robot stands right of the open panel, inside the screen: panel 16-416, robot 430-580 top 578 bottom 740 vs panel bottom 740
PASS 1280px R2 it hovers, tilts, waves and glows: {".robot-bob":true,".robot-head":true,".robot-arm-wave":true,".robot-shadow":true,".robot-antenna-tip":true,".robot-core":true}
PASS 1280px R3 header has the robot: chat-head-robot present
PASS 1280px R2 while the answer is coming, it tilts its head as if thinking: {"stand":true,"typingAvatar":true} robot-ponder/running
PASS 1280px R2 no speech bubbles above the robot: 0 bubble parts
PASS 1280px R2 when the answer arrives it hops for joy: is-happy true, robot-hop/running
PASS 1280px R3 every assistant message has the robot beside it: {"bubbles":2,"withAvatar":2,"stillThinking":false}
PASS 1280px R2 closing the panel removes the standing robot: gone
PASS 760px R1 launcher shows the robot, bobbing: robot-bob/running
PASS 760px R2 robot stands right of the open panel, inside the screen: panel 16-416, robot 430-580 top 458 bottom 620 vs panel bottom 620
PASS 760px R2 it hovers, tilts, waves and glows: {".robot-bob":true,".robot-head":true,".robot-arm-wave":true,".robot-shadow":true,".robot-antenna-tip":true,".robot-core":true}
PASS 760px R3 header has the robot: chat-head-robot present
PASS 760px R2 while the answer is coming, it tilts its head as if thinking: {"stand":true,"typingAvatar":true} robot-ponder/running
PASS 760px R2 no speech bubbles above the robot: 0 bubble parts
PASS 760px R2 when the answer arrives it hops for joy: is-happy true, robot-hop/running
PASS 760px R3 every assistant message has the robot beside it: {"bubbles":2,"withAvatar":2,"stillThinking":false}
PASS 760px R2 closing the panel removes the standing robot: gone
PASS 390px R1 assistant tab shows the robot in its own colours: {"w":36,"stroke":"none"}
PASS 390px R2/R3 phone: no standing robot, avatars shown, nothing scrolls sideways: {"stand":"none","overflow":0,"pageOverflow":0,"avatars":2}
PASS 360px R1 assistant tab shows the robot in its own colours: {"w":36,"stroke":"none"}
PASS 360px R2/R3 phone: no standing robot, avatars shown, nothing scrolls sideways: {"stand":"none","overflow":0,"pageOverflow":0,"avatars":2}
PASS R4 reduced motion: only blink, glow and the greeting wave remain: running: robot-glow, robot-blink, robot-core-fade, robot-wave-hello
PASS R4 reduced motion: the robot still waves hello, a set number of times: robot-wave-hello x3
PASS R5 no console errors: none
ALL PASS
```
Dải khung hình ở chế độ giảm chuyển động: tay vẫy rõ trong khoảng 4 giây đầu, sau đó chỉ còn chớp mắt và phát sáng.
```
no-preference: pixels changed between consecutive frames: 4492, 4790, 2561, 3774, 5275, 4206, 2051, 5123, 5286, 3732, 4210, 5840
reduce: pixels changed between consecutive frames: 1014, 396, 1502, 1517, 1438, 1416, 747, 377, 281, 280, 238, 240
```
Test mobile: `ALL PASS` (48).
