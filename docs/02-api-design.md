# 🔌 THIẾT KẾ REST API

---

## 1. Quy ước chung

| Quy ước | Giá trị |
|---------|---------|
| Base URL | `/api/v1` |
| Content-Type | `application/json` |
| Auth | `Authorization: Bearer <JWT_TOKEN>` |
| Pagination | `?page=1&per_page=20` |
| Date format | ISO 8601 (`2026-11-01T10:00:00+07:00`) |
| Error format | `{ "detail": "message" }` |

### HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| 200 | Thành công |
| 201 | Tạo mới thành công |
| 204 | Xóa thành công (no content) |
| 400 | Request không hợp lệ |
| 401 | Chưa đăng nhập |
| 403 | Không có quyền |
| 404 | Không tìm thấy |
| 422 | Validation error |
| 500 | Server error |

---

## 2. Auth Endpoints (Đã có sẵn - Cập nhật)

```
POST   /api/v1/auth/register        # Đăng ký
POST   /api/v1/auth/login            # Đăng nhập → JWT token
POST   /api/v1/auth/refresh          # Refresh token
POST   /api/v1/auth/logout           # Logout (blacklist token)
```

---

## 3. User Endpoints (Cập nhật)

```
GET    /api/v1/users/me              # Lấy thông tin user hiện tại
PUT    /api/v1/users/me              # Cập nhật profile (nickname, theme, timezone)
PUT    /api/v1/users/me/password     # Đổi mật khẩu
```

### Request/Response Examples

**PUT /api/v1/users/me**
```json
// Request
{
  "nickname": "Đại Nguyên",
  "theme_preference": "dark",
  "timezone": "Asia/Ho_Chi_Minh"
}

// Response 200
{
  "id": 1,
  "email": "user@example.com",
  "nickname": "Đại Nguyên",
  "theme_preference": "dark",
  "timezone": "Asia/Ho_Chi_Minh"
}
```

---

## 4. Calendar Endpoints

```
GET    /api/v1/calendars             # Lấy danh sách calendars
POST   /api/v1/calendars             # Tạo calendar mới
PUT    /api/v1/calendars/{id}        # Cập nhật calendar
DELETE /api/v1/calendars/{id}        # Xóa calendar (không cho xóa default)
```

### Request/Response Examples

**POST /api/v1/calendars**
```json
// Request
{
  "name": "Công việc",
  "color": "#0B8043"
}

// Response 201
{
  "id": 2,
  "name": "Công việc",
  "color": "#0B8043",
  "is_default": false,
  "is_visible": true,
  "created_at": "2026-11-01T10:00:00+07:00"
}
```

---

## 5. Event Endpoints

```
GET    /api/v1/events                # Lấy events theo khoảng thời gian
POST   /api/v1/events                # Tạo event mới
GET    /api/v1/events/{id}           # Lấy chi tiết event
PUT    /api/v1/events/{id}           # Cập nhật event
DELETE /api/v1/events/{id}           # Xóa event
```

### Query Parameters cho GET /api/v1/events

| Param | Type | Mô tả | Ví dụ |
|-------|------|--------|-------|
| `start` | datetime | Bắt đầu khoảng thời gian (bắt buộc) | `2026-11-01T00:00:00` |
| `end` | datetime | Kết thúc khoảng thời gian (bắt buộc) | `2026-11-30T23:59:59` |
| `calendar_id` | int | Filter theo calendar (tùy chọn) | `1` |

### Request/Response Examples

**POST /api/v1/events**
```json
// Request - Sự kiện thường
{
  "calendar_id": 1,
  "title": "Họp team sáng",
  "description": "Sprint planning tuần 45",
  "location": "Phòng họp A",
  "start_at": "2026-11-02T09:00:00+07:00",
  "end_at": "2026-11-02T10:00:00+07:00",
  "is_all_day": false,
  "color": null,
  "reminders": [
    { "minutes_before": 15 },
    { "minutes_before": 5 }
  ]
}

// Request - Sự kiện lặp lại
{
  "calendar_id": 1,
  "title": "Standup hàng ngày",
  "start_at": "2026-11-02T08:30:00+07:00",
  "end_at": "2026-11-02T08:45:00+07:00",
  "is_all_day": false,
  "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  "recurrence_end": "2027-01-31T23:59:59+07:00",
  "reminders": [
    { "minutes_before": 5 }
  ]
}

// Response 201
{
  "id": 1,
  "calendar_id": 1,
  "title": "Họp team sáng",
  "description": "Sprint planning tuần 45",
  "location": "Phòng họp A",
  "start_at": "2026-11-02T09:00:00+07:00",
  "end_at": "2026-11-02T10:00:00+07:00",
  "is_all_day": false,
  "color": null,
  "recurrence_rule": null,
  "reminders": [
    { "id": 1, "minutes_before": 15 },
    { "id": 2, "minutes_before": 5 }
  ],
  "created_at": "2026-11-01T10:00:00+07:00"
}
```

**PUT /api/v1/events/{id}** (Recurring Event - chỉnh sửa)

```json
// Query: ?scope=this|following|all
// scope=this     → Chỉ chỉnh instance này (tạo exception)
// scope=following → Từ instance này trở đi (tách series)
// scope=all      → Tất cả instances

// Request
{
  "title": "Standup hàng ngày (Updated)",
  "start_at": "2026-11-02T09:00:00+07:00",
  "end_at": "2026-11-02T09:15:00+07:00"
}
```

**DELETE /api/v1/events/{id}**
```
// Query: ?scope=this|following|all (tương tự PUT)
```

---

## 6. Task List Endpoints

```
GET    /api/v1/lists                 # Lấy tất cả lists
POST   /api/v1/lists                 # Tạo list mới
PUT    /api/v1/lists/{id}            # Cập nhật list
DELETE /api/v1/lists/{id}            # Xóa list (không cho xóa default)
PUT    /api/v1/lists/reorder         # Sắp xếp lại thứ tự lists
```

### Request/Response Examples

**GET /api/v1/lists**
```json
// Response 200
{
  "lists": [
    {
      "id": 1,
      "name": "Tasks",
      "color": "#4285F4",
      "icon": null,
      "position": 0,
      "is_default": true,
      "task_count": 12,
      "completed_count": 5
    },
    {
      "id": 2,
      "name": "Mua sắm",
      "color": "#0B8043",
      "icon": "🛒",
      "position": 1,
      "is_default": false,
      "task_count": 8,
      "completed_count": 3
    }
  ]
}
```

---

## 7. Task Endpoints

```
GET    /api/v1/tasks                 # Lấy tasks (có filter)
POST   /api/v1/tasks                 # Tạo task mới
GET    /api/v1/tasks/{id}            # Lấy chi tiết task
PUT    /api/v1/tasks/{id}            # Cập nhật task
DELETE /api/v1/tasks/{id}            # Xóa task
PATCH  /api/v1/tasks/{id}/complete   # Toggle complete
PATCH  /api/v1/tasks/{id}/important  # Toggle important
PATCH  /api/v1/tasks/{id}/my-day     # Toggle My Day
PUT    /api/v1/tasks/reorder         # Sắp xếp lại thứ tự tasks
```

### Query Parameters cho GET /api/v1/tasks

| Param | Type | Mô tả | Ví dụ |
|-------|------|--------|-------|
| `list_id` | int | Filter theo list | `1` |
| `view` | string | Smart list view | `my_day`, `important`, `planned`, `all` |
| `is_completed` | bool | Filter completed | `false` |
| `due_before` | date | Tasks đến hạn trước ngày | `2026-11-07` |
| `due_after` | date | Tasks đến hạn sau ngày | `2026-11-01` |

### Request/Response Examples

**POST /api/v1/tasks**
```json
// Request
{
  "list_id": 1,
  "title": "Hoàn thành báo cáo Q4",
  "note": "Bao gồm phân tích doanh thu và chi phí",
  "is_important": true,
  "is_in_my_day": true,
  "due_date": "2026-11-15",
  "due_time": "17:00:00",
  "reminder_at": "2026-11-15T09:00:00+07:00",
  "recurrence_rule": null,
  "steps": [
    { "title": "Thu thập dữ liệu" },
    { "title": "Phân tích số liệu" },
    { "title": "Viết báo cáo" },
    { "title": "Review với sếp" }
  ]
}

// Response 201
{
  "id": 1,
  "list_id": 1,
  "title": "Hoàn thành báo cáo Q4",
  "note": "Bao gồm phân tích doanh thu và chi phí",
  "is_completed": false,
  "is_important": true,
  "is_in_my_day": true,
  "due_date": "2026-11-15",
  "due_time": "17:00:00",
  "reminder_at": "2026-11-15T09:00:00+07:00",
  "recurrence_rule": null,
  "steps": [
    { "id": 1, "title": "Thu thập dữ liệu", "is_completed": false, "position": 0 },
    { "id": 2, "title": "Phân tích số liệu", "is_completed": false, "position": 1 },
    { "id": 3, "title": "Viết báo cáo", "is_completed": false, "position": 2 },
    { "id": 4, "title": "Review với sếp", "is_completed": false, "position": 3 }
  ],
  "created_at": "2026-11-01T10:00:00+07:00"
}
```

---

## 8. Task Steps Endpoints

```
POST   /api/v1/tasks/{task_id}/steps           # Thêm step
PUT    /api/v1/tasks/{task_id}/steps/{step_id}  # Cập nhật step
DELETE /api/v1/tasks/{task_id}/steps/{step_id}  # Xóa step
PATCH  /api/v1/tasks/{task_id}/steps/{step_id}/complete  # Toggle complete step
```

---

## 9. Categories Endpoints

```
GET    /api/v1/categories            # Lấy danh sách categories
POST   /api/v1/categories            # Tạo category mới
PUT    /api/v1/categories/{id}       # Cập nhật category
DELETE /api/v1/categories/{id}       # Xóa category
```

---

## 10. AI Chat Endpoints

```
GET    /api/v1/ai/conversations                  # Lấy danh sách conversations
POST   /api/v1/ai/conversations                  # Tạo conversation mới
GET    /api/v1/ai/conversations/{id}              # Lấy chi tiết + messages
DELETE /api/v1/ai/conversations/{id}              # Xóa conversation
POST   /api/v1/ai/conversations/{id}/messages     # Gửi tin nhắn → AI xử lý + trả lời
```

### Request/Response Examples

**POST /api/v1/ai/conversations/{id}/messages**
```json
// Request
{
  "content": "Tạo giúp tôi sự kiện họp team vào thứ 2 hàng tuần lúc 9h sáng"
}

// Response 200 (Streaming hoặc JSON)
{
  "message": {
    "id": 5,
    "role": "assistant",
    "content": "Tôi đã tạo sự kiện **Họp team** vào mỗi thứ Hai lúc 9:00 - 10:00 sáng cho bạn. Sự kiện sẽ lặp lại hàng tuần.",
    "tool_calls": [
      {
        "tool": "create_event",
        "arguments": {
          "title": "Họp team",
          "start_at": "2026-11-03T09:00:00+07:00",
          "end_at": "2026-11-03T10:00:00+07:00",
          "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO"
        },
        "result": { "event_id": 15, "status": "created" }
      }
    ]
  }
}
```

---

## 11. Dashboard / Summary Endpoint

```
GET    /api/v1/dashboard/today       # Tóm tắt ngày hôm nay
```

**Response:**
```json
{
  "date": "2026-11-01",
  "events_today": [
    { "id": 1, "title": "Họp team", "start_at": "09:00", "end_at": "10:00" }
  ],
  "events_count": 3,
  "tasks_my_day": [
    { "id": 1, "title": "Viết báo cáo", "is_completed": false, "is_important": true }
  ],
  "tasks_overdue": 2,
  "tasks_due_today": 5,
  "tasks_completed_today": 3
}
```

---

## 12. Cấu trúc file Backend mới

```
backend/app/
├── api/v1/endpoints/
│   ├── auth.py          # (đã có)
│   ├── users.py         # (cập nhật)
│   ├── calendars.py     # MỚI
│   ├── events.py        # MỚI
│   ├── task_lists.py    # MỚI
│   ├── tasks.py         # MỚI
│   ├── task_steps.py    # MỚI
│   ├── categories.py    # MỚI
│   ├── ai_chat.py       # MỚI
│   └── dashboard.py     # MỚI
├── models/
│   ├── user_model.py    # (cập nhật)
│   ├── calendar_model.py    # MỚI
│   ├── event_model.py       # MỚI
│   ├── task_model.py        # MỚI
│   ├── category_model.py    # MỚI
│   └── ai_model.py          # MỚI
├── schemas/
│   ├── calendar_schema.py   # MỚI
│   ├── event_schema.py      # MỚI
│   ├── task_schema.py       # MỚI
│   ├── category_schema.py   # MỚI
│   └── ai_schema.py         # MỚI
├── services/
│   ├── calendar_service.py  # MỚI
│   ├── event_service.py     # MỚI
│   ├── task_service.py      # MỚI
│   ├── category_service.py  # MỚI
│   └── ai_service.py        # MỚI
├── crud/
│   ├── calendar_crud.py     # MỚI
│   ├── event_crud.py        # MỚI
│   ├── task_crud.py         # MỚI
│   ├── category_crud.py     # MỚI
│   └── ai_crud.py           # MỚI
└── ai/                      # MỚI - AI Agent module
    ├── __init__.py
    ├── agent.py             # Agent orchestrator
    ├── tools.py             # Tool definitions
    ├── tool_executor.py     # Tool execution logic
    └── prompts.py           # System prompts
```

