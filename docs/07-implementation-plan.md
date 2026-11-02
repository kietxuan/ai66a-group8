# 📋 KẾ HOẠCH TRIỂN KHAI TỪNG BƯỚC

---

## Tổng quan

Dự án được chia thành **7 Phase**, mỗi Phase có kết quả cụ thể và có thể test độc lập.

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
Chuẩn bị    Backend     Frontend    Calendar    To Do       AI Agent    Tối ưu
 & Setup     Core        Core        Module     Module      Module      & Fix
```

---

## Phase 0: Chuẩn bị & Chuyển đổi Frontend
**Thời gian ước tính: 1-2 ngày**

### Mục tiêu
- Chuyển đổi frontend từ React → HTML/CSS/JS thuần
- Cập nhật Docker configuration
- Thiết lập cấu trúc thư mục mới

### Công việc chi tiết

| # | Task | File/Thư mục | Priority |
|---|------|-------------|----------|
| 0.1 | Backup frontend React hiện tại | `frontend/` → `frontend.bak/` | High |
| 0.2 | Tạo cấu trúc thư mục frontend mới | Theo `06-frontend-architecture.md` | High |
| 0.3 | Tạo `index.html` với layout cơ bản | `frontend/index.html` | High |
| 0.4 | Tạo CSS variables & themes | `frontend/css/variables.css`, `themes/` | High |
| 0.5 | Tạo CSS reset & base styles | `frontend/css/reset.css`, `base.css` | High |
| 0.6 | Implement Theme Switcher | `frontend/js/theme.js` | High |
| 0.7 | Implement SPA Router | `frontend/js/router.js` | High |
| 0.8 | Implement API Client | `frontend/js/api.js` | High |
| 0.9 | Implement State Store | `frontend/js/store.js` | High |
| 0.10 | Tạo utility functions | `frontend/js/utils/*.js` | Medium |
| 0.11 | Cập nhật Dockerfile frontend | `frontend/Dockerfile` | High |
| 0.12 | Tạo nginx.conf cho SPA | `frontend/nginx.conf` | High |
| 0.13 | Cập nhật docker-compose.yml | `docker-compose.yml` | High |
| 0.14 | Tạo SVG icons | `frontend/assets/icons/` | Medium |
| 0.15 | Cập nhật .env.example | Thêm AI_API_KEY, AI_MODEL | Medium |

### Kiểm tra
- [x] `make dev` chạy thành công
- [x] Frontend load index.html
- [x] Theme toggle hoạt động (light/dark)
- [x] Router chuyển trang không reload
- [x] API client gọi được backend

---

## Phase 1: Backend Core - Database & API Foundation
**Thời gian ước tính: 3-4 ngày**

### Mục tiêu
- Tạo tất cả database models
- Tạo schemas (Pydantic) cho validation
- Tạo CRUD operations
- Tạo service layer
- Tạo API endpoints cơ bản

### Công việc chi tiết

#### 1A. Database Models
| # | Task | File |
|---|------|------|
| 1.1 | Cập nhật User model (thêm theme, timezone) | `app/models/user_model.py` |
| 1.2 | Tạo Calendar model | `app/models/calendar_model.py` |
| 1.3 | Tạo Event model | `app/models/event_model.py` |
| 1.4 | Tạo EventReminder model | `app/models/event_model.py` |
| 1.5 | Tạo TaskList model | `app/models/task_model.py` |
| 1.6 | Tạo Task model | `app/models/task_model.py` |
| 1.7 | Tạo TaskStep model | `app/models/task_model.py` |
| 1.8 | Tạo Category model | `app/models/category_model.py` |
| 1.9 | Tạo AIConversation, AIMessage models | `app/models/ai_model.py` |
| 1.10 | Cập nhật `models/__init__.py` | Import tất cả models |
| 1.11 | Chạy Alembic migration | `make db-migrate` |

#### 1B. Pydantic Schemas
| # | Task | File |
|---|------|------|
| 1.12 | Calendar schemas | `app/schemas/calendar_schema.py` |
| 1.13 | Event schemas (Create/Update/Response) | `app/schemas/event_schema.py` |
| 1.14 | Task schemas | `app/schemas/task_schema.py` |
| 1.15 | TaskList schemas | `app/schemas/task_schema.py` |
| 1.16 | Category schemas | `app/schemas/category_schema.py` |
| 1.17 | AI Chat schemas | `app/schemas/ai_schema.py` |

#### 1C. CRUD Layer
| # | Task | File |
|---|------|------|
| 1.18 | Calendar CRUD | `app/crud/calendar_crud.py` |
| 1.19 | Event CRUD (bao gồm recurring logic) | `app/crud/event_crud.py` |
| 1.20 | Task CRUD | `app/crud/task_crud.py` |
| 1.21 | TaskList CRUD | `app/crud/task_list_crud.py` |
| 1.22 | Category CRUD | `app/crud/category_crud.py` |
| 1.23 | AI Chat CRUD | `app/crud/ai_crud.py` |

#### 1D. Service Layer
| # | Task | File |
|---|------|------|
| 1.24 | Calendar Service | `app/services/calendar_service.py` |
| 1.25 | Event Service (recurring, exceptions, reminders) | `app/services/event_service.py` |
| 1.26 | Task Service (My Day reset, recurring task) | `app/services/task_service.py` |
| 1.27 | TaskList Service | `app/services/task_list_service.py` |
| 1.28 | Category Service | `app/services/category_service.py` |
| 1.29 | Cập nhật User Service (auto-create calendar + list) | `app/services/user_service.py` |

#### 1E. API Endpoints
| # | Task | File |
|---|------|------|
| 1.30 | Calendar endpoints | `app/api/v1/endpoints/calendars.py` |
| 1.31 | Event endpoints | `app/api/v1/endpoints/events.py` |
| 1.32 | Task endpoints | `app/api/v1/endpoints/tasks.py` |
| 1.33 | TaskList endpoints | `app/api/v1/endpoints/task_lists.py` |
| 1.34 | Task Steps endpoints | `app/api/v1/endpoints/task_steps.py` |
| 1.35 | Category endpoints | `app/api/v1/endpoints/categories.py` |
| 1.36 | Dashboard endpoint | `app/api/v1/endpoints/dashboard.py` |
| 1.37 | Cập nhật User endpoints (theme, timezone) | `app/api/v1/endpoints/users.py` |
| 1.38 | Cập nhật API router (register mới) | `app/api/v1/api.py` |

### Kiểm tra
- [x] Database migration chạy thành công
- [x] Tất cả API endpoints trả về đúng response format
- [x] Test qua Swagger UI (`/docs`):
  - [x] CRUD Calendar hoạt động
  - [x] CRUD Events hoạt động (bao gồm recurring)
  - [x] CRUD Tasks hoạt động
  - [x] CRUD TaskLists hoạt động
  - [x] Dashboard endpoint trả về data đúng
- [x] User đăng ký mới → tự tạo Calendar + TaskList mặc định

---

## Phase 2: Frontend Core - Auth & Layout
**Thời gian ước tính: 2-3 ngày**

### Mục tiêu
- Hoàn thiện trang Login/Register
- Hoàn thiện layout chính (sidebar, header)
- Tạo các component dùng chung

### Công việc chi tiết

| # | Task | File |
|---|------|------|
| 2.1 | Trang Login | `js/pages/login.js`, `css/pages/auth.css` |
| 2.2 | Trang Register | `js/pages/register.js` |
| 2.3 | Auth flow (JWT storage, auto-redirect) | `js/auth.js` |
| 2.4 | Sidebar navigation | `js/components/sidebar.js`, `css/layout/sidebar.css` |
| 2.5 | Header bar | `css/layout/header.css` |
| 2.6 | Modal component | `js/components/modal.js`, `css/components/modal.css` |
| 2.7 | Dropdown component | `js/components/dropdown.js`, `css/components/dropdown.css` |
| 2.8 | Date Picker component | `js/components/datepicker.js`, `css/components/datepicker.css` |
| 2.9 | Time Picker component | `js/components/timepicker.js`, `css/components/timepicker.css` |
| 2.10 | Toast notification system | `js/components/toast.js`, `css/components/toast.css` |
| 2.11 | Context menu component | `js/components/contextmenu.js` |
| 2.12 | Loading spinner/skeleton | `css/components/loading.css` |
| 2.13 | Settings page (theme, profile) | `js/pages/settings.js`, `css/pages/settings.css` |

### Kiểm tra
- [x] Login → nhận JWT → redirect đến app
- [x] Register → tạo tài khoản → auto login
- [x] Sidebar navigation hoạt động
- [x] Theme toggle hoạt động
- [x] Modal open/close có animation
- [x] Date picker chọn ngày chính xác
- [x] Time picker chọn giờ chính xác
- [x] Toast hiện và tự ẩn
- [x] Responsive trên mobile/tablet/desktop

---

## Phase 3: Calendar Module
**Thời gian ước tính: 5-7 ngày**

### Mục tiêu
- Hoàn thiện tất cả Calendar views
- Event CRUD trên UI
- Drag & Drop
- Recurring Events

### Công việc chi tiết

#### 3A. Calendar Views
| # | Task | File |
|---|------|------|
| 3.1 | Calendar page controller | `js/pages/calendar.js` |
| 3.2 | Calendar header (view toggle, nav, today) | `css/pages/calendar.css` |
| 3.3 | Day View renderer | `js/calendar/day-view.js` |
| 3.4 | Week View renderer | `js/calendar/week-view.js` |
| 3.5 | Month View renderer | `js/calendar/month-view.js` |
| 3.6 | Mini Calendar (sidebar) | `js/calendar/mini-calendar.js` |
| 3.7 | Current time indicator | `js/calendar/time-indicator.js` |
| 3.8 | RRULE parser | `js/utils/rrule.js` |

#### 3B. Event CRUD UI
| # | Task | File |
|---|------|------|
| 3.9 | Event card component (hiển thị trên grid) | `js/calendar/event-card.js` |
| 3.10 | Quick create popup (click ô trống) | `js/calendar/event-form.js` |
| 3.11 | Event detail modal (full form) | `js/calendar/event-form.js` |
| 3.12 | Event detail popup (click event) | `js/calendar/event-card.js` |
| 3.13 | Recurring event dialog (chỉnh sửa scope) | `js/calendar/event-form.js` |
| 3.14 | Custom recurrence modal | `js/calendar/event-form.js` |
| 3.15 | Delete event confirmation | `js/calendar/event-form.js` |

#### 3C. Drag & Drop
| # | Task | File |
|---|------|------|
| 3.16 | Drag to move event (Day/Week View) | `js/calendar/drag-drop.js` |
| 3.17 | Drag to resize event | `js/calendar/drag-drop.js` |
| 3.18 | Drag event trong Month View | `js/calendar/drag-drop.js` |

#### 3D. Sidebar Calendar
| # | Task | File |
|---|------|------|
| 3.19 | Calendar list (checkbox ẩn/hiện) | `js/pages/calendar.js` |
| 3.20 | Calendar CRUD modal (tạo/sửa/xóa) | `js/pages/calendar.js` |

### Kiểm tra
- [x] Day View hiển thị đúng events theo giờ
- [x] Week View hiển thị 7 ngày, events đúng cột
- [x] Month View hiển thị grid tháng, events đúng ô
- [x] Click ô trống → quick create hoạt động
- [x] Event detail modal tạo/sửa/xóa OK
- [x] Recurring event tạo và hiển thị đúng các occurrences
- [x] Sửa/xóa recurring event (this/following/all) hoạt động
- [x] Drag move event → API update thành công
- [x] Drag resize event → API update thành công
- [x] Mini calendar điều hướng đến ngày chọn
- [x] Current time indicator hiển thị đúng
- [x] Ẩn/hiện calendar qua checkbox
- [x] Keyboard shortcuts hoạt động (D, W, M, T, N)

---

## Phase 4: To Do Module
**Thời gian ước tính: 4-5 ngày**

### Mục tiêu
- Hoàn thiện Smart Lists (My Day, Important, Planned, All)
- Task CRUD
- Task Detail Panel
- Steps (subtasks)
- Tích hợp Calendar ↔ To Do

### Công việc chi tiết

#### 4A. To Do Layout
| # | Task | File |
|---|------|------|
| 4.1 | To Do page controller | `js/pages/todo.js` |
| 4.2 | Sidebar: Smart Lists + Custom Lists | `js/todo/smart-lists.js` |
| 4.3 | Task list main view | `js/todo/task-list-view.js` |
| 4.4 | CSS todo page | `css/pages/todo.css` |

#### 4B. Task Operations
| # | Task | File |
|---|------|------|
| 4.5 | Task item component (checkbox, star, title, due) | `js/todo/task-item.js` |
| 4.6 | Task create form (input bar) | `js/todo/task-form.js` |
| 4.7 | Task completion animation | `css/animations.css` |
| 4.8 | Task detail panel (slide right) | `js/todo/task-detail.js` |
| 4.9 | Steps (subtasks) CRUD | `js/todo/task-detail.js` |
| 4.10 | Due date picker integration | `js/todo/task-detail.js` |
| 4.11 | Reminder picker | `js/todo/task-detail.js` |
| 4.12 | Repeat/recurrence picker | `js/todo/task-detail.js` |
| 4.13 | Notes inline editor | `js/todo/task-detail.js` |
| 4.14 | Move task to different list | `js/todo/task-detail.js` |

#### 4C. Smart Lists Logic
| # | Task | File |
|---|------|------|
| 4.15 | My Day view + daily reset logic | `js/todo/smart-lists.js` |
| 4.16 | My Day suggestions (💡 button) | `js/todo/suggestions.js` |
| 4.17 | Important view (filter starred) | `js/todo/smart-lists.js` |
| 4.18 | Planned view (grouped by date) | `js/todo/smart-lists.js` |
| 4.19 | All tasks view (grouped by list) | `js/todo/smart-lists.js` |
| 4.20 | Completed tasks section (collapsible) | `js/todo/task-list-view.js` |

#### 4D. List Management
| # | Task | File |
|---|------|------|
| 4.21 | Create new list modal | `js/todo/task-list-view.js` |
| 4.22 | Edit list (rename, color, icon) | `js/todo/task-list-view.js` |
| 4.23 | Delete list confirmation | `js/todo/task-list-view.js` |
| 4.24 | Drag reorder lists | `js/todo/drag-reorder.js` |
| 4.25 | Drag reorder tasks within list | `js/todo/drag-reorder.js` |

#### 4E. Calendar Integration
| # | Task | File |
|---|------|------|
| 4.26 | Hiển thị tasks trên Calendar views | `js/calendar/day-view.js` (cập nhật) |
| 4.27 | Complete task checkbox trên Calendar | `js/calendar/event-card.js` (cập nhật) |
| 4.28 | Cross-module event system | `js/store.js` (cập nhật) |

### Kiểm tra
- [x] My Day hiển thị tasks hôm nay, reset khi ngày mới
- [x] Important filter đúng tasks starred
- [x] Planned hiển thị tasks grouped by date
- [x] Task create → xuất hiện trong list
- [x] Task complete → animation → move to completed section
- [x] Task star toggle hoạt động
- [x] Task detail panel mở/đóng mượt
- [x] Steps CRUD hoạt động
- [x] Due date/Reminder/Repeat set/clear hoạt động
- [x] Move task giữa lists hoạt động
- [x] My Day suggestions hiện đúng tasks gợi ý
- [x] Tasks hiển thị đúng trên Calendar
- [x] Recurring task: complete → tạo task mới với next date
- [x] Sort & filter hoạt động
- [x] Drag reorder tasks/lists hoạt động

---

## Phase 5: AI Agent Module
**Thời gian ước tính: 3-4 ngày**

### Mục tiêu
- Implement AI Agent backend (Groq API integration)
- Chat panel frontend
- Tool execution pipeline
- Error handling & rate limiting

### Công việc chi tiết

#### 5A. Backend AI
| # | Task | File |
|---|------|------|
| 5.1 | AI Agent orchestrator | `app/ai/agent.py` |
| 5.2 | Tool definitions | `app/ai/tools.py` |
| 5.3 | Tool executor | `app/ai/tool_executor.py` |
| 5.4 | System prompt | `app/ai/prompts.py` |
| 5.5 | AI Chat API endpoint | `app/api/v1/endpoints/ai_chat.py` |
| 5.6 | AI Chat service | `app/services/ai_service.py` |
| 5.7 | AI Chat CRUD | `app/crud/ai_crud.py` |
| 5.8 | Rate limiting (Redis) | `app/core/rate_limit.py` |
| 5.9 | Cập nhật config (API key, model) | `app/core/config.py` |
| 5.10 | Register AI routes | `app/api/v1/api.py` |

#### 5B. Frontend AI Chat
| # | Task | File |
|---|------|------|
| 5.11 | Chat panel (slide from right) | `js/ai/chat-panel.js` |
| 5.12 | Message component (user/AI/tool) | `js/ai/message.js` |
| 5.13 | Chat input with send button | `js/ai/chat-input.js` |
| 5.14 | Typing indicator animation | `css/pages/ai-chat.css` |
| 5.15 | Conversation list/selector | `js/ai/chat-panel.js` |
| 5.16 | Quick action buttons | `js/ai/chat-panel.js` |
| 5.17 | Tool call badge display | `js/ai/message.js` |
| 5.18 | Markdown rendering (basic) | `js/ai/message.js` |

### Kiểm tra
- [x] Chat panel toggle mở/đóng
- [x] Gửi tin nhắn → nhận phản hồi từ AI
- [x] AI gọi tool tạo event → event xuất hiện trên Calendar
- [x] AI gọi tool tạo task → task xuất hiện trong To Do
- [x] AI gọi tool lấy schedule → trả về đúng data
- [x] AI từ chối câu hỏi ngoài phạm vi
- [x] AI đưa lời khuyên quản lý thời gian
- [x] Rate limiting hoạt động (> 30 msg/phút → error)
- [x] Conversation history lưu/load đúng
- [x] Error handling: API down → hiện thông báo phù hợp
- [x] Quick action buttons hoạt động

---

## Phase 6: Tối ưu, Test & Hoàn thiện
**Thời gian ước tính: 3-4 ngày**

### Mục tiêu
- Fix bugs
- Tối ưu performance
- Cross-module testing
- UI polish & consistency

### Công việc chi tiết

#### 6A. Bug Fixing & Edge Cases
| # | Task | Status |
|---|------|--------|
| 6.1 | Test recurring events edge cases (timezone, DST) | [x] |
| 6.2 | Test My Day reset logic (midnight) | [x] |
| 6.3 | Test recurring tasks completion chain | [x] |
| 6.4 | Fix event overlap rendering (Day/Week View) | [x] |
| 6.5 | Fix drag & drop edge cases | [x] |
| 6.6 | Test AI tool execution error handling | [x] |
| 6.7 | Fix responsive layout issues | [x] |

#### 6B. Performance Optimization
| # | Task | Status |
|---|------|--------|
| 6.8 | Implement event caching (in-memory) | [x] |
| 6.9 | Debounce search/filter inputs | [x] |
| 6.10 | Lazy load calendar data (only current view range) | [x] |
| 6.11 | Optimize RRULE expansion (limit range) | [x] |
| 6.12 | Add loading skeletons cho UX | [x] |

#### 6C. UI Polish
| # | Task | Status |
|---|------|--------|
| 6.13 | Kiểm tra tất cả animations mượt mà | [x] |
| 6.14 | Kiểm tra dark theme tất cả components | [x] |
| 6.15 | Kiểm tra color consistency | [x] |
| 6.16 | Kiểm tra font sizes & spacing consistency | [x] |
| 6.17 | Thêm tooltips cho các icon buttons | [x] |
| 6.18 | Empty states (no events, no tasks) | [x] |

#### 6D. Cross-Module Testing
| # | Test Scenario | Expected | Status |
|---|--------------|----------|--------|
| 6.19 | Tạo event qua Calendar → hiện trên AI summary | ✓ | [x] |
| 6.20 | Tạo task qua AI → hiện trên To Do & Calendar | ✓ | [x] |
| 6.21 | Complete task trên Calendar → To Do cập nhật | ✓ | [x] |
| 6.22 | Đổi theme → tất cả components đổi màu | ✓ | [x] |
| 6.23 | Xóa list → tasks bên trong bị xóa | ✓ | [x] |
| 6.24 | Recurring event sửa "following" → đúng logic | ✓ | [x] |
| 6.25 | My Day suggestions hiện đúng tasks phù hợp | ✓ | [x] |
| 6.26 | AI tạo recurring event → hiện trên Calendar | ✓ | [x] |
| 6.27 | Mobile responsive test | ✓ | [x] |

#### 6E. Documentation
| # | Task | Status |
|---|------|--------|
| 6.28 | Cập nhật README.md | [x] |
| 6.29 | Cập nhật .env.example | [x] |
| 6.30 | Viết hướng dẫn sử dụng | [x] |

---

## Tóm tắt thời gian

| Phase | Nội dung | Thời gian ước tính |
|-------|---------|-------------------|
| Phase 0 | Chuẩn bị & Chuyển đổi Frontend | 1-2 ngày |
| Phase 1 | Backend Core (DB + API) | 3-4 ngày |
| Phase 2 | Frontend Core (Auth + Layout + Components) | 2-3 ngày |
| Phase 3 | Calendar Module | 5-7 ngày |
| Phase 4 | To Do Module | 4-5 ngày |
| Phase 5 | AI Agent Module | 3-4 ngày |
| Phase 6 | Tối ưu, Test & Hoàn thiện | 3-4 ngày |
| **Tổng** | | **21-29 ngày** |

---

## Quy tắc làm việc

1. **Mỗi Phase hoàn thành mới chuyển sang Phase tiếp theo** (trừ Phase 3 và 4 có thể làm song song)
2. **Test ngay sau mỗi task** - không để dồn cuối
3. **Commit thường xuyên** - mỗi feature hoàn thành = 1 commit
4. **Ưu tiên chức năng hoạt động đúng** trước khi polish UI
5. **Khi gặp bug blocking** → fix ngay, không skip

---

## Thứ tự ưu tiên khi cần cắt giảm

Nếu cần rút ngắn thời gian, cắt giảm theo thứ tự (từ ít quan trọng đến quan trọng):

1. ~~Drag & Drop events~~ (có thể dùng edit form thay thế)
2. ~~Drag reorder tasks/lists~~ (có thể dùng sort thay thế)
3. ~~Context menu (right-click)~~ (dùng nút ⋮ thay thế)
4. ~~Custom recurrence (chỉ giữ preset)~~
5. ~~Keyboard shortcuts~~ (nice to have)
6. ~~Month View~~ (giữ Day + Week là đủ)
7. ~~My Day suggestions~~ (giữ manual add)
8. ~~Categories~~ (dùng Calendar colors thay thế)
9. ~~Conversation history cho AI~~ (giữ single conversation)

