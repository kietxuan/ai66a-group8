# Planify Pro

Ứng dụng quản lý công việc và lịch cá nhân: Vanilla JavaScript ES Modules, FastAPI, SQLAlchemy async, PostgreSQL và Redis.

## Chức năng hiện có

- Đăng ký xác minh email bằng OTP, đăng nhập JWT Bearer, profile và đặt lại mật khẩu.
- To Do: Kanban theo trạng thái, danh sách tùy chỉnh, tìm kiếm, đánh dấu quan trọng, bước con, thời gian và lặp công việc.
- Calendar: Tháng / Tuần / Ngày / Lịch biểu; kéo thả, resize và sự kiện lặp. Task có ngày dùng chung dữ liệu với To Do.
- Dashboard, chat AI/workspace và NLP local, nhắc lịch, xuất ICS/JSON.
- Mỗi lần rời AI sang trang khác rồi quay lại, giao diện gói $20/tháng hiển thị phương thức thanh toán; bấm “Thanh toán $20.00” rồi xác nhận để vào AI. Đây chỉ là giao diện mô phỏng: không thu tiền, không có cổng thanh toán hay ô nhập thông tin thẻ. Xác nhận chỉ có hiệu lực cho lần truy cập AI hiện tại, không lưu vào trình duyệt; tải lại trang hoặc đăng nhập lại cũng sẽ hiện thông báo.
- Sự kiện trong bảng events giữ định danh riêng; AI không tạo thêm bản sao task không liên kết.

Không có đồng bộ tài khoản Google/Outlook. Pomodoro đã được bỏ khỏi khởi tạo app. Không coi các tính năng được nhắc trong tài liệu lịch sử là chức năng đang bật.

## Khởi chạy

Chạy từ thư mục chứa docker-compose.yml. Nếu đã có .env, giữ nguyên và bổ sung trường còn thiếu; không ghi đè cấu hình thật:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Điền secrets riêng: PostgreSQL, Redis và SECRET_KEY ngẫu nhiên tối thiểu 32 ký tự. Placeholder JWT sẽ bị từ chối khi startup. ADMIN_PASSWORD để trống sẽ không bootstrap admin; startup không xóa admin khác hoặc reset mật khẩu tài khoản có sẵn.

OTP đăng ký/đặt lại mật khẩu cần SMTP_USERNAME, SMTP_PASSWORD và SMTP_FROM_EMAIL (cùng SMTP_HOST/SMTP_PORT). Chúng độc lập với mật khẩu đăng nhập admin. Không cấu hình SMTP thì API báo không gửi được email, không bỏ qua OTP hoặc báo gửi thành công giả.

AI_API_KEY có thể trống để dùng NLP local. AI_MODEL giữ theo .env; không tự đổi provider/model. Không commit .env.

```bash
docker compose up -d --build
```

- [Giao diện](http://localhost:3000)
- [Swagger](http://localhost:8000/docs)

Backup database trước khi nâng cấp. Entrypoint chạy Alembic; không dùng down -v hoặc reset DB để chữa migration. File requirements.lock khóa môi trường Python 3.11/Linux của Docker đã kiểm thử.

## Tài liệu

- [Tổng quan source](docs/00-tong-quan-du-an.md), [API thiết kế](docs/02-api-design.md).
- [Lịch sử import source](docs/SOURCE_IMPORT_2026-11-02.md), [README trước import](docs/README_PLANNING.md).
- [Snapshot kế hoạch local](docs/planning-baseline/README.md).

Nhánh sửa lỗi không tự cập nhật web đang chạy từ folder todo-list-pro. Các tài liệu lịch sử không thay thế kiểm chứng cho source hiện tại.
