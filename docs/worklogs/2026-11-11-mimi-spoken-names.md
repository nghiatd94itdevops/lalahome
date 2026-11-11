# 2026-11-11 — Từ điển giọng đọc (admin chỉnh cách đọc từ và ký hiệu)

**Status:** PARTIAL — quy tắc đọc 14/14, lưu/đọc qua API thật trên stack thử OK, build OK.
**Chưa** mở màn admin trong trình duyệt và **chưa nghe thử** bằng tai.

## Goal

Nhân viên tự khai báo "khi gặp X thì đọc Y" (vd. Mimi → mi mi, LaLaHome → La La Hôm, `*` → không đọc, `/` → trên)
mà không cần sửa code hay deploy. Chữ hiển thị trên màn hình giữ nguyên.

Không làm: bảng DB/API/quyền mới (dùng lại `site_content` + `GET/PUT /site-content`, quyền `content.manage`),
xử lý phía speech-service, áp dụng khi chưa tải lại trang.

Lần đầu thay đổi này là hằng `SPOKEN_NAMES` cố định trong `useVoice.js`; người dùng muốn tự khai báo nên thay bằng bảng.

## Success criteria

1. Màn **Nội dung website › Từ điển giọng đọc** (quyền `content.manage`): thêm/sửa/xoá dòng, lưu; `GET /site-content` trả lại đúng.
2. Giọng đọc áp dụng bảng: chữ khớp nguyên từ, không phân biệt hoa thường, kể cả chữ có dấu; dấu cách khớp cả khi viết
   liền; ký hiệu khớp mọi chỗ; "Đọc thành" rỗng = bỏ qua.
3. `/` ngay sau giá đọc "một" (`85.000đ/ram` → "85000 đồng một ram"); chỗ khác theo bảng.
4. Chưa lưu bảng lần nào → bộ mặc định (La La Home, Mimi, `*`, `/` → trên).
5. Cụm dài ưu tiên; chữ đã thay không bị dòng khác thay tiếp.
6. Dữ liệu sai trong DB không làm hỏng giọng đọc (bỏ dòng sai).
7. `npm run build` qua; backend không đổi.

## Thay đổi

- `lalaflow/frontend/src/components/spokenWords.js` (mới): mặc định, `parseSpokenWords` (kiểm dữ liệu từ DB),
  `compileSpokenWords` (một regex, dài trước, một lượt), `useSpokenWords` (tải `/site-content` một lần mỗi trang).
- `useVoice.js`: `speakable(text, readWords)`; `/` chỉ đọc "một" ngay sau "đồng"; bỏ khoảng trắng trước dấu câu;
  `useSpeaker` dùng bảng; export `fetchSpeech` cho nút Nghe thử.
- `admin/screens/SpokenWords.jsx` (mới), `admin/menu.js`, `admin/screens/index.js`, `admin/admin.css` (ô input trong bảng).

## Result

```
speakable + bảng (Vite SSR):
PASS C2 defaults: names, *, / elsewhere
PASS C2 spaces optional, case-insensitive
PASS C2 whole word only
PASS C3 / after price reads một
FAIL C5 longest first, no re-replace
   got:  "SAI ở La La Hôm và nhà."
   want: "mi mi ở La La Hôm và nhà."
PASS C2 Vietnamese word edges + symbol
PASS C2 no / row -> slash kept (custom table)
PASS C4 nothing saved -> defaults
PASS C4 saved empty table -> empty
PASS C6 bad rows dropped
PASS C6 regex chars literal
PASS C6 empty table identity
11/12 passed
```
FAIL do test sai, không phải code: dòng thử `mi mi` → "SAI" theo đúng quy tắc dấu cách cũng khớp "Mimi" và dài hơn
nên thắng. Viết lại test C5 bằng dòng `mi` (không khớp "Mimi", chỉ khớp nếu thay chồng) và ghi lại hành vi chồng lấn:
```
PASS C5 longest first, no re-replace
PASS (behaviour) row with spaces also matches the joined word
2/2 passed
npm run build: ✓ built in 1.45s
```

Stack thử `lalahome-test` (DB mới, sau đó `down -v`):
```
login 200 ['token', 'user']
PUT anon  401
PUT admin (200, {'ok': True})
GET after 200 {"words": [{"match": "La La Home", ...}, {"match": "/", ...}, {"match": "kg", ...}]}
roundtrip equal: True
other content untouched: ['about', 'company', 'contact', 'home', 'pages', 'stats']
bundle has screen: 1
```

## Để sau

- Mở màn admin trên trình duyệt, lưu vài dòng, bấm Nghe thử; nghe Mimi trên trang khách.
- Hai dòng chồng lấn (`Mimi` và `mi mi`) → dòng dài hơn thắng; màn admin chưa cảnh báo trường hợp này.
- URL trong câu trả lời (`https://…`) sẽ đọc `/` thành "trên".
- Ký hiệu markdown (`* _ \` # ~`) vẫn luôn bị bỏ trước khi áp bảng, kể cả khi xoá dòng `*`.
- Khách đang mở trang chỉ thấy bảng mới sau khi tải lại.
