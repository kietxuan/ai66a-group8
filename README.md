# Planify Pro

Ứng dụng quản lý công việc, lịch cá nhân và trợ lý AI. Frontend dùng HTML/CSS/JavaScript ES Modules; backend dùng FastAPI, SQLAlchemy async, PostgreSQL và Redis. Source hiện tại không dùng React/Vite.

## Chạy local

Từ thư mục chứa `docker-compose.yml`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Điền các giá trị riêng trong `.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD` và `SECRET_KEY` ngẫu nhiên tối thiểu 32 ký tự. Giữ `.env` ngoài Git. Nếu dùng AI provider, đặt `AI_API_KEY`; model lấy từ `AI_MODEL`.

Để gửi OTP và email nhắc việc, đặt `SMTP_EMAIL` là địa chỉ Gmail và `SMTP_PASSWORD` là Gmail App Password (gửi qua `smtp.gmail.com:587`, STARTTLS). Nếu nâng cấp từ bản cũ, chuyển cấu hình gửi mail từ `ADMIN_EMAIL`/`ADMIN_PASSWORD` sang hai biến `SMTP_*`. `ADMIN_PASSWORD` chỉ là mật khẩu đăng nhập admin tạo lần đầu, có thể để trống để tắt bootstrap; khởi động lại không đặt lại mật khẩu admin đã tồn tại.

```powershell
docker compose up -d --build
docker compose ps
```

- Giao diện: <http://localhost:3000>
- Swagger API: <http://localhost:8000/docs>
- Kiểm tra backend: <http://localhost:8000/health>

Frontend gọi API cùng origin qua Nginx (`/api/v1`). Backend chạy Alembic khi container khởi động. Trước khi thay đổi migration trên database có dữ liệu, hãy sao lưu; không dùng `docker compose down -v` để sửa lỗi migration.

## Chuẩn bị Koyeb (một container)

`Dockerfile.koyeb` đóng gói FastAPI và frontend chung origin; không thay thế Docker Compose local. Build context phải là **gốc repository**, Dockerfile path là `Dockerfile.koyeb` (không chọn working directory `backend`). Cấu hình một Web Service, một instance, HTTP port `8000`, health check HTTP `GET /health`; giữ nguyên entrypoint/command của image. Entrypoint chạy Alembic trước Uvicorn, không có `--reload`.

1. Tạo PostgreSQL trên Neon và Redis trên Upstash. Không dùng database/Redis của người khác hoặc dữ liệu local để kiểm thử deploy.
2. Điền các biến từ `.env.koyeb.example` vào Environment/Secrets trên Koyeb. Không upload `.env` và không commit key. `DATABASE_URL` dùng driver `postgresql+asyncpg://`, bỏ query `sslmode`/`channel_binding`, đặt `DATABASE_SSL=true`. Mã hóa URL các ký tự đặc biệt trong user/password. TLS kiểm tra CA và hostname áp dụng cho cả migration và app. Upstash dùng URL `rediss://`, không dùng REST URL/token.
3. Tạo `SECRET_KEY` riêng bằng `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Cấu hình Gmail App Password ở `SMTP_PASSWORD`, không phải mật khẩu đăng nhập Gmail. `ADMIN_PASSWORD` để trống nếu không cần bootstrap admin. Đặt `AI_API_KEY` nếu cần Groq thật.
4. Build thử: `docker build -f Dockerfile.koyeb -t planify-koyeb .`. Để chạy thử, tạo file riêng `.env.koyeb.local` (được Git bỏ qua) trỏ tới **database/Redis thử**, rồi chạy `docker run --rm -p 127.0.0.1:3001:8000 --env-file .env.koyeb.local planify-koyeb`. Mở `http://localhost:3001/` và `/health`; xác nhận đăng ký/OTP, đăng nhập, CRUD và AI sau khi điền credentials thật.
5. Sau deploy, kiểm tra `/health`, tài nguyên JS/CSS, gửi OTP đến email của bạn và đăng nhập lại. Nếu OTP lỗi, kiểm tra SMTP credentials và kết nối cổng 587 trong logs, không đưa App Password vào ảnh/log công khai.

Giữ một worker/instance để tránh nhiều scheduler gửi nhắc trùng. Free instance có thể ngủ: OTP chỉ gửi khi có request, nhưng **nhắc lịch nền không bảo đảm đúng giờ khi service ngủ**. Log trong container không bền; xem console logs của Koyeb. Database/Redis phải ở dịch vụ ngoài. Kiểm tra điều khoản/gói phí hiện tại trước khi tạo dịch vụ; repository không tự tạo tài nguyên cloud.

## Chức năng và giới hạn

- Đăng ký/khôi phục tài khoản bằng OTP email, đăng nhập JWT Bearer; quản lý profile và giao diện sáng/tối.
- To Do: bảng công việc, danh sách, bước con, tìm kiếm, bộ lọc, ngày giờ, độ quan trọng, lặp và nhắc việc.
- Calendar: tháng, tuần, ngày, lịch biểu; sự kiện riêng và task có lịch; xử lý trùng giờ.
- Dashboard và trợ lý AI quản lý công việc/lịch bằng tiếng Việt.
- Màn hình “thanh toán $20” trước khi vào AI là **mô phỏng giao diện**, không thu tiền.

Ứng dụng không đồng bộ tài khoản Google/Outlook. Kết quả kiểm thử cũ không tự chứng minh source hiện tại đã nghiệm thu đầy đủ.

Xem [PROJECT.md](docs/PROJECT.md) để tra cứu kiến trúc, API, cách kiểm thử và bảng Functional Acceptance Cases.
