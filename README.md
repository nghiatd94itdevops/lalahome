# LalaHome

Website LalaHome: trang bìa (ngôi nhà, mèo Mimi), trang khách hàng và quản trị **LalaFlow** (giấy, bao bì, in ấn),
trợ lý AI có giọng nói tiếng Việt. Một server cổng **8000** phục vụ toàn bộ phía trình duyệt; backend LalaFlow và
MariaDB chạy trong Docker.

```
Trình duyệt ── :8000  speech-service (FastAPI, uvicorn)
                ├─ /                    trang bìa LalaHome          web/index.html, web/assets/
                ├─ /lalaflow/…          app LalaFlow (React build)  web/lalaflow/  + HTML dựng sẵn cho SEO
                ├─ /api/…        ──────► :4000 LalaFlow backend (Express, Docker) ──► MariaDB (Docker volume)
                ├─ /v1/stt/stream       nói → chữ (WebSocket)       models/ (sherpa-onnx, CPU)
                ├─ /v1/audio/speech     chữ → giọng nói
                └─ /robots.txt, /sitemap.xml, /llms.txt
```

## Cấu trúc thư mục

| Thư mục | Nội dung |
|---|---|
| `speech-service/app/` | Server :8000 — file tĩnh, proxy `/api`, HTML dựng sẵn cho SEO (`lalaflow_pages.py`), STT/TTS |
| `speech-service/tests/` | Kiểm tra giao thức STT/TTS, tải đồng thời, báo cáo độ chính xác |
| `web/` | Trang bìa LalaHome, `pcm-worklet.js` (thu âm cho trợ lý), bản build LalaFlow trong `web/lalaflow/` |
| `lalaflow/frontend/` | Source React (Vite) — build ra `web/lalaflow/` |
| `lalaflow/backend/` | API Express (sản phẩm, đơn hàng, đánh giá, chat AI…) |
| `lalaflow/database/` | Schema MariaDB; `lalaflow/backups/` bản xuất dữ liệu (không vào git) |
| `LaLaHome/` | Bộ nhận diện mèo Mimi — `mimi-svg.js`, `mimi-bot.js` được frontend import trực tiếp |
| `scripts/` | Tải model giọng nói, đóng gói source |
| `docs/worklogs/` | Nhật ký thay đổi và kết quả kiểm tra |
| `models/`, `logs/` | Model tải về, log chạy — không vào git |
| `_archive/` | Source cũ không dùng, giữ để tham khảo — không vào git, không đóng gói |

## Chạy

Yêu cầu: Python 3.11, Node.js 20+, Docker.

```powershell
# 1. Backend + database
cd lalaflow
copy .env.example .env                 # đặt mật khẩu DB, JWT_SECRET, SMTP, OPENAI_API_KEY, TRUST_PROXY
docker compose up -d --build
cd ..

# 2. Frontend (chỉ khi sửa giao diện; bản build đã nằm trong web/lalaflow)
cd lalaflow\frontend
npm install
npm run build
cd ..\..

# 3. Server :8000
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r speech-service\requirements.txt
.\.venv\Scripts\python.exe scripts\download_models.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir speech-service --host 127.0.0.1 --port 8000
```

Kiểm tra: `http://localhost:4000/health` trả `{"ok":true}`, rồi mở `http://localhost:8000/` và `http://localhost:8000/lalaflow/`.

Chuyển sang máy khác (kèm dữ liệu): xem `lalaflow/README.md` và `scripts/pack_source.py`.

## Deploy bằng Docker (một VM)

Chỉ cần Docker + Compose v2 trên VM. Cả 3 phần (web :8000, backend, MariaDB) chạy bằng `docker-compose.yml` ở thư mục gốc;
image web tự build frontend và tải model giọng nói, không cần `.venv`, `models/`, `node_modules`.

```bash
cp .env.example .env      # bắt buộc: DB_ROOT_PASSWORD, DB_PASSWORD, JWT_SECRET (thiếu là compose dừng ngay)
docker compose up -d --build --wait
curl -s localhost:8000/health
```

Chỉ cổng `WEB_PORT` (mặc định 8000) mở ra host; backend và DB nằm trong mạng nội bộ của Docker. Dữ liệu nằm ở volume
`lalahome_db_data`, `lalahome_backend_uploads`, `lalahome_web_logs` — `docker compose down` giữ nguyên, `down -v` **xoá**.
`lalaflow/docker-compose.yml` cũ vẫn dùng cho cách chạy dev ở trên; không chạy cả hai cùng lúc trên một máy.

## Cấu hình

**Server :8000** (biến môi trường, mặc định trong `speech-service/app/config.py`):

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PUBLIC_SITE_URL` | trống | Domain thật cho canonical/sitemap, vd. `https://lalahome.vn`. Trống = lấy host của request (ngrok) |
| `LALAFLOW_API_UPSTREAM` | `http://127.0.0.1:4000` | Backend mà `/api/*` chuyển tới |
| `MAX_STREAMS` | `5` | Số luồng nói → chữ cùng lúc |
| `ASR_MODEL_DIR`, `TTS_MODEL_DIR`, `VAD_MODEL` | thư mục `models/` | Model giọng nói |
| `AZURE_SPEECH_KEY` | trống | Key tài nguyên Azure Speech. Có key → Mimi đọc bằng giọng Azure; lỗi/hết quota → tự đọc bằng Piper local (bỏ qua Azure 60 giây). Trống = chỉ Piper |
| `AZURE_SPEECH_REGION` | `southeastasia` | Region của tài nguyên Speech (phải khớp với key) |
| `AZURE_TTS_VOICE` | `vi-VN-HoaiMyNeural` | Giọng Azure; giọng nam: `vi-VN-NamMinhNeural` |

Đặt key khi chạy (PowerShell): `$env:AZURE_SPEECH_KEY = "<key>"; $env:AZURE_SPEECH_REGION = "<region>"` rồi chạy lệnh uvicorn ở bước 3.
Không ghi key vào source hay commit. Khi bật Azure, **chữ** câu trả lời của Mimi được gửi sang Microsoft để đọc; giọng khách vẫn
nhận dạng tại server. `/health` cho biết giọng đang dùng (`tts_voice`), mỗi file âm thanh có header `X-TTS-Engine: azure|piper`.

**Backend LalaFlow** (`lalaflow/.env`, mẫu ở `.env.example`): `DB_ROOT_PASSWORD`, `DB_PASSWORD`, `JWT_SECRET`, `SMTP_*`,
`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `CHAT_DAILY_LIMIT`, `TRUST_PROXY`.

## Trước khi deploy thật

- **Domain + HTTPS**: mic trên trình duyệt chỉ chạy qua HTTPS; đặt `PUBLIC_SITE_URL` rồi khai báo `sitemap.xml` với Google Search Console.
- **Chỉ mở cổng 8000** ra ngoài (qua reverse proxy/tunnel). Không public cổng 4000 hay MariaDB.
- **`TRUST_PROXY`** hiện tin cả dải mạng nội bộ (`loopback, uniquelocal`); thu hẹp về đúng địa chỉ proxy khi deploy.
- **Dữ liệu mẫu**: 50 sản phẩm `[Mẫu]` lấy từ cửa hàng khác (ảnh có watermark) — gỡ bằng
  `py -3.11 lalaflow\scripts\sample_products.py remove` trước khi mở cho khách.
- **License model ASR** mặc định `zipformer-vi-30M` là **CC-BY-NC-ND-4.0, không dùng thương mại** — đổi sang model khác trước
  khi kinh doanh. TTS `vits-piper-vi_VN-vais1000`: dataset VAIS-1000, CC-BY-4.0.
- Đánh giá sản phẩm hiện ngay khi khách gửi, chưa có màn admin để xoá.

## Kiểm tra

```powershell
cd speech-service\tests
..\..\.venv\Scripts\python.exe protocol_checks.py        # giới hạn luồng, ngắt kết nối, lỗi giao thức, TTS
..\..\.venv\Scripts\python.exe load_test.py --streams 5  # độ trễ khi 5 luồng cùng nói
..\..\.venv\Scripts\python.exe feedback_report.py        # độ chính xác từ đánh giá Đúng/Sai (logs/feedback.jsonl)
..\..\.venv\Scripts\python.exe azure_tts_checks.py       # client giọng Azure với endpoint giả (không cần key, không cần server)
```

Server cần đang chạy ở `http://127.0.0.1:8000` (đổi bằng `--base`).
