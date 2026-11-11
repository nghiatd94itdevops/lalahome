# 2026-10-12 — feed-kit PR2: client components + demo app

**Status:** PARTIAL — U8 và phần click giao diện cần người dùng kiểm

## Goal

Thêm client components cho feed-kit và một app demo Next.js 16 + Payload REST để chạy thử trang feed trên localhost,
dùng plugin PR1 và Postgres Docker.

Không làm: Payload admin UI, modal intercept, rich text, mention, e2e bằng trình duyệt.

## Decisions (đã duyệt)

- Style bằng CSS thuần + biến `--fk-*`, không Tailwind.
- npm workspaces (`feed-kit` + `feed-kit/demo`) để chỉ có một bản `payload` trong `node_modules`.
- Dependency mới: `next@16.2.6`, `react@19.2.6`, `react-dom@19.2.6`, `@payloadcms/next@3.86.0`,
  dev `@types/react@19.2.14`, `@types/react-dom@19.2.3`.
- PR2 làm chồng lên PR1 chưa commit.

## Success criteria

| # | Tiêu chí | Ai kiểm |
|---|---|---|
| U1 | `npm run dev` trong `demo` chạy http://localhost:3000; DB trống thì seed 3 tài khoản (2 member, 1 moderator), 2 kênh, vài bài kèm reaction/bình luận | Claude |
| U2 | `/login` chọn tài khoản demo, đăng xuất được; chưa đăng nhập vào `/feed` → chuyển về `/login` | Claude (HTTP) + người dùng |
| U3 | Feed mới nhất trước, bài ghim luôn đầu; cuộn tải trang tiếp (5 bài/trang); lọc theo kênh | Claude (REST) + người dùng |
| U4 | Đăng bài text + tối đa 10 ảnh + chọn kênh; bài mới hiện đầu feed; rỗng / > 5000 ký tự → báo lỗi | Claude (REST) + người dùng |
| U5 | Chọn/đổi/bỏ reaction, số đếm cập nhật; lưu/bỏ lưu; tải lại trang vẫn giữ trạng thái | Claude (REST) + người dùng |
| U6 | `/feed/[slug]`: bình luận, trả lời 1 cấp, sửa trong 30 phút, xoá của mình; moderator xoá mọi bình luận | Claude (REST) + người dùng |
| U7 | Nút trên UI khớp quyền server: member chỉ sửa/xoá bài mình; moderator ghim/ẩn/xoá mọi bài; bài ẩn member không thấy, moderator thấy kèm nhãn "Đã ẩn" | Claude (REST) + người dùng |
| U8 | Lỗi 400/403/409 hiện thành thông báo cho người dùng, không bị nuốt | Người dùng |
| U9 | `tsc` sạch cho thư viện và demo; 59 test PR1 vẫn đạt | Claude |

## Result

**Status lý do PARTIAL:** U8 và phần click giao diện của U2–U7 cần người dùng kiểm trên trình duyệt. Mọi phần
Claude kiểm được đều PASS.

| # | Kết quả | Bằng chứng |
|---|---|---|
| U1 | PASS | dev server Ready; log `feed-kit demo seeded: 3 accounts, 7 posts` |
| U2 | PASS (HTTP) | anonymous `/feed` → 307 `/login`; đăng nhập → 200 |
| U3 | PASS (REST + HTML) | ghim đầu, 5/trang, trang 2 có 2 bài, lọc kênh 3 bài |
| U4 | PASS (REST) | upload 201, tạo 201, bài mới đứng sau bài ghim; rỗng / 5001 ký tự → 400 |
| U5 | PASS (REST) | đổi reaction giữ count 1, bỏ → 0, lưu trùng 409, save riêng tư |
| U6 | PASS (REST + HTML) | bình luận/trả lời 201, cấp 2 → 400, sửa của mình 200 / của người khác 403, mod xoá 200 |
| U7 | PASS (REST + HTML) | sửa bài người khác 403, tự ghim bị bỏ qua, bài ẩn: member 404, mod thấy nhãn "Đã ẩn" |
| U8 | **PENDING — người dùng** | Thông báo lỗi có nội dung (vd. "Thao tác bị trùng: post 8 is already saved") nhưng phần chi tiết từ server là tiếng Anh |
| U9 | PASS | `tsc` thư viện + demo sạch; PR1 59/59 |

**Lỗi thiết kế bắt được trước khi chạy:** `FeedUiOptions.postHref` là function — Next không cho truyền function từ
Server Component sang Client Component. Đổi thành `postBasePath: string`.

### Raw output

```
## node demo/scripts/smoke.mjs
PASS  U2 anonymous /feed redirects to /login: 307 → /login
PASS  U2 logged-in /feed renders: status 200
PASS  U3 pinned post first, then newest: 📌3,7,6,5,4
PASS  U3 pagination: 5 per page, page 2 exists: page1=5 next=true page2=2
PASS  U3 channel filter: 3 posts in Mua bán
PASS  U3 feed page HTML lists seeded posts and pinned badge: html checked
PASS  U4 upload image + create post: upload 201, create 201
PASS  U4 new post is first after the pinned one: order 3,8,7,6,5
PASS  U4 empty and >5000 chars rejected with a message: 400/400: The following field is invalid: Body
PASS  U5 react then change keeps count at 1: count 1
PASS  U5 removing reaction drops count to 0: count 0
PASS  U5 save persists, duplicate save → 409, save private: save 201, again 409 "post 8 is already saved", others see 0
PASS  U6 comment + 1-level reply ok, reply-to-reply 400: 201/201/400
PASS  U6 author edits own comment, others get 403: 200/403
PASS  U6 detail page shows comments: status 200
PASS  U6 moderator deletes any comment (and its replies): delete 200, commentCount 0
PASS  U7 member cannot edit others’ post; cannot pin own: edit 403, pinned after self-pin false
PASS  U7 hidden post: member 404 (API+page), moderator sees it labelled: api 404, member page 404, mod page 200
PASS  U7 moderator feed renders moderation menu for others’ posts: aria-label found in html

19/19 checks passed

## tsc
demo tsc ok
lib tsc ok

## npx vitest run (PR1)
 Test Files  5 passed (5)
      Tests  59 passed (59)

## demo-dev.log
ERROR lines chỉ có 2 APIError cố ý từ smoke (409 lưu trùng, 400 trả lời cấp 2); không có lỗi render/hydration phía server.
```

## Follow-ups

- Thông báo lỗi chi tiết từ server là tiếng Anh (APIError của plugin + validation của Payload) — cân nhắc mã lỗi + bảng dịch phía client.
- Smoke test để lại 1 bài "Bài mới từ smoke test" đang ẩn trong DB demo (moderator thấy).
- Chưa có e2e trình duyệt (cần Playwright — dependency mới).
- Bộ đếm reaction trên UI tính cục bộ sau khi bấm; nếu nhiều người cùng bấm, số trên màn hình chỉ đúng lại sau khi tải trang.
