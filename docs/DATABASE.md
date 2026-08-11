# DATABASE DESIGN

## 1. Database Engine and Persistence Stack

- Database: **PostgreSQL**.
- Production database: Neon PostgreSQL.
- Python database stack: SQLAlchemy 2 + Alembic + `psycopg`.
- IDs use PostgreSQL integer identity columns.
- Deletion strategy: hard delete.
- Application timezone: `Asia/Ho_Chi_Minh`.
- No multi-timezone support in the MVP.

## 2. Users

| Field | Rule |
|---|---|
| id | Integer identity primary key |
| name | Required |
| email | Required, unique, normalized lowercase |
| password | Required, bcrypt hash only |
| created_at | Required |
| updated_at | Required |

Quan hệ: một User có nhiều Tasks và Categories.

## 3. Categories

| Field | Rule |
|---|---|
| id | Integer identity primary key |
| user_id | Required owner, foreign key to Users |
| name | Required, unique per user |
| created_at | Required |

Khi xóa Category, `tasks.category_id` được đặt thành `NULL`.

## 4. Tasks

| Field | Rule |
|---|---|
| id | Integer identity primary key |
| user_id | Required owner, foreign key to Users |
| category_id | Nullable foreign key to Categories |
| title | Required |
| description | Nullable |
| task_date | Required date |
| start_time | Nullable time |
| end_time | Nullable time |
| priority | `low`, `medium`, `high`; default `medium` |
| status | `pending`, `completed`; default `pending` |
| created_at | Required |
| updated_at | Required |

Quy tắc thời gian:
- `start_time` và `end_time` phải cùng có hoặc cùng không có giá trị.
- Nếu có cả hai, `end_time` phải lớn hơn `start_time`.
- Task không có giờ không tham gia conflict detection.

## 5. Optional Chat History

Conversations/Messages không nằm trong MVP để giảm độ phức tạp. Chatbot MVP không lưu history vào database.

Nếu triển khai sau MVP, Conversation thuộc User và Message thuộc Conversation.

## 6. Ownership and Delete Rules

- Xóa User cascade tới Tasks và Categories.
- Xóa Category set `category_id` của task về `NULL`.
- Không dùng soft delete.
- Mọi truy vấn task/category phải filter theo `current_user.id`.

## 7. Indexes

Tối thiểu tạo:
- `tasks(user_id, task_date)`.
- `tasks(user_id, status)`.
- `tasks(user_id, priority)`.
- `categories(user_id)`.

## 8. Conflict Detection

Conflict chỉ xét task cùng `user_id`, cùng `task_date` và có đầy đủ start/end time.

Hai khoảng thời gian overlap khi:

```text
new_start < existing_end
AND new_end > existing_start
```

Thời điểm kết thúc bằng thời điểm bắt đầu không bị xem là conflict. Khi update, task hiện tại được loại khỏi danh sách so sánh. Backend trả `409` nếu conflict và request chưa có `allow_conflict=true`.

## 9. Final MVP Decisions

Các quyết định database MVP đã chốt:
- integer identity ID;
- email unique, lowercase;
- category optional;
- priority `low | medium | high`;
- status `pending | completed`;
- timezone `Asia/Ho_Chi_Minh`;
- hard delete;
- SQLAlchemy 2 + Alembic + psycopg;
- không lưu conversation history.
