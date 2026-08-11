# PROJECT SPECIFICATION

## 1. Tên đề tài
**Todo List Calendar tích hợp AI Chatbot**

## 2. Mô tả tổng quan
Ứng dụng web quản lý công việc cá nhân, kết hợp Todo List, Calendar và AI Chatbot.

Người dùng có thể quản lý task thủ công qua giao diện hoặc nhập yêu cầu bằng ngôn ngữ tự nhiên, ví dụ:
> “Ngày mai lúc 8 giờ tối thêm cho tôi task học JavaScript trong 2 tiếng.”

AI phân tích yêu cầu và trả dữ liệu có cấu trúc. Backend kiểm tra dữ liệu, user, conflict và sau đó mới thực hiện thao tác trên database.

## 3. Mục tiêu
- Tạo và quản lý công việc cá nhân.
- Task có ngày, giờ bắt đầu và giờ kết thúc.
- Hiển thị task ở Todo List và Calendar.
- Hỗ trợ hoàn thành, chỉnh sửa và xóa task.
- Search/filter theo ngày, trạng thái, priority và category.
- Chatbot quản lý task bằng ngôn ngữ tự nhiên.
- Chatbot có thể truy vấn lịch làm việc.
- Phát hiện task bị trùng thời gian.
- Chatbot hỏi lại khi thông tin thiếu hoặc không rõ.
- Có frontend, backend, database và REST API hoàn chỉnh.

## 4. Người dùng
Tài liệu hiện tại xác định một loại người dùng chính:
- Người dùng đã đăng ký tài khoản.

Chưa có yêu cầu về Admin/Staff/Role khác.

## 5. Functional Requirements

### 5.1 Authentication
- Register.
- Login.
- Logout.
- Mỗi user chỉ truy cập task của chính mình.
- Password được hash trước khi lưu.

### 5.2 Task Management
Task có thể gồm:
- title
- description
- task_date
- start_time
- end_time
- priority
- category_id
- status

Người dùng có thể:
- Create task.
- Read/list task.
- Update task.
- Delete task.
- Mark task completed.
- Search/filter task.

Các nhóm hiển thị dự kiến:
- Today
- Tomorrow
- Upcoming
- Completed
- Pending

### 5.3 Calendar
- Month View.
- Week View.
- Day View.
- Task thay đổi ở Todo List phải phản ánh trên Calendar và ngược lại.
- Todo List và Calendar dùng chung dữ liệu task.

### 5.4 AI Chatbot
Chatbot hỗ trợ:
- tạo task;
- xem lịch/task;
- chỉnh sửa task;
- xóa task;
- đánh dấu hoàn thành;
- hỏi lại khi thiếu thông tin;
- yêu cầu user phân biệt task nếu nhiều kết quả phù hợp;
- confirmation trước thao tác cần thiết.

AI không trực tiếp thao tác database.

### 5.5 Conflict Detection
Khi create/update thời gian task, backend kiểm tra conflict ngay ở Task API:
- kiểm tra overlap với task hiện có;
- thông báo task bị conflict;
- cho user chọn:
  - đổi thời gian;
  - hủy;
  - vẫn tiếp tục.

Conflict detection core nằm trong Week 3 Task API. Week 4 xử lý flow ở Todo List, Week 7 xử lý flow qua chatbot và Week 8 kiểm thử/hardening.

### 5.6 Dashboard — Optional
Chỉ thực hiện nếu còn thời gian:
- today's tasks;
- upcoming tasks;
- completed count;
- remaining count;
- progress percentage;
- task theo priority/category.

## 6. MVP Scope
MVP gồm:
- Register/Login.
- Create/Edit/Delete/Complete Task.
- Ngày và giờ bắt đầu/kết thúc.
- Priority.
- Category.
- Todo List.
- Search & Filter.
- Calendar.
- Backend API.
- Database.
- Authentication.
- Chatbot.
- Chatbot create/query/update/delete/complete task.
- Clarification khi thiếu/ambiguous.
- Conflict detection.

## 7. Out of MVP / Optional
- Dashboard.
- Statistics.
- Phân tích thói quen.
- Đề xuất lịch làm việc.
- Notification.

## 8. Non-functional Requirements có thể xác nhận từ plan
- Dữ liệu từng user phải được cách ly.
- Password không lưu plain text.
- Backend là lớp kiểm soát trước khi database bị thay đổi.
- Chatbot không được tự đoán khi thiếu dữ liệu quan trọng.
- UI Todo List và Calendar phải đồng bộ vì dùng chung dữ liệu.

## 9. Technology Decisions đã chốt
- Database: PostgreSQL.
- LLM provider: Google Gemini API.
- LLM model: Gemini 2.5 Flash.
- AI integration: Gemini API + Structured Output / Function Calling.
- Authentication: JWT access token trong HttpOnly cookie + bcrypt.
- Refresh token: không nằm trong MVP.
- Python: 3.11.
- Backend persistence: SQLAlchemy 2 + Alembic + psycopg.
- Testing: Vitest + React Testing Library + pytest + HTTPX/FastAPI TestClient; Postman/REST Client cho manual API testing.
- Deployment: Render cho frontend/backend và Neon cho PostgreSQL.
- Project duration: 10 tuần, tương ứng 10 phase.

## 10. Final MVP Decisions
- ID database là integer identity.
- Email user là unique và được normalize lowercase.
- `priority`: `low`, `medium`, `high`; mặc định `medium`.
- `status`: `pending`, `completed`; mặc định `pending`.
- `category_id` là optional.
- `task_date` bắt buộc; start/end time phải cùng có hoặc cùng không có.
- Timezone ứng dụng là `Asia/Ho_Chi_Minh`.
- Conflict boundary bằng nhau không bị xem là overlap.
- Conflict response dùng HTTP `409` và request flag `allow_conflict`.
- Không pagination trong MVP.
- Không lưu conversation history trong MVP.
