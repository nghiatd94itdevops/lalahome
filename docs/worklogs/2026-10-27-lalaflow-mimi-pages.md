# 2026-10-27: Mimi trên trang chủ (theo giờ) và trang Giới thiệu (2/3)

## Goal
- **Trang chủ:** dải "Mimi lúc này" ngay sau dãy số liệu.
  - Mimi làm việc theo giờ Việt Nam, dùng 12 mốc giờ của bộ nhận diện (00:00 Nửa đêm … 22:00 Xem phim).
  - Trang phục theo mùa; lễ hội khi tới dịp (Tết, Trung thu, Halloween).
  - Nút "Hỏi Mimi" mở trợ lý AI.
- **Trang Giới thiệu:** mục "Gặp Mimi" có lời tự giới thiệu lấy từ bộ nhận diện và 3 tư thế gắn với việc Mimi làm trên site (chào, tra giúp, xong việc).

**Không làm:**
- tự bật lễ hội "Sale", vì chưa có quy tắc ngày;
- chỉnh nội dung qua CMS: lời giới thiệu viết thẳng trong code.

## Success criteria
- **H1.** Mốc giờ, mùa và lễ hội tính theo giờ Việt Nam, kể cả khi máy khách ở múi giờ khác. Kiểm ở 6 thời điểm cố định.
- **H2.** "Hỏi Mimi" (trang chủ) và "Trò chuyện với Mimi" (Giới thiệu) mở trợ lý AI.
- **H3.** Trang Giới thiệu có 3 Mimi sống: `greet`, `searching`, `success`.
- **H4.** Ở 390px và 360px không cuộn ngang; không lỗi console.

## Changes
**`components/Mimi.jsx`:**
- `mimiForNow()`: lấy các trạng thái có `time` từ `MimiBot.STATES` của bộ nhận diện, chọn mốc gần nhất đã bắt đầu, kèm `label` và câu thoại `b` của mốc đó;
- `shopClock()`: dùng `Intl` với `Asia/Ho_Chi_Minh`;
- mùa theo tháng; lễ hội theo bảng `TET_DATES` và `MID_AUTUMN_DATES` 2026–2030 (bộ nhận diện không có âm lịch; sau 2030 phải bổ sung bảng); Halloween từ 24/10;
- `useMimiNow()` cập nhật mỗi phút;
- `Mimi` gắn thêm `data-season` và `data-festival`.

**`App.jsx`:** thêm `openAssistant` vào props chung của các trang.

**`pages/Home.jsx`:** component `MimiNow`.

**`pages/Company.jsx`:** `MeetMimi` và `MIMI_POSES`.

**`styles.css`:** `.mimi-now` và `.meet-mimi-*`; trên điện thoại xếp dọc và căn giữa.

## Result
`mimi-pages-test.mjs` (đồng hồ trang được cố định bằng `Page.addScriptToEvaluateOnNewDocument`):
```
PASS home Oct 27 11:20 VN: laptop, autumn, Halloween: {"state":"work","season":"autumn","festival":"halloween","time":"11:20","slot":"10:00 Làm việc","line":"Tập trung làm việc"}
PASS home 17:30 UTC is already 00:30 on the 28th in Vietnam: {"state":"midnight","season":"autumn","festival":"halloween","time":"00:30","slot":"00:00 Nửa đêm","line":"Ngủ say…"}
PASS home three days before Tết 2026 (Feb 17): coffee, Tết outfit: {"state":"morning","season":"spring","festival":"tet","time":"08:00","slot":"08:00 Cà phê & bánh mì","line":"Cà phê sữa đá nè!"}
PASS home eve of Mid-Autumn 2026 (Sep 25): reading, lantern festival: {"state":"evening","season":"autumn","festival":"midautumn","time":"20:30","slot":"20:00 Đọc sách","line":"Đọc thêm vài trang…"}
PASS home an ordinary summer night: movie, no festival: {"state":"night","season":"summer","festival":"","time":"23:45","slot":"22:00 Xem phim","line":"Phim hay quá!"}
PASS home winter afternoon: online meeting: {"state":"afternoon","season":"winter","festival":"","time":"14:59","slot":"14:00 Họp online","line":"Mọi người nghe rõ không?"}
PASS home "Hỏi Mimi" opens the assistant: chat-panel open
PASS About "Gặp Mimi": three live poses greet, searching, success: [{"state":"greet","live":true,"title":"Chào bạn, mình là Mimi!"},{"state":"searching","live":true,"title":"Để Mimi tra giúp"},{"state":"success","live":true,"title":"Xong rồi nè!"}]
PASS About "Trò chuyện với Mimi" opens the assistant: chat-panel open
PASS 390px / no sideways scroll: 0px
PASS 390px /gioi-thieu no sideways scroll: 0px
PASS 360px / no sideways scroll: 0px
PASS 360px /gioi-thieu no sideways scroll: 0px
PASS no console errors: none
ALL PASS
```
Xem bằng mắt (27/10, 11:20): Mimi đeo kính đọc bên laptop ("Tập trung làm việc"), lá thu rơi, có bí ngô và con dơi Halloween.

Status: **DONE** cho H1–H4.
