# WEEK 03 — BACKEND & DATABASE TASK FOUNDATION

## Objective
Authenticated user có thể tạo và quản lý task qua REST API.

## Prerequisites
- Week 2 Authentication & Backend Foundation complete.
- Authentication dependency hoạt động.
- Database đã kết nối.

## Tasks
- [ ] Tạo schema/migration cho Categories và Tasks.
- [ ] Tạo Pydantic schemas cho task request/response.
- [ ] Implement Create task.
- [ ] Implement Read/list task.
- [ ] Implement Get task by id.
- [ ] Implement Update task.
- [ ] Implement Delete task.
- [ ] Implement Mark completed/status update.
- [ ] Scope mọi query/update/delete theo current authenticated user.
- [ ] Validate dữ liệu task cơ bản.
- [ ] Chuẩn bị search/filter theo date/status/priority/category.
- [ ] Detect overlap khi create task có start/end time.
- [ ] Detect overlap khi update date/time.
- [ ] Trả HTTP 409 và thông tin task conflict.
- [ ] Hỗ trợ `allow_conflict=true` để tiếp tục sau cảnh báo.

## Backend
- POST `/api/tasks`
- GET `/api/tasks`
- GET `/api/tasks/{id}`
- PUT `/api/tasks/{id}`
- DELETE `/api/tasks/{id}`
- PATCH `/api/tasks/{id}/status`
- Không thay đổi API contract tùy tiện.

## Database
- Tasks phải có `user_id` để xác định owner.
- Categories phải có `user_id` để xác định owner.
- Task query phải luôn filter theo authenticated user.
- Todo List và Calendar sẽ dùng chung Task data source.

## Tests / Validation
- Kiểm tra CRUD bằng Postman, REST Client hoặc pytest + HTTPX/FastAPI TestClient.
- Kiểm tra invalid input cơ bản.
- Kiểm tra task của User A không bị User B truy cập.
- Kiểm tra database update đúng.
- Kiểm tra route parameter dùng `{id}` theo FastAPI convention.
- Kiểm tra không overlap, partial overlap và task nằm trong task khác.

## Definition of Done
- Backend Task CRUD chạy được.
- Mọi task endpoint yêu cầu authentication.
- User chỉ thao tác được task của mình.
- Conflict detection core hoạt động ở Task API.
- API behavior được ghi nhận.
- `PROGRESS.md` cập nhật.

## Do Not Implement Yet
- Không làm Todo List UI.
- Không làm Calendar.
- Không làm AI Chatbot.
- Không làm Dashboard.
