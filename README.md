# ✨ Planify Pro — Hệ sinh thái Quản lý Thời gian, Công việc & AI Agent

**Planify Pro** là ứng dụng hợp nhất sức mạnh của **Google Calendar**, **Outlook Calendar** và **Microsoft To Do** kèm theo **Dashboard Thống kê Chuyên sâu** và **AI Agent 32 Tools**. Toàn bộ Frontend được xây dựng 100% bằng **HTML5, CSS3 và Vanilla JavaScript (ES Modules)** siêu nhẹ, mượt mà trên cả máy tính và điện thoại.

---

## 🌟 Điểm nổi bật trong phiên bản nâng cấp toàn diện

1. **Trang chủ Landing Page (`/`) & Luồng Đăng ký / Đăng nhập mượt mà**:
   - Trang chủ hiện đại với nút **Đăng nhập** và **Đăng ký** trực quan.
   - Sau khi đăng ký hoặc đăng nhập, hệ thống tự động chuyển hướng vào trang **Dashboard (`#dashboard`)** biểu đồ thống kê.
2. **Bố cục 5 Thẻ Điều hướng Chính (Sidebar Trái trên Desktop & Bottom Bar trên Điện thoại)**:
   - 📊 **1. Dashboard (`#dashboard`)**: Điểm năng suất cá nhân (0-100), 6 thẻ KPI, Biểu đồ cột xu hướng 7 ngày, Biểu đồ tròn phân bổ trạng thái công việc, Ma trận ưu tiên Eisenhower (2x2), Tiến độ theo danh sách và Trạm tập trung **Pomodoro 25 phút**.
   - ✅ **2. To Do (`#todo`)**: 7 danh sách thông minh (*My Day, Important, Planned, Time-Blocked, Quá hạn, Đã hoàn thành, All Tasks*), Danh sách tùy chỉnh, chuyển đổi linh hoạt giữa **Danh sách** và **Bảng Kanban 4 cột**, Subtasks (Steps), chọn nhiều (**Bulk Actions**), nhấp đúp chuột trái để sửa tên nhanh.
   - 📅 **3. Calendar (`#calendar`)**: 5 chế độ xem (*Ngày, Tuần làm việc T2-T6 chuẩn Outlook, Tuần 7 ngày, Tháng, Lịch biểu 30 ngày*), Khay **Việc cần xếp lịch** để kéo thả trực tiếp công việc từ To Do vào khung giờ trên lịch, Chuỗi sự kiện lặp lại (RFC 5545 RRULE) và xuất lịch chuẩn `.ICS`.
   - 🤖 **4. AI Assistant (`#ai` + Panel trượt nhanh)**: Trang làm việc AI chuyên biệt kèm thư viện câu lệnh mẫu và cửa sổ trượt nhanh ở góc phải. AI được trang bị **32 Tools** thao tác toàn diện trên Sự kiện, Lịch, Công việc, Bước con, Thống kê và Tự động lập kế hoạch *My Day* (`auto_plan_my_day`), đồng thời tích hợp **Smart Hybrid NLP Engine** hoạt động mượt mà ngay cả khi chưa cấu hình khóa API ngoài. Có các kiểm tra giới hạn thao tác can thiệp mật khẩu/bảo mật; cần kiểm thử trước khi triển khai public.
   - 📖 **5. Hướng dẫn (`#guide`)**: Trang cẩm nang tương tác hướng dẫn chi tiết từng phân hệ, thao tác chuột trái/phải, phím tắt và kịch bản thực hành AI.
3. **Thao tác Chuột trái & Chuột phải Siêu mượt**:
   - **Quét giữ chuột trái trên lưới giờ Calendar**: Chọn khoảng thời gian bất kỳ (bước nhảy 15 phút) để mở ngay cửa sổ tạo Sự kiện hoặc Time-Block.
   - **Kéo thả bằng chuột trái**: Di chuyển sự kiện/công việc giữa các giờ và các ngày, kéo mép dưới thẻ để thay đổi thời lượng, kéo việc từ khay bên trái thả vào lịch, hoặc kéo thả thẻ giữa các cột Kanban.
   - **Nhấp đúp chuột trái (Double-click)**: Đổi tên nhanh công việc ngay trên dòng.
   - **Menu Chuột phải (Context Menu)**: Đầy đủ thao tác nhanh trên cả Sự kiện và Công việc.

---

## 🚀 Hướng dẫn Khởi chạy Nhanh (Docker Compose)

Sau khi clone repository, tạo file `.env` local từ `.env.example` (file `.env` không được commit). Điền secrets riêng và đổi các mật khẩu mặc định trước khi chạy; không dùng cấu hình mẫu trên môi trường public:

```powershell
Copy-Item .env.example .env
```

Sau đó chạy Docker Compose:

```bash
docker compose up -d --build
```

Hoặc sử dụng `Makefile`:

```bash
make dev
```

- **Giao diện người dùng (Frontend)**: [http://localhost:3000](http://localhost:3000)
- **Tài liệu API (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)


## Source hiện tại và tài liệu cũ

Source hiện tại được nhập từ `todo-list-pro/todo-list` theo xác nhận của nhóm ngày 2026-11-02. Xem [ghi chú import, kiểm tra và giới hạn](docs/SOURCE_IMPORT_2026-11-02.md).

- [Tổng quan bản hiện tại](docs/00-tong-quan-du-an.md), [API bản hiện tại](docs/02-api-design.md), [kế hoạch implementation bản hiện tại](docs/07-implementation-plan.md).
- [README bản trước trên GitHub](README_PLANNING.md); các tài liệu kế hoạch/kiểm thử cũ trong docs được giữ để tham khảo, không phải bằng chứng bản mới đã qua cùng bộ test.
- [Snapshot kế hoạch local chưa commit](docs/planning-baseline/README.md) được lưu riêng, không ghi đè tài liệu đã có trên GitHub.

Lượt import này không chứng nhận app hoàn thành hoặc đã deploy. Không chạy các script/migration từ phiên bản cũ với schema của phiên bản mới.
