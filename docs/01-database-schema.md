# 🗄️ THIẾT KẾ CƠ SỞ DỮ LIỆU

---

## 1. Sơ đồ quan hệ (ER Diagram)

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    users     │     │   task_lists     │     │     tasks        │
├──────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)      │◄─┐  │ id (PK)          │◄─┐  │ id (PK)          │
│ email        │  │  │ user_id (FK)     │  │  │ list_id (FK)     │
│ nickname     │  │  │ name             │  │  │ user_id (FK)     │
│ password_hash│  │  │ color            │  │  │ title            │
│ is_activate  │  │  │ icon             │  │  │ note             │
│ is_developer │  │  │ position         │  │  │ is_completed     │
│ theme_pref   │  │  │ is_default       │  │  │ is_important     │
│ timezone     │  │  │ created_at       │  │  │ is_in_my_day     │
│ created_at   │  │  │ updated_at       │  │  │ due_date         │
│ updated_at   │  └──┤                  │  │  │ due_time         │
└──────┬───────┘     └──────────────────┘  │  │ reminder_at      │
       │                                    │  │ recurrence_rule  │
       │     ┌──────────────────┐           │  │ position         │
       │     │   task_steps     │           │  │ created_at       │
       │     ├──────────────────┤           │  │ updated_at       │
       │     │ id (PK)          │           │  │ completed_at     │
       │     │ task_id (FK)     ├───────────┘  └──────────────────┘
       │     │ title            │                       ▲
       │     │ is_completed     │                       │
       │     │ position         │              ┌────────┴─────────┐
       │     │ created_at       │              │  task_categories  │
       │     └──────────────────┘              ├──────────────────┤
       │                                       │ id (PK)          │
       │     ┌──────────────────┐              │ task_id (FK)     │
       │     │   calendars      │              │ category_id (FK) │
       │     ├──────────────────┤              └────────┬─────────┘
       ├────►│ id (PK)          │                       │
       │     │ user_id (FK)     │              ┌────────┴─────────┐
       │     │ name             │              │   categories     │
       │     │ color            │              ├──────────────────┤
       │     │ is_default       │              │ id (PK)          │
       │     │ is_visible       │              │ user_id (FK)     │
       │     │ created_at       │              │ name             │
       │     │ updated_at       │              │ color            │
       │     └────────┬─────────┘              │ created_at       │
       │              │                        └──────────────────┘
       │              ▼
       │     ┌──────────────────┐     ┌──────────────────┐
       │     │    events        │     │ event_reminders  │
       │     ├──────────────────┤     ├──────────────────┤
       │     │ id (PK)          │◄───►│ id (PK)          │
       └────►│ user_id (FK)     │     │ event_id (FK)    │
             │ calendar_id (FK) │     │ remind_at        │
             │ title            │     │ is_sent          │
             │ description      │     │ created_at       │
             │ location         │     └──────────────────┘
             │ start_at         │
             │ end_at           │
             │ is_all_day       │
             │ color            │
             │ recurrence_rule  │
             │ recurrence_end   │
             │ parent_event_id  │
             │ is_exception     │
             │ original_start   │
             │ created_at       │
             │ updated_at       │
             └──────────────────┘

┌──────────────────┐
│  ai_conversations│
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │
│ created_at       │
│ updated_at       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  ai_messages     │
├──────────────────┤
│ id (PK)          │
│ conversation_id  │
│ role             │
│ content          │
│ tool_calls       │
│ tool_results     │
│ created_at       │
└──────────────────┘
```

---

## 2. Chi tiết các bảng

### 2.1. Bảng `users` (Cập nhật từ bảng có sẵn)

> Thêm 2 cột mới: `theme_preference` và `timezone`

```python
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    nickname = Column(String, nullable=False)
    password_hashed = Column(String, nullable=False)
    is_activate = Column(Boolean, default=True)
    is_developer = Column(Boolean, default=False, nullable=False)
    
    # --- CỘT MỚI ---
    theme_preference = Column(String, default="light")  # "light" | "dark" | "system"
    timezone = Column(String, default="Asia/Ho_Chi_Minh")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

---

### 2.2. Bảng `calendars`

Mỗi user có thể có nhiều calendar (mặc định có 1 calendar chính).

```python
class Calendar(Base):
    __tablename__ = "calendars"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False, default="Lịch của tôi")
    color = Column(String(7), default="#4285F4")       # Mã màu hex
    is_default = Column(Boolean, default=False)
    is_visible = Column(Boolean, default=True)          # Ẩn/hiện trên UI
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="calendars")
    events = relationship("Event", back_populates="calendar", cascade="all, delete-orphan")
```

---

### 2.3. Bảng `events`

Lưu trữ sự kiện lịch. Hỗ trợ sự kiện lặp lại (recurring) thông qua `recurrence_rule`.

```python
class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    calendar_id = Column(Integer, ForeignKey("calendars.id", ondelete="CASCADE"), nullable=False, index=True)
    
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(300), nullable=True)
    
    start_at = Column(DateTime(timezone=True), nullable=False, index=True)
    end_at = Column(DateTime(timezone=True), nullable=False)
    is_all_day = Column(Boolean, default=False)
    
    color = Column(String(7), nullable=True)  # Override calendar color nếu cần
    
    # --- Recurrence (RFC 5545 RRULE format) ---
    # Ví dụ: "FREQ=WEEKLY;BYDAY=MO,WE,FR" hoặc "FREQ=MONTHLY;BYMONTHDAY=15"
    recurrence_rule = Column(String(500), nullable=True)
    recurrence_end = Column(DateTime(timezone=True), nullable=True)  # Ngày kết thúc lặp
    
    # --- Exception Handling cho Recurring Events ---
    parent_event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    is_exception = Column(Boolean, default=False)  # True nếu là exception của recurring
    original_start = Column(DateTime(timezone=True), nullable=True)  # Thời gian gốc bị override

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="events")
    calendar = relationship("Calendar", back_populates="events")
    reminders = relationship("EventReminder", back_populates="event", cascade="all, delete-orphan")
    parent_event = relationship("Event", remote_side=[id], back_populates="exceptions")
    exceptions = relationship("Event", back_populates="parent_event")
```

**Giải thích thiết kế Recurring Events:**
- Event gốc (parent) chứa `recurrence_rule` theo chuẩn RFC 5545 RRULE
- Khi user chỉnh sửa 1 instance cụ thể → tạo 1 Event mới với `is_exception=True`, `parent_event_id` trỏ về parent, `original_start` lưu thời gian gốc
- Khi user xóa 1 instance → tạo exception với title rỗng (đánh dấu đã xóa)
- Frontend sẽ tính toán các occurrence từ RRULE rồi render

---

### 2.4. Bảng `event_reminders`

Mỗi sự kiện có thể có nhiều nhắc nhở (ví dụ: 15 phút trước, 1 giờ trước).

```python
class EventReminder(Base):
    __tablename__ = "event_reminders"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    
    minutes_before = Column(Integer, nullable=False, default=15)  # Số phút trước sự kiện
    is_sent = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    event = relationship("Event", back_populates="reminders")
```

---

### 2.5. Bảng `task_lists`

Danh sách công việc (tương tự Lists trong Microsoft To Do).

```python
class TaskList(Base):
    __tablename__ = "task_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)
    color = Column(String(7), default="#4285F4")
    icon = Column(String(10), nullable=True)        # Emoji icon
    position = Column(Integer, default=0)            # Thứ tự sắp xếp
    is_default = Column(Boolean, default=False)      # List "Tasks" mặc định
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="task_lists")
    tasks = relationship("Task", back_populates="task_list", cascade="all, delete-orphan")
```

---

### 2.6. Bảng `tasks`

Công việc cần làm, với đầy đủ tính năng: My Day, Important, Due Date, Reminder, Recurring.

```python
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    list_id = Column(Integer, ForeignKey("task_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    
    title = Column(String(500), nullable=False)
    note = Column(Text, nullable=True)               # Ghi chú chi tiết
    
    is_completed = Column(Boolean, default=False, index=True)
    is_important = Column(Boolean, default=False, index=True)  # Ngôi sao
    is_in_my_day = Column(Boolean, default=False, index=True)  # My Day
    my_day_date = Column(Date, nullable=True)         # Ngày được thêm vào My Day (reset hằng ngày)
    
    due_date = Column(Date, nullable=True, index=True)
    due_time = Column(Time, nullable=True)            # Giờ cụ thể (nếu có)
    reminder_at = Column(DateTime(timezone=True), nullable=True)
    
    # Recurrence cho task lặp lại (ví dụ: "FREQ=DAILY" hoặc "FREQ=WEEKLY;BYDAY=MO")
    recurrence_rule = Column(String(500), nullable=True)
    
    position = Column(Integer, default=0)             # Thứ tự trong list
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="tasks")
    task_list = relationship("TaskList", back_populates="tasks")
    steps = relationship("TaskStep", back_populates="task", cascade="all, delete-orphan",
                         order_by="TaskStep.position")
```

---

### 2.7. Bảng `task_steps`

Subtask / bước con của một task (giống Steps trong Microsoft To Do).

```python
class TaskStep(Base):
    __tablename__ = "task_steps"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    
    title = Column(String(500), nullable=False)
    is_completed = Column(Boolean, default=False)
    position = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    task = relationship("Task", back_populates="steps")
```

---

### 2.8. Bảng `categories`

Nhãn màu (Color Categories) dùng chung cho cả Event và Task.

```python
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name = Column(String(50), nullable=False)
    color = Column(String(7), nullable=False)  # Hex color
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="categories")
```

---

### 2.9. Bảng `ai_conversations` & `ai_messages`

Lưu lịch sử hội thoại với AI Agent.

```python
class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=True)  # Tự động tạo từ tin nhắn đầu
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="ai_conversations")
    messages = relationship("AIMessage", back_populates="conversation", 
                           cascade="all, delete-orphan", order_by="AIMessage.created_at")


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("ai_conversations.id", ondelete="CASCADE"), 
                            nullable=False, index=True)
    
    role = Column(String(20), nullable=False)   # "user" | "assistant" | "tool"
    content = Column(Text, nullable=True)
    
    # Lưu JSON cho tool calls & results
    tool_calls = Column(Text, nullable=True)     # JSON string
    tool_results = Column(Text, nullable=True)   # JSON string
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    conversation = relationship("AIConversation", back_populates="messages")
```

---

## 3. Indexes & Performance

```sql
-- Indexes quan trọng cho query performance
CREATE INDEX idx_events_user_date ON events (user_id, start_at, end_at);
CREATE INDEX idx_events_calendar ON events (calendar_id, start_at);
CREATE INDEX idx_tasks_user_list ON tasks (user_id, list_id, is_completed);
CREATE INDEX idx_tasks_due_date ON tasks (user_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_my_day ON tasks (user_id, is_in_my_day) WHERE is_in_my_day = TRUE;
CREATE INDEX idx_tasks_important ON tasks (user_id, is_important) WHERE is_important = TRUE;
CREATE INDEX idx_ai_messages_conv ON ai_messages (conversation_id, created_at);
```

---

## 4. Dữ liệu mặc định (Seed Data)

Khi user đăng ký mới, tự động tạo:

1. **1 Calendar mặc định**: `name="Lịch của tôi"`, `is_default=True`, `color="#4285F4"`
2. **1 TaskList mặc định**: `name="Tasks"`, `is_default=True`, `color="#4285F4"`

Smart Lists (không lưu DB, tính toán trên backend):
- **My Day**: Filter `tasks.is_in_my_day = True AND tasks.my_day_date = today()`
- **Important**: Filter `tasks.is_important = True`
- **Planned**: Filter `tasks.due_date IS NOT NULL`
- **All**: Tất cả tasks chưa complete

---

## 5. Migration Strategy

Sử dụng Alembic (đã có sẵn) để tạo migration:

```bash
# Bước 1: Tạo file migration
make db-migrate msg="Add calendar, events, tasks, ai tables"

# Bước 2: Review file migration

# Bước 3: Apply
make db-upgrade
```

**Thứ tự migration:**
1. Cập nhật bảng `users` (thêm `theme_preference`, `timezone`)
2. Tạo bảng `calendars`
3. Tạo bảng `events`
4. Tạo bảng `event_reminders`
5. Tạo bảng `task_lists`
6. Tạo bảng `tasks`
7. Tạo bảng `task_steps`
8. Tạo bảng `categories`
9. Tạo bảng `ai_conversations`
10. Tạo bảng `ai_messages`

