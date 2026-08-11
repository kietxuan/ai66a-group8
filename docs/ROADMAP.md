# PROJECT ROADMAP

## Project Schedule
Project được chốt thực hiện trong **10 tuần**, tương ứng **10 phase**:

**1 phase = 1 tuần**.

## Week 1 — Planning
Nguồn: Phase 1.
- Xác định yêu cầu.
- Thiết kế giao diện.
- Thiết kế database.
- Thiết kế API.
- Ghi nhận và kiểm tra các technology decisions đã chốt trong blueprint.

Deliverable:
- specification/architecture/database/API đủ rõ để bắt đầu build.

## Week 2 — Authentication & Backend Foundation
Nguồn: Phase 2.
- Setup Python + FastAPI + Uvicorn.
- Thiết lập cấu hình môi trường.
- Kết nối database.
- Tạo schema/migration cho Users.
- Register, Login, Logout.
- Hash password bằng bcrypt.
- JWT access token trong HttpOnly cookie.
- Authentication dependency/middleware.
- Cấu hình CORS/credentials.
- Setup frontend shell và Register/Login UI tối thiểu.
- Kết nối auth UI với backend bằng credentials.

Deliverable:
- Authentication flow hoạt động và authenticated user đã sẵn sàng trước khi xây dựng Task CRUD.

## Week 3 — Backend & Database Task Foundation
Nguồn: Phase 3.
- Tạo schema/migration cho Categories và Tasks.
- Implement Task CRUD API.
- Scope mọi task query/update/delete theo authenticated user.
- Validate dữ liệu task.
- Chuẩn bị search/filter theo scope.
- Detect overlap khi create/update task có start/end time.
- Trả HTTP 409 và thông tin task conflict.
- Hỗ trợ `allow_conflict=true` để user tiếp tục sau cảnh báo.

Deliverable:
- Authenticated user có thể thao tác Task CRUD qua REST API.

## Week 4 — Todo List
Nguồn: Phase 4.
- Setup/hoàn thiện React frontend.
- Todo List UI.
- Kết nối frontend-backend.
- Create/Edit/Delete/Complete.
- Search & Filter.

Deliverable:
- Authenticated user có thể quản lý task qua giao diện Todo List.

## Week 5 — Calendar
Nguồn: Phase 5.
- Tích hợp FullCalendar.
- Month/Week/Day view.
- Hiển thị task theo ngày/giờ.
- Đồng bộ Todo List và Calendar.

Deliverable:
- Task hiện đúng trên calendar và cập nhật đồng bộ.

## Week 6 — AI Chatbot Foundation
Nguồn: Phase 6.
- Chat UI.
- `/api/chat`.
- Kết nối LLM API.
- Intent extraction.
- Structured Output / Function Calling.
- Không cho AI trực tiếp thao tác DB.

Deliverable:
- Chatbot hiểu yêu cầu và trả structured action an toàn cho backend.

## Week 7 — Chatbot Task Management
Nguồn: Phase 7.
- Create task bằng chat.
- Query task bằng chat.
- Update task.
- Delete task.
- Complete task.
- Missing information handling.
- Ambiguity handling.
- Confirmation.

Deliverable:
- Core task management có thể thực hiện qua ngôn ngữ tự nhiên.

## Week 8 — Conflict Detection Hardening & Optional Features
Nguồn: Phase 8.
Ưu tiên:
1. Kiểm thử và hoàn thiện conflict detection.
2. Dashboard nếu còn thời gian.
3. Statistics nếu còn thời gian.

Deliverable bắt buộc cho MVP:
- Conflict flow ổn định ở UI và chatbot, bao gồm các edge case về overlap.

Optional:
- Dashboard/Statistics.

## Week 9 — Testing
Nguồn: Phase 9.
- Frontend testing.
- Backend testing.
- API testing.
- Chatbot testing.
- Authentication/Authorization testing.
- Conflict Detection testing.

Deliverable:
- Danh sách issue được xử lý và core flow ổn định.

## Week 10 — Deployment
Nguồn: Phase 10.
- Deploy frontend.
- Deploy backend.
- Deploy database.
- Kiểm tra hệ thống online.
- Chuẩn bị demo/documentation nếu môn học yêu cầu.

Deliverable:
- Hệ thống truy cập được online.

## Dependency Summary

```text
Planning
  -> Authentication/Backend foundation
      -> Task CRUD/Database
          -> Todo List
              -> Calendar
                  -> Chatbot foundation
                      -> Chatbot task actions
                          -> Conflict/optional advanced
                              -> Testing
                                  -> Deployment
```

Đây là thứ tự chính thức hiện tại của project. Chỉ thay đổi roadmap nếu nhóm hoặc giảng viên quyết định đổi scope/tiến độ.
