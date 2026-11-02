# 📋 TỔNG QUAN DỰ ÁN - PLANIFY
## Ứng dụng Quản lý Thời gian Thông minh (Calendar + To Do + AI Agent)

---

## 1. Tầm nhìn & Mục tiêu

**Planify** là một ứng dụng web quản lý thời gian tích hợp, kết hợp sức mạnh của:
- 📅 **Calendar** (tham khảo Microsoft Outlook Calendar & Google Calendar)
- ✅ **To Do List** (tham khảo Microsoft To Do)
- 🤖 **AI Agent** (hỗ trợ thông minh, gọi tools để thao tác trực tiếp)

### Triết lý thiết kế
> **"Đơn giản - Chính xác - Mượt mà"**
> - Giảm thiểu số bước thao tác cho người dùng
> - Mọi chức năng phối hợp nhau liền mạch
> - Giao diện trực quan, dễ sử dụng

---

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ | Ghi chú |
|-----------|-----------|---------|
| **Frontend** | HTML, CSS, JavaScript thuần | Không framework, không thư viện UI |
| **Backend** | Python, FastAPI, SQLAlchemy (Async) | Đã có sẵn boilerplate |
| **Database** | PostgreSQL 15 (asyncpg) | Đã cấu hình |
| **Cache/Session** | Redis 7 | Đã cấu hình |
| **Migration** | Alembic | Đã cấu hình |
| **AI** | Groq API (gpt-oss-120b) | Tool-calling Agent |
| **Auth** | JWT | Đã có sẵn |
| **Deploy** | Docker & Docker Compose | Đã có sẵn |

---

## 3. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Vanilla)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Calendar  │  │  To Do   │  │ AI Chat  │  │Settings│ │
│  │   View    │  │   View   │  │  Panel   │  │  View  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │
│       │              │             │             │       │
│  ┌────┴──────────────┴─────────────┴─────────────┴────┐ │
│  │              API Client (fetch)                     │ │
│  └────────────────────┬────────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────┘
                        │ REST API (JSON)
┌───────────────────────┼─────────────────────────────────┐
│                    BACKEND (FastAPI)                      │
│  ┌────────────────────┴────────────────────────────────┐ │
│  │                  API Router v1                       │ │
│  │  /auth  /users  /events  /tasks  /lists  /ai-chat   │ │
│  └────┬───────┬───────┬───────┬───────┬───────┬────────┘ │
│       │       │       │       │       │       │          │
│  ┌────┴───────┴───────┴───────┴───────┴───┐ ┌┴────────┐ │
│  │         Service Layer                   │ │AI Agent │ │
│  │  AuthService, EventService,             │ │ + Tools │ │
│  │  TaskService, ListService               │ │         │ │
│  └────────────┬────────────────────────────┘ └┬────────┘ │
│               │                               │          │
│  ┌────────────┴───────────────────────────────┴────────┐ │
│  │              CRUD / Repository Layer                 │ │
│  └────────────┬────────────────────────────────────────┘ │
│               │                                          │
│  ┌────────────┴────────┐  ┌────────────────────────────┐ │
│  │   PostgreSQL 15     │  │        Redis 7             │ │
│  │   (Data Storage)    │  │   (Cache, Sessions, OTP)   │ │
│  └─────────────────────┘  └────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Các module chính

### 📅 Module 1: Calendar (Lịch)
Quản lý sự kiện theo ngày/tuần/tháng, sự kiện lặp lại, nhắc nhở.

### ✅ Module 2: To Do (Việc cần làm)
Quản lý task với My Day, Important, Planned, danh sách tùy chỉnh, subtask.

### 🤖 Module 3: AI Agent
Chatbot thông minh gọi tools để tạo/sửa/xóa sự kiện & task, đưa lời khuyên quản lý thời gian.

### 🎨 Module 4: UI/UX
Giao diện Light/Dark theme, responsive, sidebar navigation.

### 🔐 Module 5: Auth & User
Đăng ký, đăng nhập, quản lý profile (đã có sẵn phần lớn).

---

## 5. Danh sách file tài liệu

| File | Nội dung |
|------|----------|
| [`01-database-schema.md`](./01-database-schema.md) | Thiết kế cơ sở dữ liệu chi tiết |
| [`02-api-design.md`](./02-api-design.md) | Thiết kế REST API endpoints |
| [`03-calendar-features.md`](./03-calendar-features.md) | Chi tiết chức năng Calendar |
| [`04-todo-features.md`](./04-todo-features.md) | Chi tiết chức năng To Do |
| [`05-ai-agent-design.md`](./05-ai-agent-design.md) | Thiết kế AI Agent & Tools |
| [`06-frontend-architecture.md`](./06-frontend-architecture.md) | Kiến trúc Frontend (HTML/CSS/JS) |
| [`07-implementation-plan.md`](./07-implementation-plan.md) | Kế hoạch triển khai từng bước |

---

## 6. Nguyên tắc phát triển

1. **Mobile-first responsive** - Thiết kế cho mobile trước, mở rộng lên desktop
2. **Progressive enhancement** - Chức năng cơ bản hoạt động trước, nâng cao sau
3. **API-first** - Backend API hoàn chỉnh trước, Frontend consume sau
4. **Consistency** - Calendar và To Do chia sẻ dữ liệu, đồng bộ real-time
5. **Accessibility** - Hỗ trợ keyboard navigation, ARIA labels
6. **Performance** - Lazy loading, debounce, cache hợp lý

