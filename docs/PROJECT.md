# Planify Pro — tài liệu source hiện tại

Cập nhật ngày 06/11/2026. Tài liệu này mô tả code trong repository; khi có khác biệt, kiểm tra implementation và `/api/v1` trong Swagger trước khi sửa tài liệu.

## Kiến trúc

| Thành phần | Source và vai trò |
|---|---|
| Frontend | `frontend/index.html`, `frontend/js/`, `frontend/css/`: SPA JavaScript thuần với hash routes; Nginx phục vụ file tĩnh ở local, FastAPI phục vụ trong image Koyeb. |
| API | `backend/main.py`, `backend/app/api/v1/`: FastAPI, Bearer JWT và validation. |
| Nghiệp vụ | `backend/app/services/`, `backend/app/ai/`: task, event, conflict, recurrence, AI tools. |
| Dữ liệu | `backend/app/models/`, `backend/alembic/`: SQLAlchemy async + asyncpg trên PostgreSQL. |
| OTP/giới hạn yêu cầu | Redis; OTP 6 chữ số có hạn 5 phút, tối đa 5 lần nhập sai và thời gian chờ gửi lại 60 giây. |
| Chạy local | `docker-compose.yml`: frontend, backend, PostgreSQL, Redis; `backend/entrypoint.sh` chạy Alembic trước API. |
| Koyeb (cũ) | `Dockerfile.koyeb` giữ để tương thích; tài khoản mới cần gói trả phí, không phải hướng deploy Free hiện tại. |
| Deploy Render | `Dockerfile.render`, `render.yaml`: một Web Service, frontend + API chung origin, Neon/Upstash TLS, email qua Brevo HTTPS. Quy trình end to end trong README. |

Frontend lưu Bearer token trong `localStorage` và gọi `/api/v1` cùng origin (qua Nginx ở local, trực tiếp FastAPI trong image cloud). Dữ liệu task, event, list và conversation phải được giới hạn theo tài khoản đã xác thực. Không dùng mô tả JWT cookie/CSRF, React/Vite, FullCalendar hay `/api/chat` của bản kế hoạch trước để suy ra hành vi source này. Hướng dẫn deploy hiện tại nằm trong README.

## Chức năng hiện có

- **Auth:** `/otp/send`, `/otp/verify`, `/auth/register`, `/auth/login`, `/auth/reset-password`, `/users/me` và đổi mật khẩu. `MAIL_PROVIDER=smtp` (mặc định) dùng Gmail STARTTLS 587 với `SMTP_EMAIL`/`SMTP_PASSWORD` ở local; `MAIL_PROVIDER=brevo` dùng HTTPS API với `BREVO_API_KEY`/`MAIL_FROM_EMAIL` trên Render. OTP và reminder dùng chung transport; không fallback SMTP khi Brevo lỗi. Credentials mail tách riêng với bootstrap admin.
- **To Do:** CRUD list, task, step; hoàn thành/mở lại thủ công; tìm kiếm và lọc; ngày giờ, reminder, recurrence và kiểm tra trùng lịch. Icon danh sách dùng Lucide đồng bộ; kéo đường phân cách để đổi độ rộng danh sách trên desktop, lưu theo trình duyệt.
- **Calendar:** CRUD calendar và event; bốn chế độ xem ở frontend, kéo thả và xử lý sự kiện lặp. Task đã xếp lịch được hiển thị cùng lịch. Chỉ Event tự hoàn thành theo giờ kết thúc của từng lần diễn ra; Task quá hạn vẫn cần người dùng tích hoàn thành. Giữ cột `tasks.auto_complete` để tương thích dữ liệu cũ, API luôn trả/ghi false và không chạy tự hoàn thành Task; thay đổi này không cần migration schema.
- **Dashboard:** tổng hợp hôm nay và thống kê từ dữ liệu tài khoản.
- **AI:** conversation và chat thông qua service/tool backend; provider/model lấy từ cấu hình. Màn hình thanh toán trước AI là lời xác nhận mô phỏng, không có cổng thanh toán.
- **Settings:** profile, theme, múi giờ và tùy chọn nhắc việc.

Source không có đồng bộ Google/Outlook hoặc Pomodoro đang hoạt động.

Ô **Ghi chú & địa điểm** trong chi tiết Task và form Task/Event dùng chung một vùng nhập nhiều dòng. Dữ liệu cũ ở `location` và `note`/`description` được hiển thị đầy đủ cùng nhau; khi lưu từ ô này, toàn bộ nội dung được ghi vào `note` (Task) hoặc `description` (Event), và `location` được đặt null để tránh lặp. Không đổi schema database; nội dung kết hợp vượt 5.000 ký tự được báo lỗi để người dùng chỉnh sửa, không tự cắt dữ liệu.

## API chính

Base path: `/api/v1`; danh sách và schema đầy đủ ở <http://localhost:8000/docs> khi backend chạy.

| Nhóm | Routes |
|---|---|
| Tài khoản | `/otp`, `/auth`, `/users` |
| Công việc | `/lists` (alias `/task-lists`), `/tasks`, `/tasks/{id}/steps` |
| Lịch | `/calendars`, `/events` |
| Tổng hợp | `/dashboard/today`, `/dashboard/stats` |
| AI | `/ai/conversations`, `/ai/chat` |

## Kiểm thử

Frontend tests hiện có: `node --test frontend/tests/*.test.mjs`. Backend unit tests nằm trong `backend/tests/`; chạy bằng `python -m pytest tests -q` từ `backend` sau khi cài đủ dependency và `pytest`. Docker runtime không cài `pytest`. Nếu thêm integration test dùng database, phải cấu hình **database test riêng**, không reset database đang dùng.

Nghiệm thu dưới đây là danh sách ca cần chạy trên phiên bản hiện tại. Kết quả cũ của source khác không được tính là `Pass`. Một lỗi đã quan sát ở API: khi gọi `/tasks` với `view=important` cùng `list_id`, điều kiện list bị bỏ qua trong `backend/app/crud/task_crud.py`; TC-06 cần sửa và chạy lại.

## Functional Acceptance Cases

| Case | Yêu cầu kiểm chứng | Trạng thái hiện tại |
|---|---|---|
| TC-01 · FR-01 | Đăng ký qua OTP, đăng nhập, đặt lại/đổi mật khẩu; từ chối mã sai và truy cập dữ liệu riêng khi chưa xác thực. | Cần chạy lại đầy đủ, gồm email thật. |
| TC-02 · FR-02 | Tạo, đổi tên/màu/icon, sắp xếp và xóa list; xác nhận lưu sau refresh. | Cần chạy UI. |
| TC-03 · FR-03 | Tạo, sửa, xóa task với title, note, location, list, importance và thời gian tùy chọn. | Cần chạy UI. |
| TC-04 · FR-04 | Hoàn thành/mở lại task; kiểm tra To Do, Today, Overdue, Completed. | Cần chạy UI. |
| TC-05 · FR-05 | Thêm, đổi tên, hoàn thành, xóa step mà không làm đổi step của task khác. | Cần chạy UI. |
| TC-06 · FR-06 | Kết hợp search, ngày/khoảng ngày, trạng thái, importance, list; kiểm tra số lượng và reset. | **Lỗi đã biết** khi kết hợp importance + list; cần sửa và chạy lại. |
| TC-07 · FR-07 | Xếp lịch task với duration, recurrence, reminder; kiểm tra Calendar và lần lặp kế tiếp. | Cần chạy UI và email. |
| TC-08 · FR-08 | Tạo/sửa/dời/mở lại mục trùng giờ; xem conflict list và ba cách giải quyết. | Cần chạy UI. |
| TC-09 · FR-09 | Dùng bốn chế độ Calendar; sửa và kéo mục sang ngày/giờ mới mà không nhân bản ID. | Cần chạy UI. |
| TC-10 · FR-10 | Dashboard có dữ liệu, đang tải, rỗng và lỗi; đối chiếu dữ liệu tài khoản. | Cần chạy UI. |
| TC-11 · FR-11 | Yêu cầu tiếng Việt tìm/tạo/sửa, hỏi lại khi thiếu thông tin, xác minh dữ liệu và lỗi provider. | Cần chạy provider thật. |
| TC-12 · FR-12 | Hủy xóa, bỏ form chưa lưu, stale edit và lưu task detail có debounce. | Cần chạy UI. |
| TC-13 · FR-13 | Chuyển view/tab sau khi sửa dữ liệu; giá trị mới hiện ra nhưng filter/ngày lịch được giữ. | Cần chạy UI đa tab. |
| TC-14 · FR-14 | Sửa profile, đổi theme và tùy chọn nhắc việc; kiểm tra sau reload. | Cần chạy UI. |
| TC-15 · Cross-cutting | Chặn truy cập chéo tài khoản task/event/conversation; mobile, keyboard, ranh giới ngày, email. | Cần chạy đầy đủ trên source hiện tại. |

Git history vẫn giữ các tài liệu và bằng chứng cũ nếu cần tra cứu; chúng không nằm trong bộ tài liệu vận hành hiện tại.
