# REST API SPECIFICATION — DRAFT

Đây là API dự kiến từ plan hiện tại. Request/response schema chi tiết sẽ được hoàn thiện khi implement backend.

## 1. Authentication

### POST `/api/auth/register`
Mục đích: đăng ký tài khoản.

### POST `/api/auth/login`
Mục đích: đăng nhập.

Khi credentials hợp lệ:
- backend tạo JWT access token;
- token được gửi qua HttpOnly cookie.

### POST `/api/auth/logout`
Mục đích: đăng xuất.

MVP:
- backend clear authentication cookie;
- không triển khai refresh-token/revocation system phức tạp.

---

## 2. Tasks

### POST `/api/tasks`
Tạo task mới.

Backend cần:
- xác định user;
- validate dữ liệu;
- kiểm tra conflict nếu có date/time;
- tạo task nếu user tiếp tục.

### GET `/api/tasks`
Lấy danh sách task của user hiện tại.

Query parameters dự kiến:
- `status`
- `priority`
- `date`

Ví dụ:
```text
GET /api/tasks?status=pending
GET /api/tasks?priority=high
GET /api/tasks?date=2026-08-11
```

Search/category filter được yêu cầu trong scope nhưng exact query parameter chưa được tài liệu gốc định nghĩa.

### GET `/api/tasks/:id`
Lấy một task.

Phải đảm bảo task thuộc user hiện tại.

### PUT `/api/tasks/:id`
Cập nhật task.

Nếu đổi date/time:
- validate;
- conflict check;
- chỉ update task của user hiện tại.

### DELETE `/api/tasks/:id`
Xóa task.

UI/chatbot phải xử lý confirmation phù hợp trước destructive action.

### PATCH `/api/tasks/:id/status`
Cập nhật trạng thái task, bao gồm use case mark completed.

---

## 3. Chat

### POST `/api/chat`
Gửi tin nhắn đến chatbot.

Luồng:
1. nhận user message;
2. gửi nội dung cần thiết đến AI;
3. AI trả structured action;
4. backend validate;
5. backend resolve task/context;
6. nếu thiếu/ambiguous -> yêu cầu clarification;
7. nếu action cần conflict check -> kiểm tra;
8. thực hiện action;
9. trả response;
10. UI cập nhật Todo List/Calendar nếu dữ liệu thay đổi.

Các action chính:
- `create_task`
- `get_tasks`
- `update_task`
- `delete_task`
- `complete_task`

## 4. Authorization Rule
Mọi endpoint task/chat liên quan dữ liệu người dùng phải:
- xác định authenticated user;
- scope query/update/delete theo user;
- không cho truy cập task của user khác.

## 5. Error/Response Contract — TBD
Tài liệu gốc chưa xác định:
- HTTP status chi tiết;
- error JSON schema;
- pagination;
- JWT payload/claims chi tiết;
- structured action JSON schema chính thức;
- conflict response schema;
- clarification response schema.

Các contract này cần được chốt trước khi frontend-backend integration ổn định.
