# 2026-11-11 — Docker hoá toàn bộ site để deploy lên VM bất kỳ

**Status:** DONE — build và chạy thật trên Docker 29.6.2 / Compose v5.3.1 (Windows, image linux/amd64).
Chưa thử trên VM Linux thật, chưa thử từ một bản `git clone` (xem Lưu ý).

## Goal

Một `docker-compose.yml` ở thư mục gốc: clone → tạo `.env` → `docker compose up -d --build` là chạy đủ web :8000, backend, MariaDB.

Không làm: file pipeline CI/CD, HTTPS/reverse proxy, sửa code app, xoá `lalaflow/docker-compose.yml` cũ.

## Success criteria

1. `docker compose config` hợp lệ; thiếu `JWT_SECRET`/mật khẩu DB thì dừng ngay.
2. Không cần `models/`, `node_modules`, `.venv` có sẵn: `up --build` → 3 container `healthy`.
3. Host chỉ mở cổng web; 4000 và 3306 không mở.
4. `/health`, `/lalaflow/`, `/api/health` (qua proxy tới backend) trả 200.
5. DB, ảnh upload, log còn sau `down` + `up`.
6. Image không chứa `.env`.

## Thay đổi

- `speech-service/Dockerfile` (mới, context = gốc repo): stage `frontend` build Vite ra `web/lalaflow` (cần `LaLaHome/`);
  stage `models` chạy `scripts/download_models.py`; image cuối `python:3.11-slim`, user không phải root, healthcheck `/health`.
- `docker-compose.yml` (mới): `db` (mariadb:11.4, schema init), `backend` (Dockerfile có sẵn, thêm healthcheck), `web`
  (`LALAFLOW_API_UPSTREAM=http://backend:4000`, cổng `${WEB_PORT:-8000}`). Biến bắt buộc dùng `${VAR:?}`.
- `.env.example` (mới, gốc repo), `.dockerignore` (mới), `README.md` (mục Deploy bằng Docker).

## Result

Dùng env thử (`WEB_PORT=8090`, project `lalahome-test`), sau đó `down -v`.

```
$ docker compose config -q            # không có .env
error while interpolating services.db.environment.MARIADB_PASSWORD: required variable DB_PASSWORD is missing a value: set DB_PASSWORD in .env
exit=1

$ docker compose ... up -d --wait
SERVICE   STATUS                    PORTS
backend   Up 12 seconds (healthy)   4000/tcp
db        Up 23 seconds (healthy)   3306/tcp
web       Up 6 seconds (healthy)    0.0.0.0:8090->8000/tcp, [::]:8090->8000/tcp

--- /health
{"status":"ok","asr_model":"sherpa-onnx-zipformer-vi-30M-int8-2026-02-09","tts_model":"vits-piper-vi_VN-vais1000-medium-int8","tts_voice":"piper"}
/ -> 200
/lalaflow/ -> 200
/api/health -> 200
/api/products -> 200
/sitemap.xml -> 200
--- api/health body: {"ok":true}
--- .env in image?   (find / -name .env trong web: không có; /app của backend: 0)
--- logs writable: uid=10001(app) ... ok

$ protocol_checks.py --base http://127.0.0.1:8090
...
PASS  C8 Vietnamese text returns valid WAV: status=200 rate=22050 channels=1 seconds=1.92
16/16 checks passed

$ (ghi probe vào DB, /app/uploads, /srv/logs) ; down ; up -d --wait
db: kept
uploads: probe
logs: probe

Image: web 526MB, backend 290MB.
```

## Lưu ý / để sau

- **`LaLaHome/` đang untracked** và nhiều file frontend chưa commit. Build image từ `git clone` sẽ lỗi ở bước Vite
  (`Mimi.jsx` import `../../../../LaLaHome/...`) cho tới khi commit chúng.
- Build cần internet: tải model từ GitHub releases (~200MB), npm, pip. Layer được cache nên build lại nhanh.
- Volume mới tên `lalahome_*`, khác `lalaflow_*` của compose cũ → máy đang chạy compose cũ muốn giữ dữ liệu thì phải
  xuất/nhập (như `lalaflow/README.md`).
- Backend Dockerfile cũ vẫn dùng `npm install` (không phải `npm ci`) — không sửa trong thay đổi này.
- Mic trên trình duyệt cần HTTPS: vẫn cần reverse proxy/TLS trước cổng 8000 (khi đó `TRUST_PROXY=2`).
