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

## Phần 2 — Mèo ú sinh động và cute hơn

Người dùng thấy mèo ú ít chuyển động và chưa đủ cute. Họ chọn làm ở lớp riêng của site (không sửa kit), gồm: tự làm điệu
khi rảnh, nhún mạnh hơn, phản ứng khi rê chuột, má hồng, và thêm câu phản ứng khi chọc.

Tiêu chí:
1. Trạng thái `idle`: trong 20 giây làm điệu ít nhất 2 lần (wink, love, happy, greet) rồi về `idle`.
2. Rê chuột vào: `surprised` → `love` → trạng thái cũ. Không phản ứng khi buồn, lỗi, cảnh báo hay ngủ.
3. Mascot động có má hồng; má hồng ẩn khi buồn, lỗi, cảnh báo hay ngủ.
4. Máy bật giảm chuyển động thì không có gì thêm. `VARIANT = "L"` thì tắt cả lớp này.
5. Không lỗi console; script kiểm khung (`chubby_check.mjs`) vẫn qua.

Thay đổi:
- `components/mimiCharm.js` (mới). Chỉ dùng API công khai của kit (`setEnergy`, `play`, `stop`) và các class giật tai của
  kit.
  - Năng lượng 1,4: nhún và nhảy cao hơn.
  - Giật tai mỗi 2,5–5 giây; trước đây là 4–9 giây.
  - Làm điệu mỗi 4,5–8 giây khi `idle`.
  - Rê chuột vào thì nhảy lên rồi thả tim, nghỉ 4 giây mới phản ứng lại.
  - Vẽ má hồng tại vị trí má mà kit công bố (`CHUBBY_FACE`).
- `Mimi.jsx`:
  - Bật lớp charm khi `hasCharm(VARIANT)`.
  - Khi site đổi trạng thái, gọi `stop()` để động tác đang dở không đè lên.
  - Thêm 4 câu phản ứng khi chọc.
- `styles.css`: `.is-charmed` nhún nhẹ khi `idle`; `.mimi-blush` nhấp nháy.

```
npm run build: ✓ built in 1.16s   index-DWpDI4oa.js 690.13 kB │ gzip: 300.55 kB

charm_check.mjs (Chrome headless; headless mặc định bật giảm chuyển động nên phải giả lập "no-preference")
PASS idle gestures in 20s ["mm-a-breathe","mm-a-bounce","mm-a-breathe","mm-a-bounce","mm-a-breathe","mm-a-bounce","mm-a-breathe","mm-a-tilt","mm-a-breathe",...]
PASS hover: surprised then love then back ["mm-a-breathe","mm-a-jump","mm-a-bounce","mm-a-breathe"]
PASS blush on every chubby mascot [5/5 hiện]
PASS blush hidden on the not-found note {"state":"confused","shown":true}   (trang này dùng "confused", không phải trạng thái im lặng nên kiểm này không chứng minh gì; CSS ẩn chưa được kiểm trên trang thật)
PASS no console errors []
PASS reduced motion: no charm {"charmed":0,"blush":0,"anims":["mm-a-breathe"]}

chubby_check.mjs (không giảm chuyển động): 10/10 PASS, spill [] mọi trang
```

## Phần 3 (2026-11-13) — Kit mới: mèo ú 12 tư thế

Người dùng cập nhật kit `LaLaHome/LaLaHome/`. Nhân vật mặc định giờ là `pose`: mèo ú vẽ tay, mỗi trạng thái một tư thế,
đổi tư thế theo 3 nhịp, đuôi/tay/chân chạy 8 khung, tai giật, cử chỉ rảnh riêng. Yêu cầu: đổi nhân vật cho phù hợp và làm
chuyển động mượt, cute.

Tiêu chí:
1. Mọi mascot động là `mm-v-pose`; avatar tĩnh trong chat vẽ tư thế đứng (pose 1), không lộ khung hình chồng nhau.
2. Rảnh thì đổi sang tư thế cute rồi về đứng (≥ 2 lần trong 30 giây). Rê chuột thì vẫy tay rồi về đứng.
3. Không chồng thêm chuyển động lên `pose`: không má hồng tự vẽ, không nhún khung ngoài, không giật tai theo class cũ.
4. Giảm chuyển động thì không thêm gì. Không lỗi console, không tràn khung. 5 Mimi trên một trang vẫn 60 fps.

Thay đổi:
- `Mimi.jsx`:
  - `VARIANT = "pose"`.
  - Avatar tĩnh: chỉ giữ tư thế 1 và khung hình 0, bỏ miếng che mắt/miệng để thấy mặt vẽ tay. Khung cắt đầu tính theo bán
    kính đầu (`POSE_GEO[1].head`).
- `mimiCharm.js`: cấu hình theo nhân vật (`CHARMS`).
  - `chubby` giữ nguyên như phần 2.
  - `pose` chỉ có tư thế lúc rảnh (wink, love, happy, greet, info) giữ 2,6 giây, cách nhau 7–12 giây, và vẫy tay khi rê
    chuột.
- `styles.css`: nhún khung ngoài chỉ cho `data-charm="chubby"`.

```
npm run build: ✓ built in 1.86s
index-C5E4OaS4.js 1,854.62 kB │ gzip: 1,083.73 kB   (trước: 690 kB; kit mới mimi-svg.js 1,4 MB ảnh nhúng)

chubby_check.mjs (đếm mm-v-pose, avatar có .mm-pose-1)
PASS 1280 / {"load":700,"jsKB":1064,"heapMB":7,"nodes":1438,"mascots":3,"chubby":3,"faces":0,"chubbyFaces":0,"spill":[]}
PASS 1280 /gioi-thieu {"mascots":5,"chubby":5,"spill":[]}
PASS 1280 /san-pham/99999 {"mascots":3,"chubby":3,"spill":[]}
PASS 1280 /tro-ly {"mascots":1,"chubby":1,"faces":2,"chubbyFaces":2,"spill":[]}
PASS 1280 /san-pham +chat {"mascots":3,"chubby":3,"faces":2,"chubbyFaces":2,"spill":[]}
PASS 390  (cùng 5 trang, cùng số)
all checks passed

pose_charm_check.mjs
PASS idle poses in 30s, back to standing ["mm-pz-1","mm-pz-9","mm-pz-1","mm-pz-4","mm-pz-1","mm-pz-4","mm-pz-1"]
PASS hover: waves then stands again ["mm-pz-1","mm-pz-2","mm-pz-1"]
PASS no site blush on the pose cat [5/5 không có]
PASS no console errors []
PASS reduced motion: no charm {"charmed":0,"blush":0,"anims":["mm-pz-1"]}

fps_check.mjs (/gioi-thieu, 5 Mimi, 5 giây)
1280 {"fps":60,"worstFrameMs":26}
390  {"fps":60,"worstFrameMs":17}
```

## Phần 4 (2026-11-13) — Miệng khi nói, chớp mắt, bớt đứng yên

Yêu cầu: lúc nói phải có miệng cử động, có chớp mắt, nhân vật phải "như ảnh động", không đứng yên một tư thế.

Đọc kit:
- Chớp mắt kit đã có (2,6–5,6 giây, chỉ khi không giảm chuyển động).
- Với `pose`, kit cố ý chỉ vẽ miệng vector cho o/sad/shout/wave; trạng thái `talking` giữ miệng vẽ tay đứng yên.
- Các tư thế không phải `idle` chỉ thở và lắc lư.
- Thử miệng `talk` vector của kit: nhỏ và lệch so với miệng vẽ tay (ảnh `mouth-try.png`), nên vẽ miệng riêng.

Tiêu chí:
1. Khi `talking`: có miệng riêng, hàm mở/đóng không đều, miếng che miệng của kit bật; hết nói thì mất cả hai.
2. Có chớp mắt; tư thế yên không phải `idle` (vd. trang chủ "morning") có cử chỉ nhỏ trong 20 giây.
3. Lúc rảnh đổi dáng dày hơn (4,5–8 giây), mọi dáng đều về đứng; cử chỉ rảnh riêng của kit vẫn chạy.
4. Không lỗi console, không tràn khung, 60 fps; giảm chuyển động thì không thêm gì.

Thay đổi:
- `mimiCharm.js`:
  - `startTalkingMouth`: đợi đổi tư thế xong (600 ms), lấy `POSE_GEO[pose].face/nose`, bật `mm-vmouth`, vẽ miệng
    `TALKING_MOUTH` (×1,45).
  - `fidget`: ở tư thế 1/3/7/8/9 khi không `idle`, cứ 3–6 giây bật một class cử chỉ có sẵn của kit (`mm-q-wag`, `mm-q-tilt`,
    `mm-q-hop`).
  - Sửa lỗi phát hiện khi kiểm: `play()` của kit không xoá `playTimer` khi chạy xong, nên sau động tác đầu tiên của site,
    cử chỉ rảnh của kit bị chặn mãi. Nay nghe `playend` rồi gọi `stop()`. Động tác lúc rảnh cũng không cắt ngang lúc đang
    vẫy chào khi rê chuột.
- `Mimi.jsx`: effect bật miệng khi `talking`.
- `styles.css`: `.mimi-jaw` mở/đóng theo nhịp 1,1 giây không đều.

```
npm run build: ✓ built in 1.73s

talk_check.mjs (chat và giọng đọc trả lời giả trên máy, không gọi dịch vụ trả phí)
PASS mouth while talking {"state":"talking","mouth":true,"patch":true,"jawAnim":"mimi-jaw","jawScale":"matrix(1, 0, 0, 0.776764, 0, 0)"}
PASS gone after talking {"state":"idle","mouth":false,"patch":false,"jawAnim":null,"jawScale":null}
PASS no console errors []

fidget_check.mjs
PASS home Mimi {"state":"morning"} in 20s saw ["mm-blinking","mm-q-wag","mm-q-tilt"]

pose_charm_check.mjs
PASS kit idle quirks still run between poses ["mm-q-hop","mm-q-wag"]
PASS idle poses in 40s, each back to standing ["mm-pz-1","mm-pz-9","mm-pz-1","mm-pz-8","mm-pz-1","mm-pz-4","mm-pz-1","mm-pz-5","mm-pz-1","mm-pz-5","mm-pz-1","mm-pz-2","mm-pz-1"]
PASS hover: waves then stands again ["mm-pz-8","mm-pz-2","mm-pz-1"]
PASS no site blush on the pose cat
PASS no console errors []
PASS reduced motion: no charm {"charmed":0,"blush":0,"anims":["mm-pz-1"]}

chubby_check.mjs: all checks passed (10/10)
fps_check.mjs: 1280 {"fps":60,"worstFrameMs":25} · 390 {"fps":60,"worstFrameMs":19}
```

Lần chạy đầu trượt "hover" (`["mm-pz-1","mm-pz-2","mm-pz-5"]`): động tác lúc rảnh cắt ngang lúc vẫy chào, đã sửa như trên.
Một lần trượt "idle poses" vì cửa sổ đo kết thúc giữa một dáng; điều kiện kiểm được sửa thành "mọi dáng đã xong đều về
đứng", đúng nghĩa tiêu chí 3.

## Phần 5 (2026-11-13) — Tay, chân, nhún nhảy

Yêu cầu: thêm chuyển động tay, chân, nhún nhảy ở một số tư thế.

Đọc kit (`MIMI_ART_POSE.meta.parts`): chỉ tư thế 2 (vẫy tay) và 8 (giơ tay) có bàn tay 8 khung; tư thế 12 (nằm ngửa) có
hai chân 8 khung; các tư thế khác chỉ có đuôi và tai, tay chân dính vào thân. Site không tự tách tay chân được.

Tiêu chí:
1. Lúc rảnh, các dáng có tay chân cử động (2, 8, 12) xuất hiện nhiều hơn.
2. Khi site làm điệu (lúc rảnh, rê chuột) ở dáng vẫy tay, giơ tay, ôm bụng, rạp người: cả con nhún nhảy; về đứng thì
   thôi. Dáng do site đặt sẵn (thẻ "Chào bạn" ở Giới thiệu) không nhún.
3. Nhún không chồng lên nhịp đổi dáng của kit.
4. Các kiểm trước vẫn qua; 60 fps khi trang đã tải xong.

Thay đổi:
- `mimiCharm.js`:
  - `startCharm` trả về `{ perform, interrupt, isBusy, stop }`. `perform` đánh dấu "site đang diễn", nghe sự kiện `state` của
    kit để bật `data-dance` (sau 600 ms, khi dáng mới đã bật lên) cho `danceStates`, tắt khi xong hoặc bị ngắt.
  - Danh sách dáng lúc rảnh: vẫy tay và giơ tay ×2, thêm `party` (nằm ngửa đạp chân).
- `Mimi.jsx`: giữ `charmControl`; khi site đổi trạng thái gọi `interrupt()`.
- `styles.css`: `.mimi[data-dance="on"]` nhún 2 nhịp/giây (nén ở nhịp, giãn ở đỉnh).

```
npm run build: ✓ built in 1.74s

pose_charm_check.mjs
PASS dances in paw and hug poses, still when standing ["mm-pz-1","mm-pz-8","mm-pz-8+dance","mm-pz-8","mm-pz-1","mm-pz-9","mm-pz-9+dance","mm-pz-9","mm-pz-1",...,"mm-pz-4","mm-pz-4+dance"]
PASS site-set greet card does not dance ["greet","searching","success"]
PASS kit idle quirks still run between poses ["mm-q-wag"]
PASS idle poses in 40s, each back to standing
PASS hover: waves then stands again ["mm-pz-1","mm-pz-2","mm-pz-2+dance","mm-pz-2","mm-pz-1"]
PASS no site blush on the pose cat · PASS no console errors · PASS reduced motion: no charm
talk_check.mjs: all checks passed · fidget_check.mjs: PASS · chubby_check.mjs: all checks passed

fps_settled.mjs (đo sau khi trang tải xong 8 giây), 3 lần:
1280 {"fps":60,"worstFrameMs":31} {"fps":60,"worstFrameMs":17} {"fps":60,"worstFrameMs":19}
390  {"fps":60,"worstFrameMs":17} {"fps":60,"worstFrameMs":17} {"fps":60,"worstFrameMs":30}
```

Lần chạy đầu trượt: nhún bật ngay khi kit còn đang co dáng cũ (`"mm-pz-1+dance"`); đã sửa bằng cách đợi 600 ms.

`fps_check.mjs` (đo 3 giây sau khi mở trang) có 2/6 lần ở 1280 tụt 41 và 28 fps, khung đứng 1,6 và 2,3 giây. Theo dõi 4 lần ×
45 giây thì không có khung nào quá 100 ms khi đổi dáng; đo sau khi trang tải xong thì luôn 60 fps. Khung đứng là do giải mã
gói JS và ảnh của kit lúc tải trang, không do chuyển động.

## Phần 6 (2026-11-13) — Thân mềm (biến dạng ảnh)

Người dùng thấy nhân vật vẫn "cứng như tấm hình" và muốn chuyển động mềm như người. Họ chọn: thử biến dạng ảnh trên
site, đồng thời viết yêu cầu rig cho người vẽ. Sau bản thử đầu (tách đầu bằng mặt nạ, ±3°) người dùng nói "ổn hơn nhiều,
tối ưu thêm".

Tiêu chí:
1. Thân nghiêng từ bàn chân, bụng phập phồng, đầu quay ±9° trên cổ uốn mềm, có lò xo, tai lắc trễ. Tai, nơ, mặt, miệng
   nói, đuôi, tay, logo L đi theo đúng chỗ.
2. Phóng to ×3 lúc đầu quay mạnh nhất: không lộ đường nối.
3. 5 Mimi cùng trang vẫn 60 fps khi trang đã tải xong. Mimi ngoài màn hình thì dừng.
4. Đuôi, tay, chân chuyển khung mượt, không nhảy cóc.
5. Giảm chuyển động thì tắt hết. Các kiểm trước vẫn qua.

Thay đổi:
- `components/mimiRig.js` (mới):
  - Cắt ảnh thân và áo của tư thế thành dải ngang, tô bằng `pattern` của chính ảnh đó. Ảnh mẫu giữ class và data-layer
    của kit, nên tính năng nhuộm màu của kit vẫn chạy.
  - Các dải nối thành cột sống từ dưới lên. Mỗi dải có góc nghiêng (lean, đầu, tai) và độ giãn (thở) riêng.
  - Các lớp khác của kit đi theo dải chứa chúng. Ô mặt (`.mm-head`) được bọc lại để đi theo đầu.
  - Chỉ dựng tư thế khi nó hiện lần đầu, chỉ cập nhật tư thế đang hiện. Dừng khi Mimi ra khỏi màn hình (dùng
    `IntersectionObserver`).
  - Số đo lấy từ `POSE_GEO` mà kit export: `T`, `head`, điểm cổ trong `scarf`.
- `mimiCharm.js`: thêm `softBody: true` cho `pose`.
- `Mimi.jsx`: gọi `rigPoseCat` khi bật.
- `styles.css`: đuôi, tay, chân hoà khung (`mimi-xfade`).

Tối ưu (đo trên trang thử, 5 Mimi gắn khớp, 4 giây):
```
không khớp           {"fps":60,"rects":0}
dải 5px, chồng 4px   {"fps":12,"worst":167,"rects":485}
dải 5px, chồng 1.5px {"fps":12,"worst":200,"rects":481}
dải 10px             {"fps":40,"rects":244}
dải 16px             {"fps":58,"rects":157}
dải thích ứng (đầu 1, tai 1, cổ 6px, thân 24px)  {"fps":58,"rects":149}  {"fps":59,"rects":149}
```
Chi phí tăng theo số dải, không theo độ chồng; chọn dải mỏng ở cổ, dày ở thân.

Lỗi gặp khi làm:
- `NaN`: dải cuối vượt mặt đất làm `rise` âm; đã chặn về 0.
- Vệt trắng ở ống tay áo dáng vẫy tay: tay giơ cao quá cổ nên bị xé giữa dải đầu và dải thân. Dáng có bàn tay cử động
  giờ chỉ quay đầu 35%.

```
npm run build: ✓ built in 1.57s
softbody_check.mjs
PASS no-preference: bands 147, rigged 5, moving 4 []
PASS reduce: bands 0, rigged 0, moving 0 []
pose_charm_check.mjs: 8 PASS, all checks passed
talk_check.mjs: all checks passed
fidget_check.mjs: PASS home Mimi {"state":"work"} in 20s saw ["mm-blinking","mm-q-hop"]
chubby_check.mjs: all checks passed
fps_settled.mjs ×3: 1280 {"fps":60,"worstFrameMs":33} {"fps":60,"worstFrameMs":18} {"fps":60,"worstFrameMs":20}
                    390  {"fps":60,"worstFrameMs":18} {"fps":60,"worstFrameMs":20} {"fps":60,"worstFrameMs":19}
Ảnh phóng to ×3: đứng quay +7,1°, vẫy tay +3,0° (đã giảm): không thấy đường nối.
```

Trước khi đưa vào site, bản đầu dùng 5 dải/px cho cả ảnh làm site tụt 28–41 fps (`fps_settled`), nên mới tối ưu như trên.

## Phần 7 (2026-11-13) — Dọn bớt

Bản thử Mimi ghép từ bộ phận (sheet 1536×1024 người dùng gửi) chưa đạt; người dùng sẽ làm hình mới, việc đó dừng.
Theo người dùng duyệt từng mục, đã xoá:
- `LaLaHome/Mimi_LaLaHome/` (chưa commit), `LaLaHome/LaLaHome/index.html`, `LaLaHome/cat-friends/`.
- Kit chữ L cũ `LaLaHome/mimi-svg.js`, `LaLaHome/mimi-bot.js`.
- Code chỉ dùng để quay về mèo ngồi hoặc chữ L:
  - `Mimi.jsx`: còn một đường vẽ đầu tĩnh cho `pose`.
  - `mimiCharm.js`: bỏ cấu hình `chubby`, má hồng, giật tai.
  - `styles.css`: bỏ `mimi-bob`, `mimi-blush`.

```
npm run build: ✓ built in 1.74s
chubby_check.mjs: all checks passed · pose_charm_check.mjs: 8 PASS · talk_check.mjs: all checks passed
softbody_check.mjs: PASS no-preference: bands 147, rigged 5, moving 4 · PASS reduce: bands 0
```

## Để sau

- **Bundle JS giờ 1,85 MB (gzip 1,08 MB), trước khi có mèo là 479 kB**, vì ảnh của kit nằm trong `mimi-svg.js`, mọi trang
  đều tải. Máy này mở mất 0,7 giây; điện thoại 4G sẽ chậm hơn vài giây. Ngoài ra trong vài giây đầu có lúc trang đứng
  1,6–2,3 giây (máy này, Chrome headless) khi giải mã gói và ảnh. Nên tách kit ra tải sau khi trang hiện, hoặc để ảnh
  thành file riêng trong kit.
- Tay chân chỉ cử động ở tư thế 2, 8, 12 vì kit chỉ có ảnh tách lớp ở đó; muốn tay chân ở mọi tư thế cần kit vẽ thêm khung,
  hoặc dùng mẫu `stand` (mèo đứng, tay chân dựng khớp).
- `LaLaHome/LaLaHome/` chưa được git theo dõi; nếu chốt mèo ú cần commit kit này, nếu không build từ máy khác sẽ lỗi.
- Miệng khi nói chạy theo nhịp cố định, không theo âm lượng thật của giọng đọc.
- `mimiCharm.js` đọc `bot.playTimer` (thuộc tính nội bộ của kit) để biết đang diễn; kit đổi tên thì phải sửa theo.
- Trang Giới thiệu vẫn mô tả "Mimi là mèo chữ L… tai origami, vòng cổ đổi màu", không còn khớp với mèo ú.
- Phản ứng khi rê chuột chỉ có với chuột. Trên điện thoại vẫn dùng chạm để chọc như cũ.
- Ảnh chụp mới xem phần đầu trang; Mimi ở mục "Mimi lúc này" (trang chủ) và trang Giới thiệu chỉ kiểm bằng số đếm.
