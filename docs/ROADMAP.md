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

## Week 2 — Backend & Database Foundation
Nguồn: Phase 2.
- Setup Python + FastAPI + Uvicorn.
- Kết nối database.
- Tạo schema/migration cơ bản.
- CRUD API cho task.

Deliverable:
- Backend chạy được và task CRUD hoạt động ở API level.

## Week 3 — Todo List
Nguồn: Phase 3.
- Todo List UI.
- Kết nối frontend-backend.
- Create/Edit/Delete/Complete.
- Search & Filter.

Deliverable:
- User có thể quản lý task qua giao diện Todo List.

## Week 4 — Calendar
Nguồn: Phase 4.
- Tích hợp FullCalendar.
- Month/Week/Day view.
- Hiển thị task theo ngày/giờ.
- Đồng bộ Todo List và Calendar.

Deliverable:
- Task hiện đúng trên calendar và cập nhật đồng bộ.

## Week 5 — Authentication
Nguồn: Phase 5.
- Register.
- Login.
- Logout.
- Xác thực user.
- Cách ly dữ liệu theo user.
- Hash password.

Deliverable:
- Mỗi user chỉ thấy và quản lý task của chính mình.

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

## Week 8 — Advanced Features
Nguồn: Phase 8.
Ưu tiên:
1. Conflict Detection.
2. Dashboard nếu còn thời gian.
3. Statistics nếu còn thời gian.

Deliverable bắt buộc cho MVP:
- Conflict detection khi create/update thời gian.

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
  -> Backend/DB
      -> Todo List
          -> Calendar
              -> Authentication
                  -> Chatbot foundation
                      -> Chatbot task actions
                          -> Conflict/optional advanced
                              -> Testing
                                  -> Deployment
```

Đây là thứ tự chính thức hiện tại của project. Chỉ thay đổi roadmap nếu nhóm hoặc giảng viên quyết định đổi scope/tiến độ.
