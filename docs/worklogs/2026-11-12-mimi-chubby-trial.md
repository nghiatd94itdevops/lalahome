# 2026-11-12 — Thử thay Mimi chữ L bằng mèo ú

**Status:** DONE (Chrome headless 1280 và 390px; chưa xem trên máy thật)

## Goal

Người dùng thêm kit mới vào `LaLaHome/LaLaHome/` (có nhân vật mèo ú, `variant: "chubby"`) và muốn thử thay nhân vật chữ
L trên site. Đây là thử tạm thời: kit chữ L ở `LaLaHome/mimi-*.js` phải giữ nguyên để rollback được.

Không làm: sửa kit, xoá kit cũ, đổi CSS kích thước mascot.

## Success criteria

1. Site nạp kit từ `LaLaHome/LaLaHome/`. Mọi mascot động có `mm-v-chubby`; avatar tĩnh trong chat vẽ đầu mèo ú.
2. `LaLaHome/mimi-svg.js`, `LaLaHome/mimi-bot.js` không đổi.
3. Rollback bằng một chỗ: `VARIANT = "L"` (kit mới vẫn vẽ chữ L), hoặc trỏ import về kit cũ.
4. Build qua; ở 1280 và 390px không có lỗi console, không mascot nào tràn khung.

## Thay đổi

- `frontend/src/components/Mimi.jsx`:
  - Import kit mới.
  - Hằng số `VARIANT = "chubby"` truyền vào `MimiBot`.
  - `MimiFace` cắt khung đầu theo `VARIANT_GEO[variant].head` (với "L" ra đúng `62 14 232 236` như cũ). Với mèo ú,
    dùng `buildChubbyFace` và đưa lớp đầu xuống dưới tai, giống bot làm khi dựng.

## Result

```
git status LaLaHome/mimi-svg.js LaLaHome/mimi-bot.js   → không thay đổi

npm run build: ✓ built in 1.31s
index-CsxfF9sG.js 688.34 kB │ gzip: 299.84 kB   (bản trước: 479 kB, kit mới nhúng ảnh webp base64)

chubby_check.mjs
PASS 1280 / {"mascots":3,"chubby":3,"faces":0,"chubbyFaces":0,"spill":[]}
PASS 1280 /gioi-thieu {"mascots":5,"chubby":5,"faces":0,"chubbyFaces":0,"spill":[]}
PASS 1280 /san-pham/99999 {"mascots":3,"chubby":3,"faces":0,"chubbyFaces":0,"spill":[]}
PASS 1280 /tro-ly {"mascots":1,"chubby":1,"faces":2,"chubbyFaces":2,"spill":[]}
PASS 1280 /san-pham +chat {"mascots":3,"chubby":3,"faces":2,"chubbyFaces":2,"spill":[]}
PASS 390  (cùng 5 trang, cùng số)
all checks passed
```

## Để sau

- Bundle JS tăng ~210 kB (gzip ~300 kB tổng) vì ảnh mèo ú nằm trong `mimi-svg.js`. Nếu giữ mèo ú lâu dài nên tách
  ảnh ra file riêng hoặc lazy-load.
- `LaLaHome/LaLaHome/` chưa được git theo dõi; nếu chốt mèo ú cần commit kit này, nếu không build từ máy khác sẽ lỗi.
- Ảnh chụp mới xem phần đầu trang; Mimi ở mục "Mimi lúc này" (trang chủ) và trang Giới thiệu chỉ kiểm bằng số đếm.
