# Todo List Calendar tích hợp AI Chatbot

Bộ tài liệu blueprint cho project môn **Web Design and Programming**.

## Mục tiêu project
Xây dựng một web quản lý công việc cá nhân kết hợp:
- Todo List
- Calendar
- AI Chatbot dùng ngôn ngữ tự nhiên để quản lý task

## Cấu trúc tài liệu
- `AGENTS.md`: quy tắc lâu dài cho Codex/agent khi làm project.
- `docs/PROJECT_SPEC.md`: yêu cầu, scope và MVP.
- `docs/ARCHITECTURE.md`: kiến trúc hệ thống và luồng chatbot.
- `docs/DATABASE.md`: thiết kế PostgreSQL.
- `docs/API_SPEC.md`: REST API dự kiến.
- `docs/ROADMAP.md`: roadmap 10 tuần.
- `docs/PROGRESS.md`: file theo dõi tiến độ.
- `docs/weeks/WEEK_XX.md`: công việc chi tiết từng tuần.

## Technology Decisions
- Frontend: React.js + HTML/CSS/JavaScript
- Backend: Python + FastAPI + Uvicorn
- Database: **PostgreSQL**
- Calendar: FullCalendar
- LLM provider: **Google Gemini API**
- LLM model: **Gemini 2.5 Flash**
- AI integration: **Gemini API + Structured Output / Function Calling**
- Authentication: **JWT access token trong HttpOnly cookie + bcrypt**
- Refresh token: **không dùng trong MVP**
- Testing:
  - **Vitest**
  - **React Testing Library**
  - **pytest + HTTPX/FastAPI TestClient**
  - **Postman hoặc REST Client** cho manual API testing
- Deployment:
  - **Render Static Site** cho frontend
  - **Render Web Service** cho backend
  - **Neon PostgreSQL** cho database
- Project duration: **10 tuần**
- Mapping: **10 tuần tương ứng 10 phase**

## Scope Principle
Đây là project môn học, không phải production-scale SaaS.

Ưu tiên hoàn thiện MVP:
1. Authentication
2. Todo List CRUD
3. Calendar
4. Chatbot task management
5. Conflict detection
6. Testing
7. Deployment

Dashboard, Statistics, Notification, phân tích thói quen và đề xuất lịch chỉ làm nếu còn thời gian.
