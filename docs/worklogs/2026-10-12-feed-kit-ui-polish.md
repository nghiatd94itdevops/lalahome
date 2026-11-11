# 2026-10-12 — feed-kit: giao diện bảng tin công ty

**Status:** PARTIAL — V1–V7 cần người dùng xem trên trình duyệt

## Goal

Làm lại giao diện feed theo kiểu bảng tin nội bộ công ty (đăng bài, xem, thả cảm xúc, bình luận), không đổi hành vi
hay phân quyền. Không thêm dependency; icon là SVG inline.

Không làm: đếm cảm xúc theo từng loại (cần sửa plugin), cột phải, rich text.

## Success criteria

| # | Tiêu chí |
|---|---|
| V1 | Top bar dính: "Bảng tin", tab kênh dạng pill, avatar người xem + menu đổi tài khoản / đăng xuất |
| V2 | Composer thu gọn "Bạn muốn chia sẻ gì, …?" + avatar; bấm vào thì mở rộng |
| V3 | Card bài: avatar chữ cái đầu màu riêng, tên đậm, thời gian · kênh, nhãn ghim/ẩn; chữ nội dung dễ đọc |
| V4 | Lưới ảnh: 1, 2, 3 (1 lớn + 2), ≥ 4 (2×2, "+N") |
| V5 | Dòng tóm tắt tổng cảm xúc / bình luận; thanh 3 nút Thích · Bình luận · Lưu; rê chuột / nhấn giữ Thích để chọn cảm xúc |
| V6 | Bình luận có avatar, bong bóng, trả lời thụt vào; ô viết có avatar người xem |
| V7 | Dark mode đúng; 360 px không cuộn ngang |
| V8 | Không đổi hành vi: smoke 19/19, `tsc` sạch, 59 test PR1 đạt |

## Result

**Status lý do PARTIAL:** V1–V7 là tiêu chí nhìn bằng mắt; Claude chỉ kiểm được markup có mặt trong HTML và hành vi
không đổi. Người dùng cần mở trình duyệt (cả desktop, điện thoại / DevTools 360 px, và dark mode).

| # | Kết quả | Bằng chứng |
|---|---|---|
| V1 | Cần người dùng xem | TopBar render (trang 200), CSS `position: sticky` |
| V2, V5 | Markup có (HTML) | smoke: "Bạn muốn chia sẻ gì", `fk-actions`, "Bình luận" có trong HTML |
| V3, V4, V6 | Cần người dùng xem | Avatar / gallery 1-2-3-4+ / bong bóng bình luận đã viết, chưa nhìn |
| V7 | Cần người dùng xem | CSS có nhánh dark + `max-width: 520px`; chưa render ở 360 px |
| V8 | PASS | smoke 21/21 (thêm 1 check markup + 1 cleanup); `tsc` lib + demo sạch; PR1 59/59 |

### Raw output

```
## node demo/scripts/smoke.mjs
PASS  U2 anonymous /feed redirects to /login: 307 → /login
PASS  U2 logged-in /feed renders: status 200
PASS  U3 pinned post first, then newest: 📌3,7,6,5,4
PASS  U3 pagination: 5 per page, page 2 holds the rest: total=7 page1=5 next=true page2=2
PASS  U3 channel filter: 3/7 posts in Mua bán – cho thuê
PASS  U3 feed page HTML lists seeded posts and pinned flag: html checked
PASS  V2/V5 feed HTML has collapsed composer and 3-button action bar: html checked
PASS  U4 upload image + create post: upload 201, create 201
PASS  U4 new post is first after the pinned one: order 3,9,7,6,5
PASS  U4 empty and >5000 chars rejected with a message: 400/400: The following field is invalid: Body
PASS  U5 react then change keeps count at 1: count 1
PASS  U5 removing reaction drops count to 0: count 0
PASS  U5 save persists, duplicate save → 409, save private: save 201, again 409 "post 9 is already saved", others see 0
PASS  U6 comment + 1-level reply ok, reply-to-reply 400: 201/201/400
PASS  U6 author edits own comment, others get 403: 200/403
PASS  U6 detail page shows comments: status 200
PASS  U6 moderator deletes any comment (and its replies): delete 200, commentCount 0
PASS  U7 member cannot edit others’ post; cannot pin own: edit 403, pinned after self-pin false
PASS  U7 hidden post: member 404 (API+page), moderator sees it labelled: api 404, member page 404, mod page 200
PASS  U7 moderator feed renders moderation menu for others’ posts: aria-label found in html
PASS  -- cleanup: smoke post deleted by its author: status 200

21/21 checks passed

## tsc
lib tsc ok
demo tsc ok

## npx vitest run (PR1)
 Test Files  5 passed (5)
      Tests  59 passed (59)

## demo-dev.log: không có ⨯ / TypeError / Module not found
```

## Thay đổi API client (chưa phát hành nên không có người dùng cũ)

- `FeedViewer` thêm `displayName` (bắt buộc) — dùng cho avatar và câu "Bạn muốn chia sẻ gì, …?".
- `ReactionBar` thay bằng `useReaction` + `ReactionButton` (số đếm ở dòng tóm tắt, nút ở thanh hành động).
- `SaveButton` nhận `onError` để lỗi hiện chung một chỗ dưới card.
- Thêm `Avatar`.

## Bổ sung: icon cảm xúc động (Fluent Emoji như ThinkSmartForum)

Bản trước dùng emoji Unicode tĩnh — sai so với bản gốc, do bỏ sót `ReactionEmojiImage.tsx` khi tách tính năng.

- Copy nguyên `public/emoji/fluent/{3d,animated,LICENSE.txt}` từ ThinkSmartForum (commit 503bfda) vào
  `feed-kit/assets/emoji/fluent/`; sha256 cả 12 ảnh trùng bản gốc. Source không bị sửa (`git status` 0 dòng).
- **License:** `3d/` MIT (microsoft/fluentui-emoji). `animated/` không có license (bản Teams đăng lại, NOASSERTION).
  Người dùng chọn "Giống hệt bản gốc" ngày 2026-10-12, chấp nhận rủi ro cho mọi dự án dùng feed-kit; đã ghi vào LICENSE.txt.
- Bảng chọn: ảnh động 34 px, phóng to + tooltip tên khi rê chuột; ảnh 3D tĩnh hiện thay cho tới khi ảnh động tải xong.
  Nút đang chọn và dòng tóm tắt: ảnh 3D tĩnh. Ảnh động (~4,9 MB tổng) chỉ tải khi bảng chọn mở.
- `FeedUiOptions.emojiBasePath` (mặc định `/emoji/fluent`); demo copy ảnh vào `public/` qua `predev`.

```
PASS  E1 reaction summary uses Fluent 3D images, not unicode emoji: html checked
PASS  E1 animated emoji served as APNG: status 200, 909548 bytes
23/23 checks passed
 Test Files  5 passed (5)
      Tests  59 passed (59)
lib tsc ok / demo tsc ok
12/12 ảnh trả 200 image/png; 6 ảnh animated có chunk acTL (APNG)
```

## Follow-ups

- Dòng tóm tắt chỉ có tổng cảm xúc; muốn "👍❤️ 12" theo loại cần plugin lưu số đếm theo từng loại.
- Ảnh mở tab mới; chưa có lightbox xem ảnh trong trang.
- Bài rác "Bài mới từ smoke test" (id 8, đang ẩn) từ lần chạy smoke trước vẫn còn — chờ người dùng đồng ý xoá.
- Prettier được dùng từ `node_modules` (phụ thuộc gián tiếp của payload), không phải dependency khai báo.
