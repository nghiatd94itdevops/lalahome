# LalaFlow

Trang khách hàng và trang quản trị LalaFlow, phục vụ tại `http://localhost:8000/lalaflow/` (cùng server với trang LalaHome).
Backend Express + MariaDB chạy bằng Docker ở cổng 4000.

## Mang source sang máy khác

Trên máy cũ, tại thư mục project:

```powershell
.\.venv\Scripts\python.exe scripts\pack_source.py
```

Script tạo file zip ở thư mục cha, bỏ `.venv`, `node_modules`, `.next`, log và các zip cũ, đồng thời xuất database
(`lalaflow/backups/lalaflow-data.sql`) và ảnh upload (`lalaflow/backups/uploads/`) từ Docker. File `.env` không được nén vì chứa mật khẩu;
chép riêng hoặc thêm `--include-env`. Không cần tắt server trước khi chạy.

Muốn nén nguyên vẹn cả thư mục (kể cả `node_modules`, `.venv`, log, `.env`), thêm `--full`: khoảng 500MB, ~50.000 file.
Giải nén vào thư mục có đường dẫn ngắn (ví dụ `C:\Work`), vì đường dẫn dài nhất trong zip gần 200 ký tự.

Không nén bằng chuột phải → Compressed folder hay WinRAR:
- npm có thể tạo junction (liên kết thư mục) trong `node_modules`; công cụ nén đi theo junction trỏ ngược về chính nó sẽ
  lặp vô hạn đến khi đường dẫn quá 260 ký tự thì lỗi. Script bỏ qua mọi junction; `npm install` tạo lại.
- Server đang chạy khoá vài file (`.next/dev/lock`), và database nằm trong Docker volume nên không có trong thư mục.

## Chạy trên máy mới

```powershell
# 1. Database + backend
cd lalaflow
copy .env.example .env          # sửa mật khẩu, JWT_SECRET, SMTP, OPENAI_API_KEY (trợ lý AI)
docker compose up -d --build
docker compose exec -T db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" lalaflow' < backups\lalaflow-data.sql
docker compose cp backups\uploads\. backend:/app/uploads/
docker compose restart backend

# 2. Web (chỉ cần nếu sửa giao diện; bản build sẵn đã nằm trong web/lalaflow)
cd frontend
npm install
npm run build

# 3. Server cổng 8000: làm theo README.md ở thư mục gốc
```

Kiểm tra: `http://localhost:4000/health` trả `{"ok":true}`, rồi mở `http://localhost:8000/`.
