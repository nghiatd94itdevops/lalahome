# 2026-11-11 — Welcome mở Mimi nói chuyện trực tiếp

**Status:** DONE (chưa thử trên iPhone/Zalo thật — xem "Chưa kiểm")

## Goal

Khách bấm **Welcome** ở trang bìa → Mimi hiện giữa màn hình, chào bằng giọng "Chào bạn, mình là Mimi, trợ lý AI của
LaLa Home. Mình có thể giúp gì cho bạn?", rồi nghe khách trả lời và tư vấn, qua lại rảnh tay.
Không làm: đổi AI/backend, đổi khung chat nổi hay trang `/tro-ly`.

Người dùng chọn: Welcome mở Mimi (nút "Vào nhà – xem sản phẩm" ở bảng mobile giữ nguyên); chế độ rảnh tay.

## Success criteria

1. Welcome ở trang bìa → `/lalaflow/?mimi=1`; nút "Vào nhà – xem sản phẩm" giữ nguyên.
2. `?mimi=1` mở lớp phủ toàn màn hình, Mimi lớn ở giữa, câu chào hiện bằng chữ.
3. Trình duyệt cho phát tiếng → Mimi đọc câu chào rồi tự bật mic; bị chặn → hiện nút "Nói chuyện với Mimi", bấm một lần thì đọc và nghe.
4. Vòng rảnh tay: nghe → ngừng nói thì tự gửi → Mimi trả lời bằng giọng + hiện sản phẩm → tự nghe lại khi nói xong.
5. Có tạm dừng, ô gõ chữ, "Tự xem sản phẩm"/✕ để vào cửa hàng; đóng thì mic và giọng tắt.
6. Dùng chung cuộc trò chuyện với khung chat và `/tro-ly`.
7. `npm run build` qua; hiển thị đúng trên desktop và mobile.

## Thay đổi

- `components/MimiConversation.jsx` (mới): lớp phủ Mimi giữa màn hình, câu nói mới nhất, lời khách (trực tiếp khi đang nói),
  sản phẩm của câu trả lời, nút mic/tạm dừng, ô gõ, "Tự xem sản phẩm", "Xem cả cuộc trò chuyện" (→ `/tro-ly`), ✕/Esc.
  Chỉ tính tin nhắn từ lúc mở, để cuộc trò chuyện cũ trong tab không che câu chào.
- `useVoice.js` `useSpeaker`: `say()` trả kết quả `ended | stopped | blocked | failed`; `preload()` tải trước âm thanh câu chào
  để nút bấm phát ngay trong cú chạm (iPhone chỉ cho phát tiếng bắt đầu trong cú chạm); `speaking`, `preparing`;
  `silence()` khi đang tải thì huỷ luôn lần phát đó.
- `useAssistantChat.js`: tuỳ chọn `conversing` — luôn đọc câu trả lời, nói xong (kết quả `ended`) thì mở mic; `pause`/`resume`.
  Mimi chuyển trạng thái `talking` khi đang nói (áp dụng cả khung chat khi bật đọc to).
- `App.jsx`: `?mimi=1` mở lớp phủ; đóng thì bỏ `?mimi=1` khỏi URL (tải lại không chào lại).
- `styles.css`: khối `.mimi-talk*`. `web/index.html`: cửa Welcome → `lalaflow/?mimi=1`.
- **Khôi phục `LaLaHome/mimi-svg.js`, `LaLaHome/mimi-bot.js`**: thư mục `LaLaHome/` đã mất khỏi project sau đợt dọn
  (không có trong `_archive`, không trong git) nên build lỗi. Chép lại từ `_archive/2026-11-11/2_Chuyen_dong/Findy_Live/LaLaHome/`
  — kiểm chứng đúng bản cũ: 136/136 path SVG và 90/90 nhãn trạng thái có trong bundle build lúc 09:10, build lại ra đúng
  hash `index-csR8e0uZ.js` như bản đang chạy.

## Verification

```
build sau khôi phục LaLaHome (trước khi sửa code): index-csR8e0uZ.js — trùng hash bản đang deploy
npm run build: ✓ built in 1.28s (index-CpfGjPah.js, index-ClfeOCKc.css)

Chromium headless qua CDP, mic giả = file WAV câu "Tôi cần giấy dán tường chống ẩm cho phòng ngủ" (tạo bằng TTS):
A. desktop 1280x800, bấm cửa Welcome ở trang bìa
  door href: lalaflow/?mimi=1 | after Welcome click url: /lalaflow/?mimi=1
  greet → talking (đọc câu chào) → listening 'Mimi đang nghe, bạn cứ nói tự nhiên nhé.'
  heard 'Bạn: Cần giấy dán tường chống ẩm cho phòng ngủ' → thinking → searching → happy, products=4, 'Mimi chuẩn bị nói…'
  → talking 'Mimi đang nói…' → listening (mic tự mở lại sau khi nói xong)
  Tạm dừng → idle 'Đã tạm dừng. Bấm micro khi muốn nói tiếp.' | ✕ → open=False url=/lalaflow | saved chat messages: 2
  console: []
B. phone 390x844, vào thẳng link, trình duyệt chặn tự phát tiếng
  status 'Bấm nút bên dưới để nghe Mimi…' tap=True → bấm → talking (0.5s) → listening
  horizontal overflow: False | 'Tự xem sản phẩm' → /lalaflow/san-pham, open: False
  console: warning play() failed because the user didn't interact (đúng dự kiến, là tín hiệu hiện nút)
C. tab có sẵn cuộc trò chuyện cũ → says = câu chào, has-answer=False, old messages kept: 2
Ảnh: a1-greeting, a2-answer, b1-needs-tap, b2-listening — bố cục đúng desktop và mobile.
```

## Chưa kiểm / theo dõi

- **iPhone Safari, Zalo trong app**: chưa thử máy thật. Câu chào phát trong cú chạm (đã tải trước). Sau câu chào, mic
  mở **không** trong cú chạm — nếu Safari từ chối thì hiện lỗi mic, khách bấm nút micro một lần.
- Câu trả lời AI có markdown `**…**` hiện nguyên văn (khung chat cũ cũng vậy) — sửa ở prompt backend hoặc render, việc riêng.
- Màn hình thấp (~650px) + câu trả lời dài: sản phẩm nằm dưới, phải cuộn trong lớp phủ.
- ASR nhầm thỉnh thoảng ("dán" → "xán" ở một lần chạy) — giới hạn model, AI vẫn hiểu.
