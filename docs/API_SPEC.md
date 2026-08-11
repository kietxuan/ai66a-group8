# REST API SPECIFICATION

API backend dùng FastAPI. Tất cả endpoint task và chat yêu cầu authenticated user.

## 1. Response and Error Contract

Response thành công:

```json
{
  "data": {}
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request data is invalid",
    "details": {}
  }
}
```

Status code chính:
- `200`: đọc/cập nhật thành công.
- `201`: tạo mới thành công.
- `204`: logout hoặc delete thành công.
- `400`: business validation không hợp lệ.
- `401`: chưa đăng nhập hoặc credentials không hợp lệ.
- `404`: resource không tồn tại hoặc không thuộc user hiện tại.
- `409`: conflict hoặc email đã tồn tại.
- `422`: request không đúng schema FastAPI.

MVP không dùng pagination.

## 2. Authentication

### POST `/api/auth/register`

Request:

```json
{
  "name": "Nguyen Van A",
  "email": "user@example.com",
  "password": "secret"
}
```

Response `201`, trả thông tin user không bao gồm password. Email được normalize lowercase và phải unique.

### POST `/api/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Response `200`, backend set JWT access token trong HttpOnly cookie.

### POST `/api/auth/logout`

Response `204`, backend clear authentication cookie. MVP không có refresh-token hoặc token revocation system.

## 3. Task Fields

API dùng thống nhất:
- `title`
- `description`
- `task_date`
- `start_time`
- `end_time`
- `priority`
- `category_id`
- `status`

`allow_conflict` chỉ là request flag, không lưu vào Task.

## 4. Tasks

### POST `/api/tasks`

Tạo task cho authenticated user. Backend validate request, kiểm tra category thuộc current user và kiểm tra conflict nếu có time.

Nếu conflict và `allow_conflict` không phải `true`, trả `409 TASK_CONFLICT` kèm task conflict. Client hỏi user rồi gửi lại request với `allow_conflict=true` nếu user muốn tiếp tục.

Request example:

```json
{
  "title": "Học React",
  "description": "Ôn hooks",
  "task_date": "2026-08-11",
  "start_time": "19:00",
  "end_time": "21:00",
  "priority": "medium",
  "category_id": null,
  "allow_conflict": false
}
```

Response `201`.

### GET `/api/tasks`

Lấy task của current user.

Query parameters:
- `status`: `pending` hoặc `completed`.
- `priority`: `low`, `medium` hoặc `high`.
- `task_date`: ngày dạng `YYYY-MM-DD`.
- `category_id`: category của current user.
- `search`: tìm trong title và description.

Ví dụ:

```text
GET /api/tasks?status=pending
GET /api/tasks?priority=high
GET /api/tasks?task_date=2026-08-11
GET /api/tasks?search=react
```

Response `200` với danh sách task.

### GET `/api/tasks/{id}`

Lấy task thuộc current user. Resource của user khác trả `404`.

### PUT `/api/tasks/{id}`

Cập nhật task thuộc current user. Nếu thay đổi ngày/giờ, backend kiểm tra conflict theo cùng quy tắc create. Dùng `allow_conflict=true` để tiếp tục sau cảnh báo.

### DELETE `/api/tasks/{id}`

Xóa task thuộc current user. UI/chatbot chịu trách nhiệm confirmation trước khi gọi endpoint. Response `204`.

### PATCH `/api/tasks/{id}/status`

Request:

```json
{
  "status": "completed"
}
```

Response `200`.

## 5. Chat

### POST `/api/chat`

Gửi message của authenticated user đến chatbot. Chatbot MVP không lưu Conversations/Messages vào database.

Các action:
- `create_task`
- `get_tasks`
- `update_task`
- `delete_task`
- `complete_task`

Structured action dùng các field task đã thống nhất, đặc biệt là `task_date` và `category_id`.

Thiếu field bắt buộc thì trả clarification:

```json
{
  "data": {
    "type": "clarification",
    "message": "Bạn muốn task bắt đầu lúc mấy giờ?",
    "missing_fields": ["start_time"]
  }
}
```

Nếu có nhiều task phù hợp, chatbot không tự chọn mà trả clarification.

## 6. Authorization Rule

Mọi endpoint task/chat phải:
- xác định authenticated user từ JWT cookie;
- scope query/update/delete theo user;
- không nhận `user_id` từ client để quyết định ownership;
- không cho truy cập task/category của user khác.
