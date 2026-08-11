# DATABASE DESIGN

## 1. Database Engine
Database đã chốt: **PostgreSQL**.

Môi trường deploy dự kiến dùng **Neon PostgreSQL**.
Local development có thể dùng PostgreSQL local hoặc một database development riêng, miễn schema/migration nhất quán.

## 2. Users

| Field | Ghi chú |
|---|---|
| id | Primary identifier |
| name | Tên user |
| email | Email |
| password | Password đã hash |
| created_at | Thời điểm tạo |
| updated_at | Thời điểm cập nhật |

Quan hệ:
- 1 User -> nhiều Tasks
- 1 User -> nhiều Categories
- 1 User -> nhiều Conversations

## 3. Categories

| Field | Ghi chú |
|---|---|
| id | Primary identifier |
| user_id | Owner |
| name | Tên category |
| created_at | Thời điểm tạo |

Quan hệ:
- 1 Category -> nhiều Tasks
- Category thuộc một User

## 4. Tasks

| Field | Ghi chú |
|---|---|
| id | Primary identifier |
| user_id | Owner |
| category_id | Category |
| title | Tên task |
| description | Mô tả |
| task_date | Ngày thực hiện |
| start_time | Giờ bắt đầu |
| end_time | Giờ kết thúc |
| priority | Priority |
| status | Status |
| created_at | Thời điểm tạo |
| updated_at | Thời điểm cập nhật |

Quan hệ:
- Task thuộc một User.
- Task có thể gắn với một Category theo schema hiện tại.

## 5. Conversations

| Field | Ghi chú |
|---|---|
| id | Primary identifier |
| user_id | Owner conversation |
| created_at | Thời điểm tạo |

Quan hệ:
- Conversation thuộc một User.
- 1 Conversation -> nhiều Messages.

## 6. Messages

| Field | Ghi chú |
|---|---|
| id | Primary identifier |
| conversation_id | Conversation |
| role | Vai trò message |
| content | Nội dung |
| created_at | Thời điểm tạo |

## 7. Relationship Summary

```text
User 1 ---- * Task
User 1 ---- * Category
Category 1 ---- * Task

User 1 ---- * Conversation
Conversation 1 ---- * Message
```

## 8. Data Rules đã có trong plan
- Password phải hash trước khi lưu.
- Query task phải scope theo user.
- Todo List và Calendar dùng cùng dữ liệu Task.
- Chatbot action phải qua backend trước khi thay đổi dữ liệu.

## 9. Conflict Detection Data
Conflict dựa trên tối thiểu:
- cùng user;
- task_date;
- start_time;
- end_time.

Logic overlap chính xác sẽ được implement trong backend.

## 10. Open Database Decisions
Chưa được tài liệu gốc xác định:
- kiểu ID;
- email unique constraint;
- nullable rules chi tiết;
- cascade behavior;
- enum/value set của priority;
- enum/value set của status;
- category có bắt buộc hay không;
- timezone strategy;
- indexes;
- soft delete hay hard delete;
- conversation retention.

Các mục trên cần được xác nhận trước hoặc trong giai đoạn database implementation, không được mặc định là requirement gốc.
