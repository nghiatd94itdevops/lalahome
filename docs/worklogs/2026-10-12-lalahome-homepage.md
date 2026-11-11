# 2026-10-12 — web: trang chủ LalaHome ở `/`, trang thử giọng nói chuyển sang `/voice.html`

**Status:** PARTIAL — chưa bấm thử cánh cửa, con mèo và mic trên trình duyệt thật

## Goal

Mở `http://localhost:8000/` thì thấy ảnh bìa LalaHome: tranh ngôi nhà vườn (ảnh người dùng gửi) có mèo
thở/chớp mắt/nghiêng đầu, bướm bay, lá và cánh hoa bay, khói, đèn lồng nhấp nháy, đèn lồng trên cây đung đưa.
Bấm cánh cửa thì sang trang thử giọng nói.

Không làm: sửa backend (`speech-service/`), sửa `app.js`, `storybook.css`, `storybook.js`, ảnh trong
`assets/storybook/`; không thêm dependency.

## Decisions

- Dùng nguyên tranh người dùng gửi làm nền thay vì vẽ lại bằng code; chuyển động phủ lên trên bằng SVG + CSS + JS thuần,
  cùng toạ độ 1672×941 với ảnh.
- Ảnh nền đã sửa bằng ffmpeg từ ảnh gốc: chữ biển đổi thành LALAHOME (miếng gỗ + chữ SVG), bỏ sticker công nghệ trên cửa,
  bỏ 4 con bướm vẽ đứng yên, xoá đèn lồng trên cây khỏi nền để đèn tách riêng (`lantern-sprite.png`) đung đưa không bị bóng đôi.
- Máy dev đang tắt Animation effects của Windows nên trình duyệt báo `prefers-reduced-motion: reduce`;
  ở chế độ này trang vẫn chuyển động nhưng chậm và thưa hơn, thay vì đứng yên.
- Trang thử giọng nói cũ được chép nguyên sang `voice.html` (md5 trùng bản sao lưu).

## Success criteria

| # | Tiêu chí | Cách đo |
|---|---|---|
| C1 | `GET /` trả trang LalaHome; `home.jpg`, `lantern-sprite.png` trả 200 | `curl` vào server đang chạy |
| C2 | Ảnh chụp từ `localhost:8000` hiện đúng cảnh LalaHome như bản đã duyệt | Edge headless screenshot |
| C3 | `/voice.html` mở được trang thử giọng nói, `app.js` 200, không lỗi console | `curl` + Edge headless log |
| C4 | Ngoài `web/index.html`, `web/voice.html`, `web/assets/home/*` không file nào khác bị đổi bởi task này | `find web -mmin`, md5 |

## Result

| # | Kết quả | Ghi chú |
|---|---|---|
| C1 | PASS | xem output bên dưới |
| C2 | PASS | `scratchpad/local-home.png`: biển LALAHOME, cửa không sticker, bướm bay, đèn lồng |
| C3 | PASS | mic chưa được bấm thử |
| C4 | PASS | `web/storybook.js` có mtime 14:27, trước khi task này bắt đầu ghi file (14:39) — do phiên khác, không phải task này |

```
/                                  200 text/html; charset=utf-8 19172B
/assets/home/home.jpg              200 image/jpeg 485542B
/assets/home/lantern-sprite.png    200 image/png 48911B
/voice.html                        200 text/html; charset=utf-8 5635B
/app.js                            200 application/javascript 8326B
/storybook.js                      200 application/javascript 3815B
/health                            200 application/json 126B
<title>LalaHome
<title>Nhà của những câu chuyện · Voice

home console:
voice console:

<a class="door-link" href="voice.html"

e2269cb93a9d7f57cfdbda6b66a626ec *web/voice.html
e2269cb93a9d7f57cfdbda6b66a626ec *scratchpad/backup-web/index.html
```

## Rollback

```bash
cp scratchpad/backup-web/index.html web/index.html
rm web/voice.html
rm -r web/assets/home
```

## Update — bỏ màn storybook khỏi trang giọng nói

Người dùng yêu cầu bấm cửa ở trang chủ là vào thẳng khối thử giọng nói. `web/voice.html`: bỏ khối `#storybook`
("Một góc nhỏ bình yên"), link `storybook.css`, script `storybook.js`; tiêu đề thành "Thử giọng nói tiếng Việt".
`app.js` không tham chiếu storybook. File `storybook.css`, `storybook.js`, `assets/storybook/` vẫn còn trên đĩa, không còn trang nào dùng.

```
/voice.html 200 3915B
<title>Thử giọng nói tiếng Việt
<a class="door-link" href="voice.html"
console:
(end)
```

Ảnh chụp `scratchpad/local-voice.png`: mở thẳng vào khối "Thử giọng nói tiếng Việt" (Bắt đầu nói, Câu đã chốt, Đọc text thành giọng nói).

## Update — gợi ý bấm cửa, lá dày hơn, mèo và khói sống động hơn

Chỉ sửa `web/index.html`:

- Biển gỗ "Mời vào ›" treo bằng dây từ hai tay nắm, đung đưa; kính cửa sáng lên theo nhịp. Rê chuột hoặc Tab vào cửa thì kính sáng hẳn
  và biển lắc nhanh. Biển và lớp sáng nằm trong `<a href="voice.html">` nên bấm vào đâu trên cửa cũng vào trang giọng nói.
- Lá rơi: sinh mỗi 330 ms (trước 650), tối đa 34 lá cùng lúc (trước 18); chế độ giảm chuyển động 800 ms / 14 lá.
- Mèo: đầu nghiêng tới 6,5° hai bên và gật nhẹ (chu kỳ 7,5 s), chớp mắt một lần rồi hai lần liền (chu kỳ 6 s), thân lắc ±0,7° theo nhịp thở.
- Khói: 9 cụm khói nối đuôi nhau (lệch pha 0,7 s), nở to và trôi chếch trái lên cao 150px rồi tan.

Kiểm tra bằng ảnh chụp từ `localhost:8000`: mèo ở tư thế nghiêng nhiều nhất không lộ bóng đôi; biển hiện đủ "Mời vào ›";
làn khói liền từ miệng ống khói lên tới khói vẽ sẵn. Chưa rê chuột/bấm thử trên trình duyệt thật.

## Update — biển "Welcome", mèo con chạy quanh sân, nhạc nền

- Biển treo cửa đổi chữ thành "Welcome ›", tấm gỗ nới rộng 118px.
- Mèo con: `web/assets/home/kitten-1.png`, `kitten-2.png` (mới) lấy từ `assets/storybook/cat-walk.png`, lọc sạch các chấm màu
  lẫn trong vùng trong suốt (ngưỡng alpha + erosion/dilation), thu còn 192px. Chạy vòng elip quanh lối đá
  (tâm 830,835; bán kính 430×62; 11 s/vòng), đổi 2 khung hình mỗi 140 ms, nảy theo bước, to nhỏ theo xa gần,
  dừng 1,8 s mỗi vòng ở phía trước sân.
- Nhạc nền: hộp nhạc tự tạo bằng Web Audio (hợp âm C–Am–F–G, giai điệu ngũ cung, có tiếng vọng), không dùng file nhạc nào.
  Cấu hình ở object `MUSIC` đầu script: `autoplay`, `volume` (0.22), `src` (để trống = hộp nhạc, hoặc đường dẫn file mp3 riêng), `tempo`.
  Trình duyệt chỉ cho phát tiếng sau tương tác đầu tiên, nên `autoplay` bắt đầu ở lần chạm/bấm/phím đầu tiên.
  Nút "Nhạc" góc phải dưới để bật/tắt; lựa chọn tắt được nhớ trong `localStorage`. Tab bị ẩn thì tạm dừng.

```
js syntax ok
<title>MUSIC true Nhạc: bật        (giả lập bấm nút, Edge headless --autoplay-policy=no-user-gesture-required)
```

Chưa nghe thử nhạc bằng tai và chưa xem mèo con chạy trên trình duyệt thật (headless không chạy tiếp animation theo thời gian giả lập).

## Update — mèo con chạy bằng rig, nút nhạc góc trên trái và mặc định bật

- Mèo con không còn đổi qua lại 2 khung hình. `web/assets/home/kitten-rig.png` (mới, 256×237, khung 1 đã lọc sạch nền) được cắt
  bằng mask thành đuôi, thân và 4 chân. Chân xoay quanh khớp hông/vai theo kiểu chạy chéo cặp (trước gần cùng sau xa,
  trước xa cùng sau gần), chu kỳ 0,34 s, mỗi chân có góc gốc và biên độ riêng. Mảnh chân lấy dư lên trong thân;
  chân xa nằm sau thân, chân gần nằm trước và mép trên làm mờ dần 24px để khớp không lộ. Thân nảy 2 lần mỗi bước và nghiêng nhẹ,
  đuôi phe phẩy. Khi dừng nghỉ, bước chân giảm dần về 0 nên chân thu về tư thế đứng.
- Nút nhạc chuyển lên góc trên bên trái, mặc định "Nhạc: bật" (trừ khi người dùng từng tắt). Nhạc phát ở lần chạm/bấm/phím đầu tiên.
- `kitten-1.png`, `kitten-2.png` không còn được dùng (chưa xoá).

Kiểm tra: rig ở 4 pha bước chạy (`scratchpad/rig/test.png`) và trong cảnh ở 2 pha (`scratchpad/kitten-scene.png`);
`js syntax ok`; không lỗi console khi tải `localhost:8000`. Bản trước khi sửa: `scratchpad/backup-web/index-before-rig.html`.

## Update — mèo con chạy mượt hơn, sửa lỗi nhạc không phát

Nguyên nhân chạy chưa mượt:
1. Đi theo góc elip với tốc độ góc cố định nên tốc độ thật đổi từ ~10 đến ~245 đơn vị/s: hai đầu vòng chân chạy mà gần như đứng yên (trượt), đoạn giữa thì trôi nhanh hơn bước chân.
2. Hướng mặt lật ngay lập tức ở cuối vòng.
3. Mỗi khung hình trình duyệt phải dựng lại 7 lớp mask có blur.

Sửa (`web/index.html`):
- 7 mảnh cắt sẵn bằng canvas thành PNG có alpha (`web/assets/home/kitten/{body,tail,hind-far,front-far,hind-near,front-near}.png`, mới, tổng ~115KB);
  rig chỉ còn `<image>` + `transform`, không mask/filter.
- Vị trí theo quãng đường (bảng arc-length 1440 mẫu), tốc độ đều 120 đơn vị/s; nhịp bước = quãng đường / độ dài sải (40 × độ xa gần) nên chân không trượt.
  Dừng nghỉ thì tốc độ giảm dần và chân chậm theo.
- Quay đầu: chiều ngang thân co theo hướng vận tốc, đi qua bề rộng 20% rồi mở sang hướng mới.
- Dáng chân: chân nhấc lên (tối đa 9–11 đơn vị rig) khi đánh về phía trước, đặt xuống khi đẩy về sau; biên độ 22–26°.

Lỗi nhạc: trình duyệt chặn tự phát, nên lần bấm đầu của người dùng thường là vào nút nhạc — vốn bị loại khỏi listener "bấm đâu cũng bật" — và nút hiểu là tắt.
Sửa: khi đang muốn nghe mà chưa phát được thì nút hiện "Nhạc: bấm để nghe" (nhấp nháy) và bấm vào sẽ phát chứ không tắt;
thử phát ngay khi tải trang (chờ tối đa 300 ms); listener thêm `click`, `touchend`.

```
js syntax ok
blocked policy:  <title>ON-LOAD=Nhạc: bấm để nghe / AFTER-CLICK=Nhạc: bấm để nghe   (click giả lập không được tính là thao tác thật — không còn bị tắt)
allowed policy:  <title>ON-LOAD=Nhạc: bật / AFTER-CLICK=Nhạc: tắt
```

Ảnh 4 vị trí dọc vòng chạy: `scratchpad/kitten-poses.png`. Bản trước khi sửa: `scratchpad/backup-web/index-before-smooth.html`.
`kitten-rig.png`, `kitten-1.png`, `kitten-2.png` không còn được dùng (chưa xoá).

## Update — mèo lớn cắt sát viền, bỏ mèo con chạy quanh sân

- Người dùng báo mèo lớn dính lá cây và đầu chuyển động bị lag. Nguyên nhân: cắt bằng mask elip mờ mép (kéo theo lá/tường),
  và mỗi khung hình phải dựng lại 2 mask có blur.
- Cắt lại theo đường viền thật (tai, má, cằm; vai, hông, bàn chân, đuôi), lọc bỏ điểm ảnh xanh lá (g − r > 14) trong vùng cắt,
  cắt ở độ phân giải gốc: `web/assets/home/cat-head.png`, `cat-body.png` (mới). Mép cằm làm mờ dần 5px.
- Ảnh nền `home.jpg`: vùng đầu gốc (nới 2,5px) được lấp bằng khuếch tán màu từ viền vào, để khi đầu nghiêng không lộ tai gốc.
- Bỏ 2 mask `catMask`/`headMask`; góc nghiêng đầu tối đa giảm từ 6,5° xuống 4,5°.
- Theo yêu cầu, gỡ mèo con chạy quanh sân khỏi trang (markup + JS). File `assets/home/kitten/`, `kitten-rig.png`, `kitten-1.png`,
  `kitten-2.png` không còn được dùng (chưa xoá).

Kiểm tra: ảnh đầu mèo ở 0°, +4,5°, −4° không dính lá, không lộ tai gốc; so độ nét với ảnh gốc (phần mờ còn lại có ở cả nền, do khung chụp headless);
`js syntax ok`. Bản trước: `scratchpad/backup-web/index-before-bigcat.html`, `home-before-bigcat.jpg`.

## Update — "4 cái tai" khi lắc đầu: trình duyệt dùng ảnh nền cũ trong cache

- Ảnh người dùng gửi có viền tai thứ hai sau mỗi tai và lá cây phía sau đầu, tức là `home.jpg` cũ (còn đầu mèo gốc).
  File server trả về (`etag "23b3baa6…"`, 569261 B) đã lấp vùng đầu gốc. StaticFiles không gửi `Cache-Control` nên Edge
  dùng cache theo heuristic từ `Last-Modified` và không tải lại ảnh khi F5.
- Sửa: gắn `?v=<8 ký tự md5 của file>` vào URL `home.jpg`, `cat-head.png`, `cat-body.png`, `lantern-sprite.png` trong `web/index.html`.
  Đổi ảnh sau này thì đổi lại `v` theo md5 mới.
- Kiểm tra với profile Edge đã từng tải ảnh cũ, đầu nghiêng +4,5° và −4°: chỉ còn 2 tai (`scratchpad/ears-check.png`).
  Còn một viền màu nền rất mảnh cạnh tai phải khi nghiêng trái.

## Update — nhạc luôn mặc định bật, nút về góc phải dưới

- Người dùng thấy nhạc ở trạng thái tắt khi vào trang: lựa chọn "off" đã bị lưu trong `localStorage` từ lần bấm trúng lỗi cũ,
  nên mọi lần sau đều mặc định tắt. Bỏ hẳn việc ghi nhớ: lần nào vào trang cũng `wantsMusic = MUSIC.autoplay` (true);
  bấm tắt chỉ có tác dụng trong lần xem đó.
- Nhãn không còn "Nhạc: bấm để nghe"; luôn hiện "Nhạc: bật" khi đang muốn nghe (nút vẫn nhấp nháy nhẹ cho tới khi trình duyệt cho phát).
- Nút chuyển về góc phải dưới.

```
blocked run 1:  ON-LOAD=Nhạc: bật / AFTER-CLICK=Nhạc: bật
blocked run 2:  ON-LOAD=Nhạc: bật / AFTER-CLICK=Nhạc: bật
allowed policy:  ON-LOAD=Nhạc: bật / AFTER-CLICK=Nhạc: tắt
blocked after allowed-run toggled off:  ON-LOAD=Nhạc: bật / AFTER-CLICK=Nhạc: bật
```

Giới hạn trình duyệt: không trang nào được phát tiếng trước thao tác đầu tiên (bấm/gõ phím/chạm) của người dùng; nhạc bắt đầu ở thao tác đó.

## Update — nhạc phải tắt rồi bật lại mới kêu

- Nguyên nhân: `play()` gọi `ctx.resume()` nhưng chỉ chờ tối đa 300 ms (`Promise.race`). Trên Windows lần đầu mở thiết bị âm thanh
  thường lâu hơn, nên hàm trả "chưa phát" và không chạy bộ lập lịch nốt, dù sau đó AudioContext đã `running` — im lặng.
  Lần bấm thứ hai thì context đã sẵn sàng nên mới kêu.
- Sửa: bỏ timeout. Player nghe sự kiện `statechange` của AudioContext; hễ chuyển sang `running` mà đang muốn phát thì bắt đầu lập lịch,
  và báo lại cho nút qua `onPlayingChange`. Thêm chặn dồn nốt khi tab bị treo (bỏ qua các phách đã lỡ). File player dùng sự kiện `playing`/`pause`.
- Kiểm tra bằng click thật (DevTools Protocol `Input.dispatchMouseEvent`, Edge headless, chính sách tự phát mặc định):

```
== scenario: sky
load: Nhạc: bật (chờ)
after 1st real click on the sky: Nhạc: bật (đang phát)
== scenario: button
load: Nhạc: bật (chờ)
after 1st real click on music button: Nhạc: bật (đang phát)
```

  Với `--autoplay-policy=no-user-gesture-required`: `LOAD=Nhạc: bật (đang phát) / CLICK1=Nhạc: tắt / CLICK2=Nhạc: bật (đang phát)`.
  Bản trước khi sửa: `scratchpad/backup-web/index-before-musicfix.html`.

## Follow-ups

- `storybook.css`, `storybook.js`, `assets/storybook/` (của phiên khác) không còn được dùng; xoá hay giữ là quyết định của người dùng.
- Font biển LALAHOME tải từ Google Fonts; không có mạng thì dùng font dự phòng.
- Thư mục project chưa có commit nào (`git status` báo `?? ./`), nên không có `git diff` cho thay đổi này.

## Update 2026-10-13 — ảnh bìa co giãn theo màn hình, không mất hình khi zoom

- Trước: SVG dùng `preserveAspectRatio="xMidYMid slice"` và đổi `viewBox` khi màn hình hẹp. Màn rộng (1920×900) mất mái nhà/ống khói/lối đi;
  điện thoại & tablet dọc chỉ còn khúc giữa (mất cửa sổ, tổ chim, cắt mép biển LALAHOME). Đổi `viewBox` còn làm lệch tâm xoay của các animation
  dùng `transform-origin` theo px (đầu mèo, đèn lồng, biển Welcome).
- Sau: `viewBox` luôn `0 0 1672 941`; `fitScene()` tính vùng hiển thị chứa trọn vùng an toàn (ống khói, biển, cửa, cửa sổ, mèo, đèn lồng, lối đi:
  ngang x380–1640 y50–930, dọc x440–1500 y110–920), mở rộng tới mép tranh khi màn hình cho phép, rồi scale + translate cả SVG bằng CSS.
  Phần màn hình tranh không phủ được hiện bản tranh làm mờ (`.backdrop`) thay vì cắt.
- Màn dọc (rộng < cao): tranh ở trên, bên dưới là khung chào (LalaHome, mô tả, nút "Vào nhà – xem sản phẩm", "Yêu cầu báo giá", nút nhạc, mẹo).
  Nút nhạc co giãn theo `clamp()` để không che tranh khi zoom.
- Kiểm tra (ảnh chụp): 1920×900, 2560×900, 1280×800, zoom 200% (720×400), zoom 300% (480×300), 768×1024, 390×844, 844×390 — đều thấy trọn ống khói,
  biển, cửa, cửa sổ, mèo, đèn lồng; overflow ngang 0; nút nhạc hiện ở mọi khổ. Bản trước khi sửa: `scratchpad/backup-web/index-before-responsive.html`.

---

# Cập nhật 2026-10-13: thêm 2 bé mèo theo ảnh bro gửi

## Goal
Thêm vào ảnh bìa hai bé mèo, phối màu lông theo ảnh 3 bé thật của bro:
- **Tam thể đen-nâu** (bé bên phải trong ảnh): nằm cuộn tròn ngủ trên thảm trước cửa.
- **Mướp xám-nâu** (bé bên trái): cúi ăn hạt trong bát hồng hoa văn, giống bát trong ảnh.

Bé mèo vàng-trắng đã có sẵn, ứng với bé ở giữa ảnh.

## Success criteria
1. Có chuyển động: bé ngủ phập phồng và bay chữ "z"; bé ăn gật đầu vào bát và vẫy đuôi.
2. Bấm vào từng bé (cả 3) đều bay tim. Bấm bé ngủ không mở cửa; bấm cửa vẫn vào cửa hàng.
3. Trên điện thoại 390px hai bé nằm trọn trong khung. Không có lỗi console hay request hỏng.

## Changes
`web/index.html` (150 dòng diff, chỉ file này):
- Hai nhóm SVG `.sleeper` và `.eater`, cùng gradient và clipPath trong `<defs>`.
- CSS keyframes `sleep-breathe`, `sleep-head`, `zzz`, `eat`, `tail-sway`, kèm bản chậm hơn cho người bật giảm chuyển động.
- 2 vùng bấm `#catSleeper` và `#catEater`. `floatHeart()` nhận toạ độ để tim bay đúng chỗ từng bé.
- `.cat-hit:focus-visible`: viền focus chỉ hiện khi dùng bàn phím. Trước đây bấm chuột vào bé mèo vàng cũng hiện khung đen.

Hai bé được vẽ bằng vector (SVG) có viền và đổ bóng. Không có công cụ tạo ảnh vẽ tay nên nét không mịn bằng tranh nền. Bản sao trước khi sửa: scratchpad `backup-web/index-before-cats.html`.

## Result (`cats-test.mjs`, Edge headless, click thật)
```
PASS animations running: sleep-breathe, eat, tail-sway, zzz
PASS eating head actually moves: matrix(0.99741, -0.0719313, 0.0719313, 0.99741, 0, 0)
PASS click #cat gives a heart and stays on the cover: hearts 1, at 749,634, url http://localhost:8000/
PASS click #catSleeper gives a heart and stays on the cover: hearts 1, at 989,692, url http://localhost:8000/
PASS click #catEater gives a heart and stays on the cover: hearts 1, at 1272,822, url http://localhost:8000/
PASS door still opens the shop: http://localhost:8000/lalaflow/
PASS both new cats fully visible on a 390px phone: [true,true]
console/network errors: none
```
Đã xem ảnh chụp ở 1920, 1280 và 390 px.

Status: **DONE**.

## Cập nhật: vẽ lại 2 bé mèo (bro chê bản đầu xấu)
Lý do bản đầu lệch hẳn so với bé mèo cam vẽ trong tranh:
- viền đen dày 2.2px;
- mảng màu cắt gắt;
- sọc vẽ như bút dạ;
- màu xám đục.

Bản vẽ lại theo cách vẽ của bé cam:
- viền nâu mảnh 1.2–1.3px;
- mảng màu loang mềm bằng `feGaussianBlur` (`paintSoft`, `paintMid`, `paintFine`, `paintWide`), cắt theo hình thân bằng clipPath;
- vệt sáng ấm trên lưng, bóng mềm phía dưới;
- đầu to hơn, mặt ngủ có má hồng;
- tam thể có vệt loang không đều thay cho chấm tròn;
- cổ bé mướp nằm dưới thân để không lộ đường nối.

Chuyển động, vùng bấm và tim giữ nguyên. Bản đầu được lưu ở scratchpad `backup-web/index-cats-v1.html`.

Chạy lại `cats-test.mjs`: 7/7 PASS, không lỗi console hay request hỏng (kết quả giống bảng ở trên, chỉ khác giá trị matrix của đầu bé mướp).

Giới hạn còn lại: vẽ vector vẫn không đạt độ chi tiết của tranh vẽ tay như bé cam.

## Cập nhật: thay 2 bé vẽ vector bằng bản đổi màu của bé mèo cam (bro vẫn chê xấu)
Vẽ bằng code không đạt được nét như tranh, nên bỏ hẳn hai bé vector. Thay vào đó dùng lại chính hai hình `cat-body.png` và `cat-head.png` của bé cam (cắt ra từ tranh), chỉ đổi màu lông bằng bộ lọc SVG. Nhờ vậy nét vẽ, ánh sáng và độ chi tiết y hệt bé cam.

**Hai bộ lọc:**
- `#furTortie` (tam thể pha trắng): phần lông cam (lọc theo R−B cao) chuyển thành đen-nâu, thêm đốm đỏ gạch bằng `feTurbulence`. Phần trắng ở mõm, ngực và chân giữ nguyên.
- `#furTabby` (mướp xám-nâu): giảm độ bão hoà, chỉnh tông ấm, thêm sọc mờ bằng noise kéo dài, chỉ trên phần lông màu.
- Cả hai dùng `feMorphology erode 0.7` để gọt rìa răng cưa của hình cắt.

**Tư thế:** hình gốc là mèo ngồi, nên hai bé cũng ngồi.
- Tam thể ngủ gật: mắt nhắm cố định, đầu gà gật rồi giật tỉnh (`doze`), có chữ "z".
- Mướp ngồi ăn: mắt nhắm hài lòng, đầu cúi gật gù như đang nhai (`munch`), bát hồng đặt trước chân.
- Thân cả hai thở bằng keyframes `breathe` có sẵn.

Vị trí: tam thể ở bãi cỏ bên trái lối đi, mướp ở bãi cỏ bên phải. Không còn che biển Welcome hay tấm thảm.

`web/index.html` lệch 105 dòng so với bản trước khi thêm mèo. Hai bản vector được giữ ở scratchpad: `backup-web/index-cats-v1.html` và `index-cats-v2.html`.

**Result** (`twins-test.mjs`, click thật):
```
PASS animations running: breathe, doze, munch, zzz
PASS eating head actually moves: matrix(0.99952, -0.0309874, 0.0309874, 0.99952, 0, 6.66359)
PASS click #cat gives a heart and stays on the cover: hearts 1, at 749,634, url http://localhost:8000/
PASS click #catDozer gives a heart and stays on the cover: hearts 1, at 661,731, url http://localhost:8000/
PASS click #catEater gives a heart and stays on the cover: hearts 1, at 1243,746, url http://localhost:8000/
PASS door still opens the shop: http://localhost:8000/lalaflow/
PASS both new cats fully visible on a 390px phone: [true,true]
console/network errors: none
```
Đã xem ảnh chụp ở 1920 px.

Status: **DONE**, chờ bro duyệt bằng mắt.

## Cập nhật: dùng 2 bé mèo vẽ tay trong ảnh bro gửi (`images/7.png`)
Bro gửi bản tranh có sẵn 2 bé vẽ cùng nét với bé cam: một **mướp nằm ngủ** (bãi cỏ trái) và một **tam thể cúi ăn** bát trắng in chân mèo (bãi cỏ phải). Bỏ hẳn bản đổi màu và bản vẽ vector.

**Cách cắt:**
- 7.png cùng kích thước (1672×941) và cùng bố cục với ảnh gốc 1.png. Ảnh hiệu cho thấy hai ảnh chỉ khác nhau ở vùng hai bé mèo.
- Mask = điểm ảnh lệch > 30 so với 1.png, trong 2 hộp: sleep 236,682 300×140 và eat 1166,668 300×170.
- Làm sạch: close r3, lấp lỗ, bỏ đốm < 120 px, nới 2 px, làm mềm viền 2 px.
- Mask không chạm mép hộp, nên hai bé không bị hụt tai hay đuôi.
- Xử lý bằng canvas trong Edge headless (máy không có PIL). Kết quả là `web/assets/home/cat-sleep.png` và `cat-eat.png`, mỗi file ~120–140 KB.

**Chuyển động:**
- Mask bao cả hoa và tường mà AI vẽ lại quanh mèo, nên không thể cho cả hình chuyển động. Chỉ một mảng elip làm mờ viền (`#sleeperBody`, `#eaterBody`) nằm trong thân là phồng xẹp (`soft-breathe`). Hoa lá xung quanh đứng yên.
- Bé ngủ có chữ "z", bé ăn có 3 hạt thỉnh thoảng nảy khỏi bát (`crumb-hop`).
- Cả 3 bé bấm vào đều bay tim.

**Khung an toàn:** bé ngủ nằm sát mép trái (x 268), nên nới vùng luôn phải hiện: `SAFE_LANDSCAPE` x 380→255, `SAFE_PORTRAIT` x 440→255. Trên điện thoại, cảnh vì thế hiện nhỏ hơn một chút để vừa cả 3 bé.

`web/index.html` lệch 57 dòng so với bản trước khi thêm mèo. Các bản cũ được giữ ở scratchpad: `index-cats-v1.html`, `index-cats-v2.html`, `index-cats-v3-recolor.html`.

**Result** (`painted-test.mjs`):
- Lần chạy đầu FAIL ở bước "both new cats fully visible on a 390px phone" (`[false,true]`), vì bé ngủ nằm ngoài khung dọc. Sửa khung an toàn xong chạy lại:
```
PASS animations running: soft-breathe, soft-breathe, crumb-hop, zzz
PASS eating cat body actually moves: matrix(1.00244, 0, 0, 1.00611, 0, 0)
PASS click #cat gives a heart and stays on the cover: hearts 1, at 749,634, url http://localhost:8000/
PASS click #catSleeper gives a heart and stays on the cover: hearts 1, at 508,718, url http://localhost:8000/
PASS click #catEater gives a heart and stays on the cover: hearts 1, at 1452,721, url http://localhost:8000/
PASS door still opens the shop: http://localhost:8000/lalaflow/
PASS both new cats fully visible on a 390px phone: [true,true]
console/network errors: none
```
- Đã xem ảnh chụp ở 1920 px và 390 px: không lộ vết ghép.

Status: **DONE**.

## Cập nhật: chuyển động rõ hơn (thở cho bé ngủ, ăn cho bé tam thể)
Bro muốn chuyển động rõ hơn: bé ngủ thì thở, bé ăn thì có động tác ăn. Bản trước chỉ một mảng elip trong thân phồng xẹp nên gần như không thấy.

**Tách lớp** (`layers.js`). Đường viền từng phần được vẽ tay trên ảnh phóng 4× có lưới, nền dưới cùng là `home.jpg` (tranh gốc không có mèo):
- Bé ngủ: `cat-sleep-env` (vùng tranh mới vẽ lại, giữ nguyên) và `cat-sleep` (cả con mèo).
- Bé ăn, từ dưới lên:
  - `cat-eat-env`: tranh mới, khoét đúng lõi đầu và đuôi; lòng bát giữ nguyên;
  - `cat-eat`: thân, đường viền dừng sau gáy;
  - `cat-eat-tail`;
  - `cat-eat-head`;
  - `cat-eat-bowl`: thành trước của bát, để mặt bé chui ra sau khi cúi.

**Chuyển động:**
- `sleep-breathe` 4s: cả con mèo phồng tới 1.05 theo chiều dọc, gốc ở bụng dưới.
- `eat-dip` 3.4s: đầu xoay tối đa −4° quanh gốc tai phải (1265,735), lệch (−2.5px, 1.5px). Mỗi nhịp chúi 3 lần như đang nhai rồi nghỉ.
- `eat-breathe` 3s cho thân; `tail-sway` 2.8s, đuôi xoay −3°…4°.
- Các lớp chỉ phồng ra, không bao giờ co nhỏ hơn lúc nghỉ, nên không làm hở phần phía sau.

**Lỗi gặp và cách sửa:**
1. Điểm xoay ban đầu đặt ở cổ (1274,750) làm tai phải lệch, lộ vệt xám phía sau. Đã dời điểm xoay lên gốc tai phải.
2. Lớp thân được tạo bằng cách lấy cả con mèo trừ phần đầu (cả hai đều làm mờ viền) để lộ nền gốc ~25% ở mép.
3. Lỗ khoét nới rộng 2px làm lòng bát lộ màu cỏ xanh.

Lỗi 2 và 3 được sửa bằng cách:
- vẽ đường viền thân riêng;
- viền đầu và đuôi chỉ làm mờ 0.7px;
- chỉ khoét nền ở chỗ đầu và đuôi đục ≥ 50%;
- giữ nguyên lòng bát.

Sai lệch lúc đứng yên so với tranh: trước khi sửa `eat mean 4.02 worst 223`, sau khi sửa `sleep mean 2.71 worst 104, eat mean 2.03 worst 87`. Phần còn lại chủ yếu do `home.jpg` là JPEG.

Đã dừng hình ở lúc chuyển động lớn nhất (`freeze.mjs`) và xem ảnh phóng 3×: không có tai đôi, lòng bát còn hạt, không lộ vệt xám.

`web/index.html` lệch 65 dòng so với bản trước khi thêm mèo. Bản chỉ có ảnh tĩnh được giữ ở scratchpad `backup-web/index-cats-v4-static.html`.

**Result:**
```
PASS animations running: sleep-breathe, eat-dip, tail-sway, crumb-hop, zzz
PASS eating head actually moves: matrix(0.999506, -0.0314157, 0.0314157, 0.999506, -1.00019, 0.50013)
PASS click #cat gives a heart and stays on the cover: hearts 1, at 749,634, url http://localhost:8000/
PASS click #catSleeper gives a heart and stays on the cover: hearts 1, at 508,718, url http://localhost:8000/
PASS click #catEater gives a heart and stays on the cover: hearts 1, at 1452,721, url http://localhost:8000/
PASS door still opens the shop: http://localhost:8000/lalaflow/
PASS both new cats fully visible on a 390px phone: [true,true]
console/network errors: none
```

Status: **DONE**.

## Cập nhật: bro báo "chưa thấy 2 con mèo mới chuyển động"
Nguyên nhân:
1. Máy bro đang tắt hiệu ứng chuyển động của Windows (`HKCU\Control Panel\Desktop\WindowMetrics\MinAnimate = 0`). Edge vì thế báo `prefers-reduced-motion: reduce`, và CSS của trang làm chậm đầu bé ăn 3.4s→12s, đuôi 2.8s→7s, chữ "z" 4.5s→12s, nên gần như đứng im. Đã kiểm bằng `Emulation.setEmulatedMedia`:
   ```
   no-preference .sleeper-breath 4s, .eater-head 3.4s, .eater-tail 2.8s, .eater-breath 3s, .zzz text 4.5s
   reduce        .sleeper-breath 4s, .eater-head 12s, .eater-tail 7s, .eater-breath 3s, .zzz text 12s
   ```
2. Biên độ quá nhỏ: bụng bé ngủ chỉ phồng 1–2 px trên màn hình.

Đã sửa:
- **Bỏ hai bé mèo khỏi khối `prefers-reduced-motion`**, có comment giải thích. Chuyển động của chúng chậm và nhỏ, làm chậm thêm thì như đứng im. Khói, đèn lồng, biển và bé cam vẫn được làm chậm như cũ.
- **Tăng biên độ:**
  - `sleep-breathe` lên scale(1.02, 1.09), khoảng 10 px trên màn 1920;
  - `eat-dip` lên rotate(−7°) translate(−4px, 3px), đầu lệch khoảng 15 px ở tai trái;
  - `eat-breathe` lên scale(1.012, 1.035).
- **Bỏ chuyển động đuôi.** Ở biên độ lớn, chỗ đuôi vừa rời đi lộ mảng tường của tranh gốc, không khớp với tường của tranh mới, kèm một vệt tối. Đuôi giờ đứng yên.
- **Sửa mask:**
  - lỗ khoét dưới đầu tính từ độ đục ≥ 0.05 (trước là ≥ 0.5), để không sót đường viền cũ khi đầu cúi;
  - lớp thân lấn thêm ~3 px vào sau gáy.
- Khi đầu cúi sâu, phía sau lộ một bông cúc. Bông này có trong tranh gốc và bị đầu bé che, giữ lại vì hợp lý.

Sau khi sửa (`freeze.mjs` + `layered-test.mjs` + `reduced.mjs`):
```
PASS animations running: sleep-breathe, eat-dip, eat-breathe, crumb-hop, zzz
PASS eating head actually moves: matrix(0.999856, -0.0169488, 0.0169488, 0.999856, -0.48557, 0.291342)
PASS click #cat gives a heart and stays on the cover: hearts 1, at 749,634, url http://localhost:8000/
PASS click #catSleeper gives a heart and stays on the cover: hearts 1, at 508,718, url http://localhost:8000/
PASS click #catEater gives a heart and stays on the cover: hearts 1, at 1452,721, url http://localhost:8000/
PASS door still opens the shop: http://localhost:8000/lalaflow/
PASS both new cats fully visible on a 390px phone: [true,true]
console/network errors: none
no-preference .sleeper-breath 4s, .eater-head 3.4s, .eater-breath 3s, .zzz text 4.5s
reduce        .sleeper-breath 4s, .eater-head 3.4s, .eater-breath 3s, .zzz text 4.5s
```
Status: **DONE**.
