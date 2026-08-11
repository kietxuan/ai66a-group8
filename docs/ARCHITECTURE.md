# SYSTEM ARCHITECTURE

## 1. High-level Architecture

```text
Frontend
   |
HTTP / REST API
   |
Backend
   |
Database
```

Frontend dự kiến dùng React.js.
Backend dùng Python + FastAPI, chạy bằng Uvicorn.
Database: **PostgreSQL**.

## 2. Main Frontend Areas
Dựa trên scope hiện tại, frontend cần các khu vực chính:
- Authentication UI
- Todo List UI
- Calendar UI
- Chatbot UI
- Search/Filter UI
- Dashboard (optional)

## 3. Backend Responsibilities
Backend chịu trách nhiệm:
- authentication/authorization;
- task CRUD;
- category data;
- search/filter;
- conflict detection;
- chatbot endpoint;
- validate structured action từ AI;
- truy vấn task cho chatbot;
- cập nhật database;
- đảm bảo user chỉ thao tác dữ liệu của chính mình.

## 4. Chatbot Architecture

```text
User Message
    |
Frontend Chat UI
    |
POST /api/chat
    |
Backend
    |
AI Model
    |
Intent + extracted fields
    |
Structured Action
    |
Backend validation
    |
Resolve task / check ambiguity
    |
Conflict detection if needed
    |
Execute function
    |
Database
    |
Response
    |
Todo List / Calendar refresh
```

## 5. AI Boundary
AI có nhiệm vụ:
- hiểu ngôn ngữ tự nhiên;
- xác định action;
- trích xuất field;
- phát hiện thông tin còn thiếu;
- tạo structured output.

AI không:
- kết nối trực tiếp database;
- tự quyết định task khi có nhiều kết quả phù hợp;
- bỏ qua validation backend;
- tự ý thực hiện destructive action không qua backend.

## 6. Structured Action — Example

```json
{
  "action": "create_task",
  "title": "Học React",
  "date": "2026-08-11",
  "start_time": "19:00",
  "end_time": "21:00"
}
```

Schema chính xác sẽ được chốt khi implement chatbot.

## 7. Backend Action Functions
Các function/service logic chính dự kiến:
- `create_task()`
- `get_tasks()`
- `update_task()`
- `delete_task()`
- `complete_task()`

Tên thực tế có thể thay đổi theo coding convention nhưng trách nhiệm không nên thay đổi.

## 8. Shared Task Data
Todo List và Calendar không có hai database/source riêng.

Cùng một task record phải được:
- hiển thị ở Todo List;
- convert thành calendar event ở Calendar;
- cập nhật đồng bộ sau create/update/delete/complete.

## 9. Conflict Detection Boundary
Conflict check thuộc backend business logic.

Áp dụng tối thiểu cho:
- create task;
- update task khi thay đổi date/time.

Nếu conflict:
- backend trả thông tin conflict;
- UI/chatbot trình bày cho user;
- user quyết định tiếp tục/hủy/đổi thời gian.

## 10. Authentication Boundary
Cơ chế đã chọn:
- JWT access token;
- token được lưu trong **HttpOnly cookie**;
- password hash bằng `bcrypt`;
- register/login/logout;
- ownership isolation;
- frontend request dùng credentials khi gọi backend.

MVP không dùng refresh token để tránh tăng độ phức tạp. Khi token hết hạn, người dùng đăng nhập lại.

Khi frontend/backend khác origin, backend phải cấu hình CORS đúng origin và cho phép credentials.

## 11. AI Provider
- Provider: Google Gemini API
- Model: Gemini 2.5 Flash
- API: Gemini API
- Structured actions: Structured Output / Function Calling

AI dùng để hiểu intent và trích xuất dữ liệu; backend vẫn là nơi validate và thực thi.

## 12. Testing Stack
- Vitest: test runner chính.
- React Testing Library: frontend/component behavior.
- pytest + HTTPX/FastAPI TestClient: kiểm thử REST API của FastAPI.
- Postman hoặc REST Client: manual API verification.

## 13. Deployment Architecture

```text
React Frontend
    |
Render Static Site
    |
HTTPS
    |
FastAPI Backend
    |
Render Web Service
    |
PostgreSQL
    |
Neon
```

## 14. Suggested Module Boundaries
Đây là cách tổ chức để Codex giữ separation of concerns; tên folder có thể điều chỉnh khi khởi tạo code:

```text
frontend/
  auth/
  tasks/
  calendar/
  chat/

backend/
  main.py
  routers/
  schemas/
  models/
  services/
  dependencies/
  repositories/
```

Không coi cấu trúc folder này là requirement bắt buộc nếu framework setup thực tế dùng convention khác.
