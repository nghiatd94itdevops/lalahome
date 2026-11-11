# 2026-10-12 — feed-kit PR1: Payload server plugin

**Status:** DONE

## Goal

Tách tính năng feed của ThinkSmartForum thành Payload plugin dùng lại được cho các dự án Next.js + Payload 3.86:
collections, access, hooks, bộ đếm, loader danh sách — kèm test tích hợp qua Payload local API trên Postgres.

Không làm: rich text Lexical (body là text thuần), draft autosave, mention, photo theater, modal intercept, digest,
thông báo Firestore/FCM, trang admin, client components (PR2), demo app (PR3). Không sửa source ThinkSmartForum.

## Decisions (đã duyệt)

- Tác giả: một field `author` polymorphic tới `authorCollections` do host khai báo (thay `author`/`memberAuthor`).
- Quyền: callback host truyền vào (`isModerator`, `canRead`, `canPost`, `canInteract`, `canPostToChannel`).
- Thông báo: callback `onEvent`; lỗi trong `onEvent` được log kèm ngữ cảnh, không rollback thao tác ghi.
- `reactionCount`/`commentCount` lưu trên post, đếm lại trong hook (thay virtual field `afterRead` gây N+1).
- Test chạy trên Postgres trong Docker (giống production), dependency pin theo ThinkSmartForum.

## Success criteria

| # | Tiêu chí |
|---|---|
| S1 | Plugin thêm đúng 4 collection, không đổi collection có sẵn của host |
| S2 | Tạo bài: `author` lấy từ `req.user`, client không giả mạo được; slug bỏ dấu + hậu tố, duy nhất; `excerpt` tự tính |
| S3 | Ẩn danh không tạo bài; `canPost` false → 403; người không phải tác giả/moderator không sửa/xoá được; tác giả sửa `body`/`images` nhưng không đổi `pinned`/`status`; moderator ghim/ẩn được |
| S4 | Bài `hidden` không hiện với người không phải moderator; `canRead` false → danh sách rỗng |
| S5 | 1 reaction/người/bài, đổi reaction thì thay thế; lưu trùng → 409; không reaction được vào bài ẩn; `reactionCount` đúng sau tạo/xoá |
| S6 | Bình luận ≤ 2000 ký tự; trả lời chỉ 1 cấp và cùng bài; tác giả sửa được trong 30 phút (cấu hình được); xoá bài xoá kèm bình luận + tương tác; `commentCount` đúng |
| S7 | `onEvent` được gọi với đúng payload; nếu `onEvent` lỗi thì log kèm ngữ cảnh, không rollback thao tác ghi |
| S8 | Loader danh sách: phân trang theo số trang, bài ghim lên đầu, lọc channel, trả `hasNextPage` |
| S9 | `tsc --noEmit` sạch; mọi test đạt; mỗi test FAIL nếu bỏ phần code tương ứng |

## Result

| # | Kết quả | Bằng chứng |
|---|---|---|
| S1 | PASS | `tests/plugin.test.ts` 6/6 |
| S2 | PASS | `tests/posts.test.ts` "creating a post" 6/6 |
| S3 | PASS | `tests/posts.test.ts` "who may create and change posts" 9/9 |
| S4 | PASS | `tests/posts.test.ts` "reading posts" 3/3 |
| S5 | PASS | `tests/interactions.test.ts` 12/12 |
| S6 | PASS | `tests/comments.test.ts` 13/13 |
| S7 | PASS | `tests/events.test.ts` 5/5 |
| S8 | PASS | `tests/posts.test.ts` "findFeedPage" 4/4 |
| S9 | PASS | `tsc` sạch; 59/59 test; 8/8 mutation bị test bắt |

**Lỗi thật test đã bắt được trong lúc làm:** `afterChange` nhận `author`/`actor` đã populate thành cả document user
(email, sessions) → `onEvent` của host sẽ nhận nguyên bản ghi user. Sửa bằng `toActorRef` chỉ giữ `{relationTo, value: id}`.

**Khác biệt có chủ ý so với ThinkSmartForum** (đều có test):
- Bản gốc chỉ chặn `pinned` khi update → member có thể tạo bài đã ghim sẵn. feed-kit chặn cả create.
- Bản gốc cho mọi người có quyền đọc feed thấy save của người khác. feed-kit: save chỉ chủ sở hữu thấy.
- Bản gốc sắp bài ghim lên đầu trên client, từng trang một. feed-kit sắp ở query nên ghim ở trang 3 vẫn lên đầu trang 1.
- 1 reaction/người/bài được ép bằng unique `dedupKey` (an toàn khi 2 request đua nhau), không chỉ bằng delete-then-create.

### Raw output

```
## npx tsc --noEmit
exit=0

## npx vitest run
 ✓ tests/events.test.ts (5 tests) 1941ms
 ✓ tests/plugin.test.ts (6 tests) 5ms
 Test Files  5 passed (5)
      Tests  59 passed (59)
   Start at  13:49:18
   Duration  26.49s (transform 199ms, setup 0ms, import 5.02s, tests 20.79s, environment 1ms)
(stack trace trong output là log cố ý của test S7: "ERROR: feed-kit onEvent failed for post.created … notifier is down")

## mutation check (scratchpad/mutate.py — phá từng chỗ, chạy test tương ứng, khôi phục)
KILLED  author spoofing          -> Tests  1 failed | 22 skipped (23)
KILLED  pinned field access      -> Tests  1 failed | 22 skipped (23)
KILLED  one reaction per user    -> Tests  1 failed | 11 skipped (12)
KILLED  comment recount          -> Tests  1 failed | 12 skipped (13)
KILLED  onEvent isolation        -> Tests  1 failed | 4 skipped (5)
KILLED  private saves            -> Tests  1 failed | 11 skipped (12)
KILLED  comment edit window      -> Tests  1 failed | 12 skipped (13)
KILLED  pinned-first sort        -> Tests  1 failed | 22 skipped (23)
tsc ok after restore

## ThinkSmartForum không bị đụng
git -C .../think-smart-forum status --short | wc -l  ->  0
```

## Follow-ups

- PR2: client (REST client, FeedList, PostCard, PostComposer, PostDetail, ReactionBar, SaveButton, Comments, ModerationMenu) + route template.
- PR3: demo app Next.js + e2e.
- Chưa có migration Payload — test dùng `push`. Host chạy production phải `payload migrate:create` sau khi thêm plugin.
- `interaction.created` phát cả khi đổi reaction (delete + create); host tự lọc nếu chỉ muốn báo lần đầu.
- Kích thước: src 927 dòng + tests 908 dòng (không tính `package-lock.json`).
