# Planify Pro

Ứng dụng quản lý công việc, lịch cá nhân và trợ lý AI. Frontend dùng HTML/CSS/JavaScript ES Modules; backend dùng FastAPI, SQLAlchemy async, PostgreSQL và Redis. Source hiện tại không dùng React/Vite.

## Chạy local

Từ thư mục chứa `docker-compose.yml`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Điền các giá trị riêng trong `.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD` và `SECRET_KEY` ngẫu nhiên tối thiểu 32 ký tự. Giữ `.env` ngoài Git. Nếu dùng AI provider, đặt `AI_API_KEY`; model lấy từ `AI_MODEL`.

Để gửi OTP và email nhắc việc, đặt `ADMIN_EMAIL` là địa chỉ Gmail và `ADMIN_PASSWORD` là Gmail App Password. Code hiện tại gửi qua `smtp.gmail.com:587` và **không đọc** các biến `SMTP_*`. `ADMIN_PASSWORD` cũng dùng để tạo admin lần đầu; khởi động lại không đặt lại mật khẩu của admin đã tồn tại.

```powershell
docker compose up -d --build
docker compose ps
```

- Giao diện: <http://localhost:3000>
- Swagger API: <http://localhost:8000/docs>
- Kiểm tra backend: <http://localhost:8000/health>

Frontend gọi API cùng origin qua Nginx (`/api/v1`). Backend chạy Alembic khi container khởi động. Trước khi thay đổi migration trên database có dữ liệu, hãy sao lưu; không dùng `docker compose down -v` để sửa lỗi migration.

## Chức năng và giới hạn

- Đăng ký/khôi phục tài khoản bằng OTP email, đăng nhập JWT Bearer; quản lý profile và giao diện sáng/tối.
- To Do: bảng công việc, danh sách, bước con, tìm kiếm, bộ lọc, ngày giờ, độ quan trọng, lặp và nhắc việc.
- Calendar: tháng, tuần, ngày, lịch biểu; sự kiện riêng và task có lịch; xử lý trùng giờ.
- Dashboard và trợ lý AI quản lý công việc/lịch bằng tiếng Việt.
- Màn hình “thanh toán $20” trước khi vào AI là **mô phỏng giao diện**, không thu tiền.

Ứng dụng không đồng bộ tài khoản Google/Outlook. Kết quả kiểm thử cũ không tự chứng minh source hiện tại đã nghiệm thu đầy đủ.

Xem [PROJECT.md](docs/PROJECT.md) để tra cứu kiến trúc, API, cách kiểm thử và bảng Functional Acceptance Cases.
